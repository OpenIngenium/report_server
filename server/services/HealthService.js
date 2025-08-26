/* eslint-disable no-unused-vars */
const Service = require('./Service');

class HealthService {

  /**
   *
   * returns HealthStatus
   **/
  static health_get() {
    return new Promise(
      async (resolve) => {
        try {
          let res = {'status': 'OK'};
          resolve(Service.successResponse(res));
        } catch (e) {
          resolve(Service.rejectResponse(
            'Unexpected error for health check',
            e,
            500
          ));
        }
      },
    );
  }

}

module.exports = HealthService;
