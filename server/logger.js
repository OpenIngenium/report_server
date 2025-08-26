const winston = require('winston');
const util = require('util');
const MESSAGE = Symbol.for('message');

function json_formatter(log_entry) {
  const json_data = {timestamp: new Date()};
  json_data['level'] = log_entry['level'].toUpperCase();
  json_data['message'] = log_entry['message'];

  // meta is the object passed as the 2nd argument to the logging function.
  // If multiple objects are passed, meta will be an array.
  let log_entry_meta = log_entry['meta'];

  if (log_entry_meta) {
    // If the passed object is string, array, or object with no properties, 
    // add it as details.
    if (typeof log_entry_meta === 'string' || log_entry_meta instanceof String) {
      json_data['details'] = [log_entry_meta];
    } else if (Array.isArray(log_entry_meta)) {
      json_data['details'] = log_entry_meta.map(function(item) {
        let item_inspected = util.inspect(item);
        return item_inspected
      });
    } else if (Object.keys(log_entry_meta).length == 0) {
      json_data['details'] = util.inspect(log_entry_meta);
    } else {
      // merge the passed object into json_data
      Object.assign(json_data, log_entry_meta);
    }
  }
  // log_entry[MESSAGE] is not in JSON format. Overwrite in JSON format.
  log_entry[MESSAGE] = JSON.stringify(json_data);  
  
  return log_entry;
}

const custom_log_levels = {
  levels: {
    critical: 0, error: 1, warning: 2, info: 3, debug: 4, trace: 5
  }
};

const transports = [new winston.transports.Console()];


const log = winston.createLogger({
  levels: custom_log_levels.levels,
  level: process.env.LOG_LEVEL != undefined ? process.env.LOG_LEVEL.toLowerCase() : 'debug',
  format: winston.format.combine(winston.format.splat(), winston.format.simple(), winston.format(json_formatter)()),
  transports: transports,
});

module.exports = log;
