const path = require('path');

const config = {
  ROOT_DIR: __dirname,
  URL_PORT: 3003,
  URL_PATH: 'http://localhost',
  BASE_VERSION: 'v2',
  CONTROLLER_DIRECTORY: path.join(__dirname, 'controllers'),
};

config.OPENAPI_YAML = path.join(config.ROOT_DIR, 'api', 'openapi.yaml');
config.FULL_PATH = `${config.URL_PATH}:${config.URL_PORT}/${config.BASE_VERSION}`;
config.SEARCH_API_URL = process.env.SEARCH_API_URL || 'http://127.0.0.1:3025/api/v1/';
config.CORE_API_URL = process.env.CORE_API_URL || 'http://127.0.0.1:8080/api/v5/';

config.FILE_SERVER_API_HOST = process.env.FILE_SERVER_API_HOST || 'http://127.0.0.1:9000';
// config.FILE_SERVER_API_HOST = process.env.FILE_SERVER_API_HOST || 'https://s3-us-gov-west-1.amazonaws.com';

config.ING_SERVER = process.env.ING_SERVER || 'http://localhost';
// config.ING_SERVER = process.env.ING_SERVER || 'https://ingenium-open.com'; // TODO: Update with your server URL

config.public_pem = process.env.PUBLIC_PEM || '';

config.OUTPUT_DIR = process.env.OUTPUT_DIR || 'output';

// 10 min timeout when generating report
config.REPORT_TIMEOUT = process.env.REPORT_TIMEOUT ? parseInt(process.env.REPORT_TIMEOUT) : 600000;

// 5 min timeout for loading HTML page
config.HTML_TIMEOUT = process.env.HTML_TIMEOUT ? parseInt(process.env.HTML_TIMEOUT) : 300000;

config.NUM_WORKERS = process.env.NUM_WORKERS ? parseInt(process.env.NUM_WORKERS) : 4;

// to send browser activity logs to stdout
config.BROWSER_DEBUG = (process.env.BROWSER_DEBUG && process.env.BROWSER_DEBUG.toLowerCase() === 'true') ? true : false;

config.MEDIA_BUCKET = process.env.MEDIA_BUCKET;

config.FILE_SERVER_ACCESS_KEY = process.env.FILE_SERVER_ACCESS_KEY;

config.FILE_SERVER_SECRET_KEY = process.env.FILE_SERVER_SECRET_KEY;

config.REDIS_HOST = process.env.REDIS_HOST || '127.0.0.1'

config.REDIS_PORT = process.env.REDIS_PORT || 6379

config.SMTP_HOST = process.env.SMTP_HOST || 'smtp.ingenium-open.com' // TODO: Change default SMTP host

config.SMTP_HOST_PORT = process.env.SMTP_HOST_PORT || 25

module.exports = config;
