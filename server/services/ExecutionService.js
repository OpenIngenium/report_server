/* eslint-disable no-unused-vars */
const Service = require('./Service');
const log = require('../logger');
const config = require('../config');
const excel_export = require('./executions/excel_export');

class ExecutionService {

  /**
   * Download Executions as Excel Format
   *
   * format String with value EXCEL (REQUIRED)
   * execution_id String The id of the execution (optional)
   * description String Query for words in description (optional)
   * status String Get status of the executions only following value accepted RUNNING/IDLE/PAUSED/HALTED/SUSPENDED/CLOSED/IN_REVIEW/FINALIZED (Optional)
   * completed Boolean get wither completed or not completed execution (optional)
   * from_time String search from this time UTC format (optional)
   * to_time String seach up to this time UTC format (optional)
   * venue_name string filter by venue name (optional)
   * venue_type string filter by venue type (optional)
   * run_for_score Boolean filter by run for score flag (optional)
   * test_conductor string filter by test conductor (optional)
   * procedure_id string filter by procedure id (optional)
   * version string filter by procedure version (optional)
   * institutional_id string filter by institutional id (optional)
   * institutional_release_id string filter by institutional release id
   * returns File
   **/
  static get_executions({format, execution_id, description, status, completed, from_time, to_time, venue_name, venue_type, 
                          run_for_score, test_conductor, procedure_id, version, institutional_id, institutional_release_id, authorization_header}) {
    return new Promise(
      async (resolve) => {
        try {          
          const options = {
            limit: 100000,
            format: format,
            execution_id: execution_id,
            description: description,
            status: status,
            completed: completed,
            from_time: from_time,
            to_time: to_time,
            venue_name: venue_name,
            venue_type: venue_type,
            run_for_score: run_for_score,
            test_conductor: test_conductor,
            procedure_id: procedure_id,
            version: version,
            institutional_id: institutional_id,
            institutional_release_id: institutional_release_id
          };
          
          log.debug(`get_execution options: ${options}`);
          const excel_workbook_buffer = await excel_export.executions_report(config.CORE_API_URL, options, authorization_header);
          resolve(Service.successResponse({'_excel_buffer': excel_workbook_buffer, 'fileName': 'executions_report.xlsx'}));
        } catch (e) {
          log.error('get_execution error', e);
          resolve(Service.rejectResponse(
            `Failed to generate Excel for executions`,
            e,
            400
          ));
        }
      },
    );
  }

}

module.exports = ExecutionService;
