const config = require('./config');
const log = require('./logger');
const ExpressServer = require('./expressServer');

const launchServer = async () => {
  try {
    this.expressServer = new ExpressServer(config.URL_PORT, config.OPENAPI_YAML);
    await this.expressServer.launch();
    log.info('Express server running');
  } catch (error) {
    log.error(error);
    await this.close();
  }
};

launchServer().catch(e => log.error(e));
