/* eslint-disable no-unused-vars */
const Service = require('./Service');
const log = require('../logger');
const config = require('../config');
const excel_export = require('./search_report/excel_export');

class SearchService {

  /**
   * Download Search Result as Excel Format
   *
   * format String with value EXCEL (REQUIRED)
   * queryBuilderParams String with value of ES querry builder value
   * index String with the following acceptable value all/procedure_element/element
   * returns File
   **/
  static get_search_report(request) {
    const {format, queryBuilderParams, index} = request.body;
    const {authorization_header} = request;
    return new Promise(
      async (resolve) => {
        try {          
          const options = {
            queryBuilderParams: queryBuilderParams,
            index: index,
            format: format
          };
          
          log.debug(`get_search options: ${options}`);
          const excel_workbook_buffer = await excel_export.search_report(config.SEARCH_API_URL, options, authorization_header);
          resolve(Service.successResponse({'_excel_buffer': excel_workbook_buffer, 'fileName': 'search_report.xlsx'}));
        } catch (e) {
          log.error('get_search error', e);
          resolve(Service.rejectResponse(
            `Failed to generate Excel for search report`,
            e,
            400
          ));
        }
      },
    );
  }

}

module.exports = SearchService;
