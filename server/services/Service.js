class Service {
  static rejectResponse(message, error, code = 500) {
    const details = [error.message || error.toString()];
    if (error.stack) {
      error.stack.forEach(entry => {
        details.push(entry);
      });
    }

    const payload = {
      message: message,
      details: details
    };
    return { payload, code };
  }

  static successResponse(payload, code = 200) {
    return { payload, code };
  }
}

module.exports = Service;
