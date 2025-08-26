const config = require('../config');
const Controller = require('./Controller');

class DifferenceReportController {
  constructor(Service) {
    this.service = Service;
  }

  async get_difference_report(request, response) {
    request.setTimeout(config.REPORT_TIMEOUT);
    await Controller.handleRequest(request, response, this.service.get_difference_report);
  }

}

module.exports = DifferenceReportController;
