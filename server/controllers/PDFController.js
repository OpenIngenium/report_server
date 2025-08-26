const config = require('../config');
const Controller = require('./Controller');

class PDFController {
  constructor(Service) {
    this.service = Service;
  }

  async pdf_execution_get(request, response) {
    request.setTimeout(config.REPORT_TIMEOUT);
    await Controller.handleRequest(request, response, this.service.pdf_execution_get);
  }

  async pdf_procedure_get(request, response) {
    request.setTimeout(config.REPORT_TIMEOUT);
    await Controller.handleRequest(request, response, this.service.pdf_procedure_get);
  }

}

module.exports = PDFController;
