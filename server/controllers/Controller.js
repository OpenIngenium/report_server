const log = require('../logger');
const funcs = require('../funcs');

class Controller {
  static sendResponse(response, payload) {
    /**
     * The default response-code is 200. We want to allow to change that. in That case,
     * payload will be an object consisting of a code and a payload. If not customized
     * send 200 and the payload as received in this method.
     */
    response.status(payload.code || 200);
    const responsePayload = payload.payload !== undefined ? payload.payload : payload;
    if (responsePayload instanceof Object) {
      if (responsePayload.hasOwnProperty('_pdf_buffer')) {
        response.status(200)
        .set({'Content-Type': 'application/pdf', 'Content-Length': responsePayload._pdf_buffer.length})
        .send(responsePayload._pdf_buffer);
      } else if (responsePayload.hasOwnProperty('_excel_buffer')){
        response.status(200)
        .set({'Content-Type': "application/vnd.openxmlformats-officedocument.spreedsheetml.sheet"})
        .set({'Content-Disposition': `attachment; filename=${responsePayload.fileName}`})
        .set({'Content-Length': responsePayload._excel_buffer.length})
        .send(responsePayload._excel_buffer);
      } else {
        response.json(responsePayload);
      }
    } else {
      response.end(responsePayload);
    }
  }

  static sendError(response, error) {
    response.status(error.code || 500);
    if (error.error instanceof Object) {
      response.json(error.error);
    } else {
      let error_response = {
        message: error.error || error.message,
        details: error.stack || []
      }
      response.json(error_response);
    }
  }

  static collectFiles(request) {
    if (request.openapi.schema.requestBody !== undefined) {
      const [contentType] = request.headers['content-type'].split(';');
      if (contentType === 'multipart/form-data') {
        const contentSchema = request.openapi.schema.requestBody.content[contentType].schema;
        Object.entries(contentSchema.properties).forEach(([name, property]) => {
          if (property.type === 'string' && ['binary', 'base64'].indexOf(property.format) > -1) {
            request.body[name] = request.files.find(file => file.fieldname === name);
          }
        });
      } else if (request.openapi.schema.requestBody.content[contentType] !== undefined
          && request.files !== undefined) {
        [request.body] = request.files;
      }
    }
  }

  static collectRequestParams(request) {
    this.collectFiles(request);
    const requestParams = {};
    if (request.openapi.schema.requestBody !== undefined) {
      requestParams.body = request.body;
    }
    request.openapi.schema.parameters.forEach((param) => {
      if (param.in === 'path') {
        requestParams[param.name] = request.openapi.pathParams[param.name];
      } else if (param.in === 'query') {
        requestParams[param.name] = request.query[param.name];
      }
    });
    return requestParams;
  }

  static async handleRequest(request, response, serviceOperation) {
    try {      
      let params = this.collectRequestParams(request);
      let authorization_header = request.headers['authorization'] || request.headers['Authorization'] || '';  
        
      params['authorization_header'] = authorization_header;

      const serviceResponse = await serviceOperation(params);
      
      let user_name = funcs.parse_username(authorization_header);
      let log_entry = {
        'user_name': user_name,
        'service': 'report_server',
      };      
      log.debug(request.openapi.schema.operationId, log_entry);
      Controller.sendResponse(response, serviceResponse);
    } catch (error) {
      Controller.sendError(response, error);
    }
  }
}


module.exports = Controller;
