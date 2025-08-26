const config = require('../config');
const Controller = require('./Controller');

class SearchController {
  constructor(Service) {
    this.service = Service;
  }

  async get_search_report(request, response) {
    request.setTimeout(config.REPORT_TIMEOUT);
    await Controller.handleRequest(request, response, this.service.get_search_report);
  }

}

module.exports = SearchController;
