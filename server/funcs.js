var jwt = require('jsonwebtoken');
const config = require('./config');
const log = require('./logger');
const nodemailer = require('nodemailer');
let transport = nodemailer.createTransport({
  host: config.SMTP_HOST,
  port: config.SMTP_HOST_PORT,
  tls: {
    rejectUnauthorized: false
  }
});
const process_diff = require('./services/diff_report/process_diff');

function parse_token(key) {
  let token = '';

  let tokens = key.split(' ');
  if (tokens.length > 1) {
    token = tokens[1];
  } else {
    log.warning('authorization header is not in the correct format.');
  }
  return token;
}

module.exports.parse_username = function parse_username(authorization_header) {
  let username = '';
  if (authorization_header) {
    let decoded = jwt.verify(parse_token(authorization_header), config.public_pem, { algorithms: ['RS256'] });
    username = decoded['username']
  }
  return username;
}

module.exports.send_email = async function send_email(to_username, subject, html_body) {
  const message = {
    from: 'Ingenium Report Service <do_not_reply@ingenium-open.com>', // Configure with your organization's email domain
    to: `${to_username}@ingenium-open.com`,         // Configure with your organization's email domain
    subject: subject, // Subject line
    html: html_body // html body
  };
  
  try {
    const info = await transport.sendMail(message);
    log.info(info);
  } catch (err) {
    log.error(err);
  }
}

module.exports.transform_axios_error = function transform_axios_error(err) {
  let err_new = {
    message: '',
    details: [],
    error_type: '',
    error_source: '',
    http_code_at_source: 0
  };

  if (err.response) {
    if (err.response.status) {
      err_new['http_code_at_source'] = err.response.status;  
    }    
    if (typeof err.response.data == 'string') {
      err_new['message'] = err.response.data;
    } else {
      if (err.response.data) {
        if (err.response.data.hasOwnProperty('message')) {
          err_new['message'] = err.response.data.message;
        }

        if (err.response.data.hasOwnProperty('details') && Array.isArray(err.response.data.details)) {
          err_new['details'] = err.response.data.details;
        }

        if (err.response.data.hasOwnProperty('error_type')) {
          err_new['error_type'] = err.response.data.error_type;
        }

        if (err.response.data.hasOwnProperty('error_source')) {
          err_new['error_source'] = err.response.data.error_source;
        }

        if (err.response.data.hasOwnProperty('http_code_at_source')) {
          // override http code using the code at the source
          err_new['http_code_at_source'] = err.response.data.http_code_at_source;
        }
      }
    }
  } 

  if (!err_new.message) {
      err_new['message'] = err.message;
  }
  if (err_new.details.length == 0 && err.stack) {
      err_new.details.push(err.stack);
  }
  return err_new;
}

