// const { Middleware } = require('swagger-express-middleware');
const path = require('path');
const swaggerUI = require('swagger-ui-express');
const yamljs = require('yamljs');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const bodyParser = require('body-parser');
const jwt = require('jsonwebtoken');
const winston = require('winston');
const { OpenApiValidator } = require('express-openapi-validator');
const openapiRouter = require('./utils/openapiRouter');
const log = require('./logger');
var config = require('./config');

const public_pem = config.public_pem;


function addJWTHandler(req, res, next) {  
  const schema = req.openapi.schema;
  
  let required_scopes = [];
  
  if (schema.security) {
    for (let i=0; i < schema.security.length; i++) {
      if (schema.security[i].hasOwnProperty('bearerAuth')) {
        required_scopes = schema.security[i]['bearerAuth'];
        break;
      }
    }
  }
  
  // log.info(`required_scopes: ${required_scopes}`);
  
  if (required_scopes.length == 0) {
    log.info(`Endpoint does not require authorization. operationId: ${schema.operationId}`);
    return next();
  }
  
  let key = '';
  let authorization_header = req.headers['authorization'] || req.headers['Authorization'] || '';
  if (authorization_header.toLowerCase().startsWith('bearer ')) {
    key = authorization_header.substring(7);
  } 

  // console.log(`key: ${key}`);
  if (key) {
    let decoded = '';
    try {
      decoded = jwt.verify(key, public_pem, {
        algorithms: ['RS256']
      });
    } catch (e) {
      req.res.status(401).json({
        'message': 'Invalid JWT token',
        'details': [e.toString()]
      });
      return req.res.end();
    }

    const scopes = decoded['scopes'];
    const scope_names = scopes.map(scope => scope.hasOwnProperty('scope') ? scope.scope : scope);
    const intersection_scopes = required_scopes.filter(scope => scope_names.includes(scope));
    
    log.trace(`intersection_scopes: ${intersection_scopes}`);

    if(intersection_scopes.length > 0) {
      return next();
    } else {
      req.res.status(403).json({'message': 'user does not have the permission'});
      return req.res.end();              
    }
        
  } else {
    return req.res.status(401).json({'message': 'JWT token was not provided'});
  }      
  
  next();
}

class ExpressServer {
  constructor(port, openApiYaml) {
    this.port = port;
    this.app = express();
    this.openApiPath = openApiYaml;
    this.schema = yamljs.load(openApiYaml);
    this.setupMiddleware();
  }

  setupMiddleware() {
    // this.setupAllowedMedia();
    this.app.use(cors());
    this.app.use(bodyParser.json());
    this.app.use(express.json());
    this.app.use(express.urlencoded({ extended: false }));
    this.app.use(cookieParser());
    this.app.use('/spec', express.static(path.join(__dirname, 'api')));
    this.app.get('/hello', (req, res) => res.send('Hello World. path: '+this.openApiPath));
    // this.app.get('/spec', express.static(this.openApiPath));
    this.app.use('/api-docs', swaggerUI.serve, swaggerUI.setup(this.schema));
    this.app.get('/login-redirect', (req, res) => {
      res.status(200);
      res.json(req.query);
    });
    this.app.get('/oauth2-redirect.html', (req, res) => {
      res.status(200);
      res.json(req.query);
    });
    new OpenApiValidator({
      apiSpecPath: this.openApiPath,
    }).install(this.app);
    this.app.use(addJWTHandler);
    
    this.app.use(openapiRouter());
        
    this.app.get('/', (req, res) => {
      res.status(200);
      res.end('Hello World');
    });
  }


  
  addErrorHandler() {
    this.app.use('*', (req, res) => {
      res.status(404);
      res.send(JSON.stringify({ error: `path ${req.baseUrl} doesn't exist` }));
    });
    /**
     * suppressed eslint rule: The next variable is required here, even though it's not used.
     *
     ** */
    // eslint-disable-next-line no-unused-vars
    this.app.use((error, req, res, next) => {
      const errorResponse = error.error || error.errors || error.message || 'Unknown error';
      res.status(error.status || 500);
      res.type('json');
      res.json({ message: errorResponse });
    });
  }

  async launch() {
    return new Promise(
      async (resolve, reject) => {
        try {
          this.addErrorHandler();
          this.server = await this.app.listen(this.port, () => {
            console.log(`server running on port ${this.port}`);
            resolve(this.server);
          });
        } catch (error) {
          reject(error);
        }
      },
    );
  }

  async close() {
    if (this.server !== undefined) {
      await this.server.close();
      console.log(`Server on port ${this.port} shut down`);
    }
  }
}

module.exports = ExpressServer;
