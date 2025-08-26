'use strict';

const log = require('../../logger');
const config = require('../../config'); 
const diff = require('v-node-htmldiff');
const proc_export = require('../pdf/proc_export');
const path = require('path');
const uuid = require('uuid');
const funcs = require('../../funcs');
const util = require('util');
const crypto = require('crypto');
const axios = require('axios');

const accessKey = config.FILE_SERVER_ACCESS_KEY;
const secretKey = config.FILE_SERVER_SECRET_KEY;

// Function to create the signature
function createSignature(secretKey, stringToSign) {
  return crypto.createHmac('sha1', secretKey).update(stringToSign).digest('base64');
}

async function upload_file(bucket, filename, buffer) {
  let prefix = (new Date()).toISOString().split('T')[0];
  let foldername = uuid.v4();
  let objectKey = path.join('reports', prefix, foldername, filename);    
  let fileUrl = (new URL(path.join('file_server', config.MEDIA_BUCKET, 'reports', prefix, foldername, filename), config.ING_SERVER)).href;
  await upload_to_file_server(bucket, objectKey, buffer);
  
  return fileUrl;
}

async function upload_to_file_server(bucket, objectKey, buffer) {
  let method = 'PUT';
  let contentType = 'application/pdf';
  let date = new Date().toUTCString();
  let resource = `/${config.MEDIA_BUCKET}/${objectKey}`; 

  /*
    For AWS Signature Version 2, the string to sign typically includes 
    the following components, each separated by a newline character (\n):

      HTTP Method (e.g., GET, POST)
      Content-MD5 (if any)
      Content-Type (if any)
      Date
      Canonicalized Amz Headers (if any)
      Canonicalized Resource

      let stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;

    includes a double newline (\n\n) which imply that there is no 
    Content-MD5 header, thus leaving an empty line where Content-MD5 
    would normally go. 
  */
 
  let stringToSign = `${method}\n\n${contentType}\n${date}\n${resource}`;
  let signature = createSignature(secretKey, stringToSign);
  let authorizationHeader = `AWS ${accessKey}:${signature}`;

  //Adding necessary headers that is expected by minio
  let headers = {
    'Content-Type': contentType,
    'Content-Length': buffer.length,
    'Date': date,
    'Authorization': authorizationHeader,
    'Expect': '100-continue' 
  };

  let url = `${config.FILE_SERVER_API_HOST}/${bucket}/${objectKey}`;
  try {
    let response = await axios.put(url, buffer, {
      headers,
      maxBodyLength: Infinity, 
      maxContentLength: Infinity 
    });
    log.info(`STATUS: ${response.status}`);
    log.info(`HEADERS: ${JSON.stringify(response.headers)}`);
    log.info(`BODY: ${response.data}`);
  } catch(error) {
    log.error(`Problem with request: ${error.message}`);
    throw Error(error.message);
  }
};

module.exports = async function generate_diff_report(job) {

    const { base_type, base_id, base_version, target_type, target_id, target_version, active_count, waiting_count, authorization_header, user_name} = job.data;
    log.info(`generate_diff_report job.id: ${job.id} job.name: ${job.name} user_name: ${user_name} active_count: ${active_count} waiting_count: ${waiting_count}`);
    log.info(`generate_diff_report base_id: ${base_id} base_version: ${base_version} target_id: ${target_id} target_version: ${target_version}`);
    const procedure_options = {
        toc_level: null,
        comment: false
    };

    const execution_options = {
        toc_level: null,
        comment: false,
        activity_report_comment: false,
        data_review_comment: false,
        all_steps: false
    };

    let subject = '';
    let html_body = '';
    let base_html = '';
    let target_html = '';
    let html_diff = '';
    let pdf_buffer = '';
    let fileUrl = '';

    const STYLE_STR = 'text-align: center; font-size: 7px; font-style: italic; font-family: Arial, Helvetica, sans-serif;'
    const pdf_header = `<div style="width: 100%"><p style="${STYLE_STR}">Difference Report</p></div>`;

    try {
      subject = 'Ingenium Diffing Report Request Confirmation';
      html_body = `<h2>Report Request</h2> 
                      Base Id: ${base_id} <br>
                      ${base_version >=0 ? 'Base Version: '+ base_version:''} <br>
                      Target Id: ${target_id} <br>
                      ${target_version >=0 ? 'Target Version: '+ target_version:''} <br><br>
                      Thank you for your request. Another email will be sent when your report is ready.<br>
                      If there are other active/waiting jobs, it may take some time to generate your report.<br><br>
                      Number of active jobs: ${active_count} <br>
                      Number of waiting jobs: ${waiting_count} <br>
                      `;
      try {
        log.debug(`JobId ${job.id}: Sending request confirmation email`);
        await funcs.send_email(user_name, subject, html_body);
      } catch (err) {
        log.warning(`JobId ${job.id}: Failed to send request confirmation email. error: ${err}`);
      }
    
      if (target_type == 'PROCEDURE' && target_version == undefined) {
        const msg = `JobId ${job.id}: target_version missing for PROCEDURE`;
        log.debug(msg);
        throw Error(msg);
      } else if (target_type == 'PROCEDURE' && target_version >= 0) {
          log.debug(`JobId ${job.id}: Getting target_html for PROCEDURE`);
          try {
            let { html_content } = await proc_export.procedure_html(config.ING_SERVER, config.CORE_API_URL, target_id, target_version, procedure_options, authorization_header);
            target_html = html_content;
          } catch (err) {
            const msg = `JobId ${job.id}: Failed to get target_html PROCEDURE. error: ${err}`;
            log.error(msg);
            throw Error(msg);
          }
      } else if (target_type == 'EXECUTION') {
          log.debug(`JobId ${job.id}: Getting target_html for EXECUTION`);
          try {
            target_html = await proc_export.execution_html(config.ING_SERVER, config.CORE_API_URL, target_id, execution_options, authorization_header);
          } catch (err) {
            const msg = `JobId ${job.id}: Failed to get target_html EXECUTION. error: ${err}`;
            log.error(msg);
            throw Error(msg);
          }
      }

      if (base_type == 'PROCEDURE' && base_version == undefined) {
          const msg = `JobId ${job.id}: base_version missing for PROCEDURE`;
          log.debug(msg);
          throw Error(msg);
      } else if (base_type == 'PROCEDURE' && base_version >= 0) {
          const msg = `JobId ${job.id}: Getting base_html for PROCEDURE`;
          log.debug(msg);
          try {
            let { html_content } = await proc_export.procedure_html(config.ING_SERVER, config.CORE_API_URL, base_id, base_version, procedure_options, authorization_header);
            base_html = html_content;
          } catch (err) {
            const msg = `JobId ${job.id}: Failed to get base_html PROCEDURE. error: ${err}`;
            log.error(msg);
            throw Error(msg);
          }
      } else if (base_type == 'EXECUTION') {
          log.debug(`JobId ${job.id}: Getting base_html for EXECUTION`);
          try {
            base_html = await proc_export.execution_html(config.ING_SERVER, config.CORE_API_URL, base_id, execution_options, authorization_header);
          } catch (err) {
            const msg = `JobId ${job.id}: Failed to get base_html EXECUTION. error: ${err}`;
            log.error(msg);
            throw Error(msg);
          }
      }

      try {
        log.debug(`JobId ${job.id}: Getting html_diff`);
        html_diff = diff(base_html, target_html);
        // To simulate a long running process (only for tests)
        // if (target_version == 0) {
        //   await new Promise(r => setTimeout(r, 60000));
        // }
      } catch (err) {
        const msg = `JobId ${job.id}: Failed to get html_diff. error: ${err}`;
        log.error(msg);
        throw Error(msg);
      }

      try {
        log.debug(`JobId ${job.id}: Getting pdf_buffer`);
        pdf_buffer = await proc_export.to_pdf(html_diff, pdf_header);
      } catch (err) {
        const msg = `JobId ${job.id}: Failed to get pdf_buffer. error: ${err}`;
        log.error(msg);
        throw Error(msg);
      }

      let filename = `${base_id}${base_version >= 0 ? '_' + base_version : ''}_vs_${target_id}${target_version >= 0 ? '_' + target_version : ''}.pdf`;

      try {
        log.debug(`JobId ${job.id}: Uploading File and Getting URL. filename: ${filename}`)
        fileUrl = await upload_file(config.MEDIA_BUCKET, filename, pdf_buffer);
      } catch (err) {
        const msg = `JobId ${job.id}: Failed to upload file. error: ${err}`;
        log.error(msg);
        throw Error(msg);
      }

      subject = 'Ingenium Diffing Report';
      html_body = `<h2>Report Information</h2> 
                      Base Id: ${base_id} <br>
                      ${base_version >=0 ? 'Base Version: ' + base_version : ''} <br>
                      Target Id: ${target_id} <br>
                      ${target_version >=0 ? 'Target Version: ' + target_version : ''} <br>
                      To Download the Report from Ingenium: <a href='${fileUrl}'>CLICK HERE</a><br><br>
                      If the above link does not work copy paste this link in the browser:<br><br>
                      ${fileUrl}`;

      try {
        log.debug(`JobId ${job.id}: Sending Email with file URL: ${fileUrl}`)
        await funcs.send_email(user_name, subject, html_body);
      } catch (err) {
        const msg = `JobId ${job.id}: Failed to send completion email. error: ${err}`;
        log.error(msg);
        throw Error(msg);
      }
    } catch (err) {
      let subject = 'Ingenium Diffing Report Error';
      let html_body = `<h2>Report Generation Error</h2> 
                      Base Id: ${base_id} <br>
                      ${base_version >=0 ? 'Base Version: ' + base_version : ''} <br>
                      Target Id: ${target_id} <br>
                      ${target_version >=0 ? 'Target Version: ' + target_version : ''} <br><br>
                      ${err.message} <br>
                      Please kindly let the Ingenium team know about this error`;
      log.error(`JobId ${job.id}: Sending Error Email. err: ${util.inspect(err)}`)
      await funcs.send_email(user_name, subject, html_body);
    }
}
