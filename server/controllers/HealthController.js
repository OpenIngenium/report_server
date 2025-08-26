const Controller = require('./Controller');

class HealthController {
  constructor(Service) {
    this.service = Service;
  }

  async health_get(request, response) {
    await Controller.handleRequest(request, response, this.service.health_get);
  }

}

module.exports = HealthController;
