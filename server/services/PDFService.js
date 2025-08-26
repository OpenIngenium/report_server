/* eslint-disable no-unused-vars */
const path = require('path');
const config = require('../config');
const log = require('../logger');
const Service = require('./Service');
const proc_export = require('./pdf/proc_export');

class PDFService {

  /**
   * Download As Run in PDF format
   *
   * execution_id String The id of the execution
   * toc_level Integer levels of table of contents. Use 0 for all levels (default). Use -1 for no TOC. (optional)
   * comment Boolean include general comments. default is false. (optional)
   * activity_report_comment Boolean include activity report comments. default is false. (optional)
   * data_review_comment Boolean include data review comments. default is false. (optional)
   * all_steps Boolean include all steps regardless of associated comments. default is true. (optional)
   * returns File
   **/
  static pdf_execution_get({ execution_id, toc_level, comment, activity_report_comment, data_review_comment, all_steps, authorization_header }) {
    return new Promise(
      async (resolve) => {
        try {          
          const options = {
            toc_level: toc_level,
            comment: comment ? true : false,
            activity_report_comment: activity_report_comment ? true : false,
            data_review_comment: data_review_comment ? true : false,
            all_steps: all_steps ? true : false
          };
          log.debug(`pdf_execution_get options: ${options}`);
          const pdf_buffer = await proc_export.execution_pdf(config.ING_SERVER, config.CORE_API_URL, 
            execution_id, options, authorization_header);
          resolve(Service.successResponse({'_pdf_buffer': pdf_buffer}));
        } catch (e) {
          log.error('pdf_execution_get error', e);
          resolve(Service.rejectResponse(
            `Failed to generate PDF for execution: ${execution_id}`,
            e,
            400
          ));
        }
      },
    );
  }

  /**
   * Download procedure in PDF format
   *
   * procedure_id String The id of the procedure
   * version Integer version the procedure
   * toc_level Integer levels of table of contents. Use 0 for all levels (default). Use -1 for no TOC. (optional)
   * comment Boolean include general comments. default is false. (optional)
   * returns File
   **/
  static pdf_procedure_get({ procedure_id, version, toc_level, comment, authorization_header }) {
    return new Promise(
      async (resolve) => {
        try {
          const options = {
            toc_level: toc_level,
            comment: comment ? true : false
          };
          log.debug(`pdf_procedure_get options: ${options}`);       
          let pdf_buffer = await proc_export.procedure_pdf(config.ING_SERVER, config.CORE_API_URL, 
            procedure_id, version, options, authorization_header);
          resolve(Service.successResponse({'_pdf_buffer': pdf_buffer}));
        } catch (e) {
          log.error('pdf_procedure_get error', e);
          resolve(Service.rejectResponse(
            `Failed to generate PDF for procedure: ${procedure_id} v: ${version}`,
            e,
            400
          ));
        }
      },
    );
  }
}

module.exports = PDFService;
