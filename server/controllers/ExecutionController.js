const config = require('../config');
const Controller = require('./Controller');

class ExecutionController {
  constructor(Service) {
    this.service = Service;
  }

  async get_executions(request, response) {
    request.setTimeout(config.REPORT_TIMEOUT);
    await Controller.handleRequest(request, response, this.service.get_executions);
  }

}

module.exports = ExecutionController;
