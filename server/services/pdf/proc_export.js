'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');
const mustache = require('mustache');
const puppeteer = require('puppeteer');
const inquirer = require('inquirer');
const axios = require('axios');
const moment = require('moment');
const config = require('../../config');
const log = require('../../logger');
const funcs = require('../../funcs');

const STYLE_STR = 'text-align: center; font-size: 7px; font-style: italic; font-family: Arial, Helvetica, sans-serif;'

function time_diff(from_date_str, to_date_str) {
  const from_date = new Date(from_date_str);
  const to_date = new Date(to_date_str);
  
  //log.debug(`from_date: ${from_date}`);
  //log.debug(`to_date: ${to_date}`);
  
  let diff_secs = Math.round((to_date.getTime() - from_date.getTime())/1000);
  
  //log.debug(`diff_secs: ${diff_secs}`);
  
  let days = Math.floor(diff_secs / (60*60*24));
  let hrs = Math.floor((diff_secs - 60*60*24*days) / (60*60));
  let mins = Math.floor((diff_secs - 60*60*24*days - 60*60*hrs) / 60);
  let secs = diff_secs - 60*60*24*days - 60*60*hrs - 60*mins;
  
  //log.debug(`${days} ${hrs} ${mins} ${secs}`);
  
  let diff_str = `${secs} secs`;
  if (mins > 0) diff_str = `${mins} mins ${diff_str}`;
  if (hrs > 0) diff_str = `${hrs} hrs ${diff_str}`;
  if (hrs > 0) diff_str = `${days} days ${diff_str}`;
  
  return diff_str;
}

function to_utc_doy(time) {
  return time ? moment.utc(time).format("YYYY-DDDDTHH:mm:ss") : "";
};

function change_as_run_status(status) {
  let updatedStatus = '';

  switch(status){
    case 'IDLE':
    case 'RUNNING':
    case 'PAUSED':
    case 'HALTED':
    case 'SUSPENDED':
      updatedStatus = `IN PROGRESS (${status})`;
      break;
    case 'CLOSED':
      updatedStatus = 'EXECUTION COMPLETE (CLOSED)';
      break;
    case 'IN_REVIEW':
      updatedStatus = 'EXECUTION APPROVED (IN_REVIEW)';
      break;
    case 'FINALIZED':
      updatedStatus = 'DATA REVIEW COMPLETE (FINALIZED)';
      break;
  }

  return updatedStatus;
}

function capitalize_first_chars(str){
  return str.split(' ').map(function(word,index){
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join(' ');
}

function to_lower_camel_case(str){
  return str.split(' ').map(function(word,index){
    // If it is the first word make sure to lowercase all the chars.
    if(index === 0) {
      return word.toLowerCase();
    }
    // If it is not the first word only upper case the first char and lowercase the rest.
    return word.charAt(0).toUpperCase() + word.slice(1).toLowerCase();
  }).join('');
}

function to_kebob_case(str){
  return str.split(' ').join('-').split('_').join('-').toLowerCase();
}

function to_human_name(str) {
  if (str === null || str === undefined) {
    return '';
  }
  return capitalize_first_chars(str.replace(/_/g, ' '));
}

function get_actual_value(entry) {
  const val = entry.hasOwnProperty('actual_value') ? entry.actual_value : '';
  return val === null ? '' : val;
}

function to_str_value(val) {
  return (val === null || val === undefined) ? '' : val;
}

/**
 * 
 * @param {*} verification_condition 
 * @param {*} verification_values 
 * @param {*} verify_on VALUE or CHANGE
 */
function get_verification_expression(verify_on, verification_condition, verification_values) {
  let expression = 'Warning: not recognized condition';
  if (verification_condition === 'GREATER_THAN') {
    expression = `${verify_on} &gt; ${verification_values[0]}`;
  } else if (verification_condition === 'LESS_THAN') {
    expression = `${verify_on} &lt; ${verification_values[0]}`;
  } else if (verification_condition === 'GREATER_THAN_OR_EQUAL') {
    expression = `${verify_on} &ge; ${verification_values[0]}`;
  } else if (verification_condition === 'LESS_THAN_OR_EQUAL') {
    expression = `${verify_on} &le; ${verification_values[0]}`;
  } else if (verification_condition === 'EQUAL') {
    expression = `${verify_on} = ${verification_values[0]}`;
  } else if (verification_condition === 'NOT_EQUAL') {
    expression = `${verify_on} &#8800; ${verification_values[0]}`;
  } else if (verification_condition === 'RECORD') {
    expression = 'Record';
  } else if (verification_condition === 'NOT_PRESENT') {
    expression = `${verify_on} &#8716; ${verification_values[0]}`;
  } else if (verification_condition === 'CONTAINS') {
    expression = `${verify_on} &#8715; ${verification_values[0]}`;
  } else if (verification_condition === 'INCLUSIVE_RANGE') {
    expression = `${verification_values[0]} &le; ${verify_on} &le; ${verification_values[1]}`;
  } else if (verification_condition === 'EXCLUSIVE_RANGE') {
    expression = `${verification_values[0]} &lt; ${verify_on} &lt; ${verification_values[1]}`;
  }
  return expression;
}

/**
 * 
 * @param {*} verify_on VALUE or CHANGE
 * @param {*} dn_eu 
 * @param {*} dn 
 * @param {*} eu 
 * @param {*} actual_value 
 */
function get_eha_display_value(verify_on, dn_eu, dn, eu , actual_value) {

  if (verify_on === 'CHANGE') {
    if (dn_eu === 'DN') {
        return `Change: ${actual_value} (Value: ${dn})`;
    } else if (dn_eu === 'EU') {
        return `Change: ${actual_value} (Value: ${eu})`;
    } else {
        // this should not happen. Just in case.
        return `Change: ${actual_value}`;
    }
  } else {
    return actual_value;
  }
}

/**
 * 
 * @param {*} verify_on VALUE, CHANGE, or MEASURED
 * @param {*} min_value 
 * @param {*} max_value 
 * @param {*} unit 
 */
function get_range_expression(verify_on, min_value, max_value, unit) {
  let min = min_value === undefined ? '' : min_value.trim();
  let max = max_value === undefined ? '' : max_value.trim();
   
  if (min !== '' && max !== '') {
    return `${min}${get_unit_expression(unit)} &le; ${capitalize_first_chars(verify_on)} &le; ${max}${get_unit_expression(unit)}`;
  } else if (min !== '') {
    return `${min}${get_unit_expression(unit)} &le; ${capitalize_first_chars(verify_on)}`;
  } else if (max !== '') {
    return `${capitalize_first_chars(verify_on)} &le; ${max}${get_unit_expression(unit)}`;
  } else {
    return `Record`;
  }
}

function get_unit_expression(unit) {
  if (unit) {
    const unit_lower = unit.trim().toLowerCase();
    if (unit_lower === 'volt') {
      return 'V';
    } else if (unit_lower === 'milivolt') {
      return 'mV';
    } else if (unit_lower === 'ohm') {
      return '&#8486;';
    } else if (unit_lower === 'kiloohm') {
      return 'k&#8486;';
    } else if (unit_lower === 'megaohm') {
      return 'M&#8486;';
    } else {
      return unit_lower;
    }
  } else {
    return unit;
  }
}

/**
 * sanitize Froala HTML string that cannot be processed
 * 
 */
function sanitize_html_str(html_str) {
  // Example:  <table style="width: 100%; margin-left: calc(0%);">
  html_str = html_str.replace('calc(0%)', '0%');
  return html_str;
}


/**
 * convert relative url of embedded images to absolute paths in file server (or AWS S3)
 * 
 */
function update_image_src(html_str) {
  // Example:
  // <img data-fr-image-pasted="true" src="https://ingenium-psyche.jpl.nasa.gov/file_server/ingenium-media-prod-psyche/2020-06-04/9430d621-f564-49c1-8982-3d9dd45b6a83/Screen%20Shot%202020-06-04%20at%203.33.04%21PM.png" class="fr-fic fr-dii" style="width: 723px;">  
  html_str = html_str.split(`src="${config.ING_SERVER}/file_server/`).join('src="/file_server/');
  
  // Example:
  // <img src="/file_server/ingenium-media-prod-psyche/2019-03-14/f31f646f-3c5d-4b79-81c8-283ec1f9de4f/3552580946903.png" style="width: 300px;" class="fr-fic fr-dib">
  html_str = html_str.split(`src="/file_server/`).join(`src="${config.FILE_SERVER_API_HOST}/`);
  return html_str;
}


module.exports.to_pdf = async function to_pdf(html_content, pdf_header) {
  const pdf_footer = `<div style="width: 100%"><p style="${STYLE_STR}">The technical data in this document is controlled under the U.S. Export Regulations; ` + 
    `release to foreign persons may require an export authorization.</p><p class="pageNumber" style="${STYLE_STR}"></p></div>`;
    
  const t0 = new Date();
  const options = {
    headless: true,
    ignoreHTTPSErrors: true,
    dumpio: config.BROWSER_DEBUG,    // to optionally send browser activity logs to stdout
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--enable-logging',
      '--v=1',
      '--single-process', //Runs the renderer and plugins in the same process as the browser https://peter.sh/experiments/chromium-command-line-switches/#single-process
      '--no-zygote' //Disables the use of a zygote process for forking child processes. 
                    //Instead, child processes will be forked and exec'd directly. 
                    //Note that --no-sandbox should also be used together with this flag 
                    //because the sandbox needs the zygote to work. https://peter.sh/experiments/chromium-command-line-switches/#no-zygote
    ]
  };
  const browser = await puppeteer.launch(options);
  const t1 = new Date();
  log.debug(`Chromium was launched in ${(t1.getTime() - t0.getTime())/1000} seconds`);
  
  const page = await browser.newPage();
  const t2 = new Date();
  log.debug(`New page was opened in Chromium in ${(t2.getTime() - t1.getTime())/1000} seconds`);

  //Declaring pdf_buffer to use later for pdf generation
  let pdf_buffer;

  try {
    // See these articles on the use of networkidle2 option.
    // https://github.com/puppeteer/puppeteer/blob/v1.0.0/docs/api.md#pagegotourl-options
    // https://github.com/puppeteer/puppeteer/issues/
    // When an image of external source (for example: ingenium-open-example.com) was embedded, networkidle0 took 2 mins before
    // returning. The image was not available anyhow since it required log-in.
    // - Switched to networkidle2 to avoid unnecessary delay. 
    // - Increased the timeout from the 30 secs default to 300 secs just in case.
    log.debug(`Loading HTML page. waitUntil: networkidle2. timeout (ms): ${config.HTML_TIMEOUT}`);
    await page.setContent(html_content, { waitUntil: 'networkidle2', timeout: config.HTML_TIMEOUT });
    
    const css_paths = [path.join(__dirname, 'css', 'froala_style.css'), path.join(__dirname, 'css', 'ingenium_report.css')];
    for (let i=0; i < css_paths.length; i++) {
      let css_path = css_paths[i];
      await page.addStyleTag({path: css_path});
    }  

    const t3 = new Date();
    log.debug(`HTML page was loaded in ${(t3.getTime() - t2.getTime())/1000} seconds`);  

    const pdf_options = {
      format: 'Letter',
      margin: {
        top: '100px',
        bottom: '60px',
        left: '40px',
        right: '40px'
      },
      displayHeaderFooter: true,
      headerTemplate: pdf_header,
      footerTemplate: pdf_footer
    };
    pdf_buffer = await page.pdf(pdf_options);

    log.debug(`pdf_buffer: ${pdf_buffer.length} bytes`);

    const t4 = new Date();
    log.debug(`PDF was generated in ${(t4.getTime() - t3.getTime())/1000} seconds`);

    await browser.close();
    const t5 = new Date();
    log.debug(`Chromium was closed in ${(t5.getTime() - t4.getTime())/1000} seconds`);

    } catch (e) {
      log.error(`Error Generating PDF: ${e}`);
    } finally {
      // See this github issue for more information on how to handle zombie process
      // https://github.com/puppeteer/puppeteer/issues/1825
      const pid = browser.process().pid
      log.error(`Killing the Chromium Process Id ${pid}`);
      try {
        process.kill(pid, 'SIGKILL');
      } catch (e) {
        log.debug(`Error Killing Chromium: ${e}`);
      }
    }

  return pdf_buffer;
}

function get_view_elements(mode, elements, tag_id_name_map, options) {
  const view_elems = [];
  const all_elements = [];
  const elems_map = {};
  
  for (const element of elements) {
    element.prev_run = null;
    all_elements.push(element);
    if (element.run_records && (element.run_records.length > 0)) {
      element.run_records.forEach((run_record, i) => {
        // prev_run is 1 based index
        run_record.prev_run = (i+1);
        all_elements.push(run_record);
      });
    }    
  }
  
  // construct elements map
  for (const element of all_elements) {
      elems_map[element.elem_id] = element;      
  }
  
  // find depth of nesting
  for (const element of all_elements) {
    let depth = 0;
    if (element.parent_id) {
      let parent = elems_map[element.parent_id];
      while (parent) {
        depth++;
        if (depth > 20) {
          // support up to 20 levels
          // avoid infinite loop when the parent/child relationship is not correct.
          break;
        }
        parent = elems_map[parent.parent_id];
      }     
    }
    element.depth = depth;
  }  
  
  // populate view element
  for (const element of all_elements) {
    let type_name =  element.step_type ? element.step_type : element.elem_type;
    let is_section = element.elem_type === 'SECTION';
    let is_step_like = element.elem_type === 'STEP' || element.elem_type === 'PROCEDURE_SECTION';
    let is_section_like = element.elem_type === 'SECTION' || element.elem_type === 'PROCEDURE_SECTION';
    let is_not_section_like = !is_section_like;
    
    element.conversations.forEach(conversation => {
      conversation.comments.forEach(comment => {comment.content = sanitize_html_str(update_image_src(comment.content))});
      conversation.resolved = conversation.status === 'RESOLVED';
      conversation.type_name = to_human_name(conversation.type);
      conversation.type_class = to_kebob_case(conversation.type);
      
      conversation.included = false;
      if (conversation.type === 'COMMENT') {
        conversation.included = options.comment;
      } else if (conversation.type === 'ACTIVITY_REPORT_COMMENT') {
        conversation.included = options.activity_report_comment;
      } else if (conversation.type === 'DATA_REVIEW_COMMENT') {
        conversation.included = options.data_review_comment;
      } else {
        log.warning(`Unrecognized conversation type: ${conversation.type}`);
      }
    });
    
    const tag_names = [];
    let hazardous = false;
    if (element.tag_ids) { 
      for (const tag_id of element.tag_ids) {
        if (tag_id_name_map.hasOwnProperty(tag_id)) {
          const tag_name = tag_id_name_map[tag_id];
          if (tag_name.toLowerCase() === 'hazardous' || tag_name.toLowerCase() === 'hazard') {
            hazardous = true;
          }
          tag_names.push(tag_id_name_map[tag_id]);
        } else {
          log.warning(`tag was not found in procedure. tag_id: ${tag_id}`);
        }
      }
    }
    
    let view_elem = {
      [type_name]: true,
      type_name: to_human_name(type_name),
      step_type_name: to_human_name(element.step_type),
      is_section: is_section,
      is_step_like: is_step_like,
      is_section_like: is_section_like,
      is_not_section_like: is_not_section_like,
      number: element.number,
      title: element.title,
      elem_id: element.elem_id,
      description: sanitize_html_str(update_image_src(element.description)),
      tag_names: tag_names,
      tag_names_str: tag_names.join(', '),
      hazardous: hazardous,
      props: {},
      entries: [],
      executed: element.executed === true ? true : false,
      conversations: element.conversations,
      prev_run: element.prev_run,
      depth: element.depth
    }
    
    if (mode === 'EXECUTION') {
      view_elem.execution = element.execution;
      if (element.execution && element.execution.meta_data && element.execution.meta_data.time_completed) {
        view_elem.time_completed = to_utc_doy(element.execution.meta_data.time_completed);
      }
      if (element.execution && element.execution.meta_data && element.execution.meta_data.test_conductor) {
        view_elem.test_conductor = element.execution.meta_data.test_conductor;
      }      
      
      if (element.execution && element.execution.meta_data && element.execution.meta_data.status == 'ERROR') {
        view_elem.message = element.execution.meta_data.error.message;
        view_elem.details = element.execution.meta_data.error.details;
      }      
      
      if (element.procedure_modification && (Object.keys(element.procedure_modification).length > 0)) {
        view_elem.procedure_modification = element.procedure_modification;
      } else if (element.procedure_modification_status === 'DELETED') {
        // procedure_modification is not populated when an element is DELETED.
        // This is a special logic to handle this idiosyncracy.
        view_elem.procedure_modification = {
          "justification": {
            "time_updated": "",
            "user_name": "",
            "modification_type": "REDLINE",
            "content": ""
          },
          "approval": {
            "content": "",
            "status": "PENDING",
            "time_updated": "",
            "user_name": ""
          },
        }
      }
      
      if (element.procedure_modification_status === 'DELETED') {
        view_elem.DELETED = true;
      }
      
      if (!view_elem.is_section) {
        if (element.procedure_title) {
          view_elem.procedure_title = element.procedure_title;
        }      
        if (element.run_for_score === true) {
          view_elem.run_for_record = true;
        }        
      }
    } 
    
    // step_input is for input values
    let step_input = mode === 'EXECUTION' ? element.execution_user_input : element.authoring_user_input;
    // step_data is for results
    let step_data = element.authoring_user_input;
    
    // For execution
    if (mode === 'EXECUTION') {
      if (element.executed === true && element.execution.results) {
        step_data = element.execution.results;
      } else {
        step_data = element.execution_user_input;
      }
    }

    if (element.step_type === 'MANUAL_INPUT') {
      view_elem.props = step_data;
      if (view_elem.props.entries) {
        view_elem.props.entries.forEach(entry => {
          entry.type = capitalize_first_chars(entry.type);
          entry.condition = get_verification_expression(entry.verify_on, entry.verification_condition, entry.verification_values);
          entry.actual_value = get_actual_value(entry);
        });        
      }
    } else if (element.step_type === 'MANUAL_EIP') {
      view_elem.props = step_data;
      if (view_elem.props.entries) {
        step_data.entries.forEach(entry => {
          entry.condition = get_range_expression('MEASURED', entry.min_value, entry.max_value, entry.unit);
          entry.actual_value = get_actual_value(entry);
          entry.unit = get_unit_expression(entry.unit);
          entry.measured_unit = get_unit_expression(entry.measured_unit);
        });      
      }
    } else if (element.step_type == 'ENVIRONMENT_MANUAL') {
      let temperature = step_data.temperature;
      if (step_data.temperature && step_data.temperature.verify_on && step_data.temperature.verification_condition) {
        temperature.condition = get_verification_expression(step_data.temperature.verify_on, 
          step_data.temperature.verification_condition, step_data.temperature.verification_values);
        temperature.actual_value = get_actual_value(step_data.temperature);
        temperature.verification_status = step_data.temperature.verification_status
      }

      let humidity = step_data.humidity;
      if (step_data.humidity && step_data.humidity.verify_on && step_data.humidity.verification_condition) {
        humidity.condition = get_verification_expression(step_data.humidity.verify_on, 
          step_data.humidity.verification_condition, step_data.humidity.verification_values);
        humidity.actual_value = get_actual_value(step_data.humidity);
        humidity.verification_status = step_data.humidity.verification_status     
      }
      
      view_elem.props = {
        'temperature': temperature,
        'humidity': humidity
      };
    } else if (element.step_type == 'WAIT') {
      view_elem.props = {
        'wait': step_data.wait_type === 'DURATION' ? 
          `Wait for ${step_data.time_value} seconds` : `Wait until ${step_data.time_value}`,
      }
    } else if (element.step_type === 'VENUE_CONFIG_MANUAL') {
      view_elem.props = {
        'fsw_version': step_data.fsw_version,
        'sse_version': step_data.sse_version,
        'fsw_dictionary': step_data.fsw_dictionary,
        'sse_dictionary': step_data.sse_dictionary,
        'gds_version': step_data.gds_version,                       
      };  
    } else if (element.step_type === 'MANUAL_VERIFICATION') {
      view_elem.props = step_data;
      view_elem.props.verification_text = sanitize_html_str(update_image_src(step_data.verification_text));
    } else if (element.step_type === 'TIME_REFERENCE') {
      view_elem.props = step_data;
    } else if (element.step_type === 'GDS_MANUAL') {      
      view_elem.props = step_data;
    } else if (element.step_type === 'QUERY_EVR') {
      view_elem.props = step_data;
      view_elem.props.data_path = step_input.data_path;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.end_time = step_input.end_time;
      view_elem.props.duration = step_input.duration;
      view_elem.props.time_type = step_input.time_type;
      view_elem.props.timeout = step_input.timeout;
      
      // Query EVR supports only one EVR. But treat this as single element entry
      // so that the step looks similar to other steps such as Wait EVR
      view_elem.props.entries = [{
        'evr_name': step_data.evr_name,
        'evr_id': step_data.evr_id,
        'evr_type': step_data.evr_type,
        'evr_level': step_data.evr_level,
        'message_filter': step_data.message_filter,
        'total_count': step_data.total_count,
        'condition': get_verification_expression('VALUE', 
          step_data.verification_condition, [step_data.verification_value]),
      }];
      
      if (view_elem.executed) {
        view_elem.props.entries[0]['verification_status'] = view_elem.props['verification_status'];
        view_elem.props.entries[0]['evr_data'] = view_elem.props['evr_data'];
      }
    } else if (element.step_type === 'WAIT_EVR') {
      view_elem.props = step_data;
      view_elem.props.data_path = step_input.data_path;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.lookback = step_input.lookback;
      view_elem.props.timeout = step_input.timeout;      

      view_elem.props.entries.forEach(entry => {  
        entry.condition = to_human_name(entry.verification_condition);
      });
    } else if (element.step_type === 'VERIFY_EHA') {
      view_elem.props = step_data;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.lookback = step_input.lookback;
      view_elem.props.timeout = step_input.timeout;
      
      view_elem.props.entries.forEach(entry => {
        entry.condition = get_verification_expression(entry.verify_on, 
          entry.verification_condition, entry.verification_values);
        entry.display_value = get_eha_display_value(entry.verify_on, entry.dn_eu, entry.dn, entry.eu, entry.actual_value);
      });
    } else if (element.step_type === 'WAIT_EHA') {
      view_elem.props = step_data;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.lookback = step_input.lookback;
      view_elem.props.timeout = step_input.timeout;
      
      view_elem.props.entries.forEach(entry => {
        entry.condition = get_verification_expression(entry.verify_on, 
          entry.verification_condition, entry.verification_values);
        entry.display_value = get_eha_display_value(entry.verify_on, entry.dn_eu, entry.dn, entry.eu, entry.actual_value);
      });
    } else if (element.step_type === 'BUS_1553') {
      view_elem.props = step_data;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.lookback = step_input.lookback;
      view_elem.props.timeout = step_input.timeout;
      view_elem.props.time_type = step_input.time_type;
      view_elem.props.verify_wait = step_input.verify_wait;
      
      view_elem.props.entries.forEach(entry => {
        entry.condition = get_verification_expression(entry.verify_on, 
          entry.verification_condition, entry.verification_values);
      });
    } else if (element.step_type === 'LIST_DATA_PRODUCTS') {
      view_elem.props = step_data;
      view_elem.props.data_path = step_input.data_path;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.end_time = step_input.end_time;
      view_elem.props.duration = step_input.duration;
      view_elem.props.time_type = step_input.time_type;
      view_elem.props.timeout = step_input.timeout;     
      
      view_elem.props.entries.forEach(entry => {
        entry.condition = get_verification_expression('VALUE', 
          entry.verification_condition, [entry.verification_value]);
      });
    } else if (element.step_type === 'WAIT_DATA_PRODUCTS') {
      view_elem.props = step_data;
      view_elem.props.data_path = step_input.data_path;
      view_elem.props.start_time = step_input.start_time;
      view_elem.props.lookback = step_input.lookback;
      view_elem.props.timeout = step_input.timeout;
      
      view_elem.props.entries.forEach(entry => {
        entry.condition = get_verification_expression('VALUE', 
          entry.verification_condition, [entry.verification_value]);
      });
    } else if (element.step_type === 'CMD') {
      view_elem.props = step_data;
    } else if (element.step_type === 'CMD_SSE') {
      view_elem.props = step_data;
    } else if (element.step_type === 'CMD_FILE') {
      view_elem.props = step_data;
    } else if (element.step_type === 'CMD_SCMF') {
      view_elem.props = step_data;
    } else if (element.step_type === 'CUSTOM_SCRIPT') {    
      // copy input values to results when CS step errored since the results may not have the input values.
      if (element.execution && element.execution.meta_data && element.execution.meta_data.status === 'ERROR') {
        const execution_user_input = element.execution_user_input;
        for (const [name, value] of Object.entries(execution_user_input)) {
          if (name === 'inputs') {
            step_data.inputs = value;
          } else if (name === 'entries') {
            if (step_data.entries) {
              for (const [i, entry] of execution_user_input.entries.entries()) {
                if (i < step_data.entries.length) {
                  step_data.entries[i].display_field = entry.display_field;
                  step_data.entries[i].entry_inputs = entry.entry_inputs;
                } else {
                  step_data.entries.push(entry);
                }
              }
            } else {
              step_data.entries = value;
            }
          } else if (name === 'outputs') {
            // keep outputs
          } else if (name === 'output_array') {
            // keep output_array
          } else {
            step_data[name] = value;
          }
        }
      }      

      view_elem.props = step_data;
      if (step_data.output_array && step_data.output_array.outputs && (step_data.output_array.outputs.length > 0)) {
        step_data.output_array.outputs.forEach((output) => {
          output.show_in_pdf = output.visible === "YES";
        });  
                
        const rows = [];
        const num_cols = step_data.output_array.outputs.length;
        const num_rows = step_data.output_array.outputs[0].values ? step_data.output_array.outputs[0].values.length : 0;
        for (let i = 0; i < num_rows; i++) {
          let row = [];
          rows[i] = row;
          for (let j = 0; j < num_cols; j++) {
            if (step_data.output_array.outputs[j].show_in_pdf) {
              row.push(step_data.output_array.outputs[j].values[i]);
            }
          }
        }
        step_data.output_array.rows = rows;
      }
      if (step_data.entries) {
        step_data.entries.forEach((entry) => {
          
          const display_field = entry.display_field ? entry.display_field : '';          
          if (entry.entry_outputs) {
            entry.entry_outputs.forEach((entry_output) => {
              entry_output.show_in_pdf = display_field === '' || display_field === entry_output.name;
            });
          }
          
          if (entry.entry_output_array && entry.entry_output_array.outputs && (entry.entry_output_array.outputs.length > 0)) {
            entry.entry_output_array.outputs.forEach((output) => {
              output.show_in_pdf = output.visible === "YES";
            });            
            
            const rows = [];
            const num_cols = entry.entry_output_array.outputs.length;
            const num_rows = entry.entry_output_array.outputs[0].values ? entry.entry_output_array.outputs[0].values.length : 0;
            for (let i = 0; i < num_rows; i++) {
              let row = [];
              rows[i] = row;
              for (let j = 0; j < num_cols; j++) {
                if (entry.entry_output_array.outputs[j].show_in_pdf) {
                  row.push(entry.entry_output_array.outputs[j].values[i]);
                }
              }
            }
            entry.entry_output_array.rows = rows;
          }          
        });
      }
    } else if (element.step_type === 'VERIFICATION_ITEM') {      
      view_elem.props = step_data;
    } else if (element.step_type === 'VERIFICATION_ITEM_STATUS') {      
      if (step_data.steps) {
        step_data.steps.forEach(step => {
          if (step.status === 'NONE') {
            step.status = '';
          }
        });
      }
      view_elem.props = step_data;     
    } else if (element.step_type === 'VENUE_CONFIG_GET') {
      view_elem.props = step_data;
      view_elem.props.get_all = step_input.get_all;
    } else if (element.step_type === 'VENUE_CONFIG_UPDATE') {      
      view_elem.props = step_data;
    } else if (element.step_type === 'VENUE_CONFIG_CHECK') {
      view_elem.props = step_data;
      view_elem.props.entries.forEach(entry => entry['condition'] = get_verification_expression('VALUE', 
        entry.verification_condition, [entry.verification_value]));
    } else if (element.elem_type === 'PROCEDURE_SECTION') {
      view_elem.props = step_data;
      view_elem.props.child_execution_id = element.child_execution_id;
      const selected_tag_names = [];
      if (step_data.tag_selections) {
        for (const tag_selection of step_data.tag_selections) {
          if (tag_selection.selected) {
            selected_tag_names.push(tag_selection.name);
          }
        }
      }
      view_elem.props.selected_tag_names = selected_tag_names;
    }
    
    view_elems.push(view_elem);
  }
  
  return view_elems;
}

async function get_procedure_info(core_api_url, procedure_id, headers) {
  let url = `${core_api_url}procedures/${procedure_id}`;
  log.debug(`GET url: ${url}`);
  
  try {
    let response = await axios.get(url, {headers: headers});
    return response.data;
  } catch (err) {
    return Promise.reject(funcs.transform_axios_error(err));
  }
}

async function get_version_info(core_api_url, procedure_id, version, headers) {
  let url = `${core_api_url}procedures/${procedure_id}/versions/${version}`;
  try {
    let response = await axios.get(url, {headers: headers});
    return response.data;
  } catch (err) {
    return Promise.reject(funcs.transform_axios_error(err));
  }
}

module.exports.procedure_html = async function procedure_html(ingenium_server, core_api_url, procedure_id, version, options, authorization_header) {
  const headers = {Authorization: authorization_header};
  const params = {limit: 100000};
  
  let procedure_versions = [];
  let elements = [];
  
  let user_name = '';
  try {
    user_name = funcs.parse_username(authorization_header);
  } catch (err) {
    log.warning(`failed to get user_name. err: ${err}`);    
  }  
  
  let procedure_info = null;
  try {
    procedure_info = await get_procedure_info(core_api_url, procedure_id, headers);
  } catch (err) {
    return Promise.reject(err);
  }
  
  if (procedure_info === null) {
    const msg = `procedure was not found. procedure_id: ${procedure_id}`;
    log.error(msg);
    return Promise.reject(msg);
  }  

  if (procedure_info.labels) {
    procedure_info.label_names = procedure_info.labels.map(label => label.name);
    procedure_info.labels_str = procedure_info.label_names.join(', ');
  }
  
  try {
    let url = `${core_api_url}procedures/${procedure_id}/versions`;
    let response = await axios.get(url, {headers: headers, params: params});
    procedure_versions = response.data;
  } catch (err) {
    return Promise.reject(funcs.transform_axios_error(err));
  }
  
  try {
    let url = `${core_api_url}procedures/${procedure_id}/versions/${version}/elements`;
    let response = await axios.get(url, {headers: headers, params: params});
    elements = response.data;
  } catch (err) {
    return Promise.reject(funcs.transform_axios_error(err));
  }
  
  let procedure_version = null;
  for (let i=0; i < procedure_versions.length; i++) {
    if (procedure_versions[i].version === version) {
      procedure_version = procedure_versions[i];   
      break;
    }
  }
  
  if (procedure_version === null) {
    const msg = `procedure_version was not found. procedure_id: ${procedure_id} version: ${version}`;
    log.error(msg);
    return Promise.reject(msg);
  }
  
  // remove the working version  
  for (let i=0; i < procedure_versions.length; i++) {
    if (procedure_versions[i].version === 0) {
      procedure_versions.splice(i, 1); 
      break;
    }
  }  

  const tag_id_name_map = {};
  if (procedure_version.tags) {
    procedure_version.tag_names = procedure_version.tags.map(tag => tag.name);
    procedure_version.tag_names_str = procedure_version.tag_names.join(', ');
        
    for (const tag of procedure_version.tags) {
      tag_id_name_map[tag.tag_id] = tag.name;
    }
  } else {
    procedure_version.tag_names = [];
    procedure_version.tag_names_str = '';
  }

  const view_elems = get_view_elements('PROCEDURE', elements, tag_id_name_map, options);
  
  const proc_data = {
    'PROCEDURE': true,
    'procedure_info': procedure_info,
    'procedure_version': procedure_version,
    'procedure_versions': procedure_versions,
    'version': version,
    'url': `${ingenium_server}/authoring/${procedure_id}/${version}`,
    'pdf_date': new Date(),
    'elements': view_elems
  };
  
  let log_entry = {
    'user_name': user_name,
    'service': 'report_server',
    'procedure_id': procedure_id,
    'version': version
  };
  log.debug('Generate HTML for procedure', log_entry);  
  
  const template_stream = fs.readFileSync(path.join(__dirname, 'procedure.mustache'));
  const template = template_stream.toString();
  
  const html_content = mustache.render(template, proc_data);
  
  const now = new Date();
  
  const elapsed_secs = (new Date() - now) / 1000;
  
  log.debug(`Generated HTML in ${elapsed_secs} seconds`);

  return {html_content, procedure_info, procedure_version};

}

module.exports.execution_html = async function execution_html(ingenium_server, core_api_url, execution_id, options, authorization_header) {
  const headers = {Authorization: authorization_header};
  const params = {limit: 100000};
  
  let elements = [];
  let used_procedures = [];  
  let execution_info = null;
  let user_name = '';
  try {
    user_name = funcs.parse_username(authorization_header);
  } catch (err) {
    log.warning(`failed to get user_name. err: ${err}`);    
  }

  try {
    let url = `${core_api_url}executions/${execution_id}`;
    log.debug(`execution_pdf url: ${url}`);
    let response = await axios.get(url, {headers: headers});
    execution_info = response.data;
  } catch (err) {
    return Promise.reject(funcs.transform_axios_error(err));
  }
  
  try {
    let url = `${core_api_url}executions/${execution_id}/elements`;
    let response = await axios.get(url, {headers: headers, params: params});
    elements = response.data;
  } catch (err) {
    return Promise.reject(funcs.transform_axios_error(err));
  }

  const version_status_map = {};
  for (const element of elements) {
    if (element.elem_type === 'PROCEDURE_SECTION') {
      if (element.imported) {
        const used_procedure = {
          'procedure_id': element.execution_user_input.reference_procedure_id || '',
          'title': element.execution_user_input.reference_procedure_title || '',
          'version': element.execution_user_input.reference_procedure_version || 0,
          'institutional_id': element.execution_user_input.reference_procedure_institutional_id || '',
          'institutional_release_id': element.execution_user_input.reference_procedure_institutional_release_id || '',
          'run_for_record': element.execution_user_input.run_for_score ? 'Yes' : 'No', 
        }

        const version_key = `${used_procedure.procedure_id}:${used_procedure.version}`;
        if (version_status_map.hasOwnProperty(version_key)) {
          used_procedure.version_status = version_status_map[version_key];
        } else {
          try {
            const version_url = `${core_api_url}procedures/${used_procedure.procedure_id}/versions/${used_procedure.version}`;
            log.info(`version_url: ${version_url}`);
            const response = await axios.get(version_url, {headers: headers});
            const version_info = response.data;
            version_status_map[version_key] = version_info.status;
            used_procedure.version_status = version_status_map[version_key];
          } catch (err) {
            return Promise.reject(funcs.transform_axios_error(err));
          }
        }

        used_procedures.push(used_procedure);
      }
    }
  }
  
  if (execution_info.time_started.length > 0 && execution_info.time_completed.length > 0) {
    execution_info.duration = time_diff(execution_info.time_started, execution_info.time_completed);
  }
  
  if (options.activity_report_comment) {
    execution_info.activity_report_content = 
      sanitize_html_str(update_image_src(execution_info.activity_report_content));
  } else {
    execution_info.activity_report_content = '';
  }
  
  if (options.data_review_comment) {
    execution_info.data_review_content = sanitize_html_str(update_image_src(execution_info.data_review_content));
  } else {
    execution_info.data_review_content = '';
  }

  execution_info.status = change_as_run_status(execution_info.status)

  for (const transition of execution_info.transitions) {
    transition.from_status = change_as_run_status(transition.from_status);
    transition.to_status = change_as_run_status(transition.to_status);
  }
  
  const tag_id_name_map = {};
  for (const element of elements) {
    if (element.elem_type === 'PROCEDURE_SECTION') {
      const execution_user_input = element.execution_user_input;
      if (execution_user_input.tag_selections) {
        for (const tag_selection of execution_user_input.tag_selections) {
          tag_id_name_map[tag_selection.tag_id] = tag_selection.name;
        }
      }
    }
  }
    
  // console.log('elements', elements.length);
  // console.log(JSON.stringify(elements, 0, 2));
  
  const view_elems = get_view_elements('EXECUTION', elements, tag_id_name_map, options);
  
  // console.log('view_elems.length', view_elems.length);
  // console.log(JSON.stringify(view_elems, 0, 2));
    
  const proc_data = {
    'EXECUTION': true,
    'execution_info': execution_info,
    'url': `${ingenium_server}/execute/as_run/${execution_id}`,
    'parent_execution_url': execution_info.parent_execution_id ? `${ingenium_server}/execute/as_run/${execution_info.parent_execution_id}`: '',
    'pdf_date': new Date(),
    'elements': view_elems,
    'used_procedures': used_procedures
  };
  
  const template_stream = fs.readFileSync(path.join(__dirname, 'procedure.mustache'));
  const template = template_stream.toString();

  let log_entry = {
    'user_name': user_name,
    'service': 'report_server',
    'execution_id': execution_id
  };
  log.debug('Generate HTML for execution', log_entry);
  
  const now = new Date();
  const html_content = mustache.render(template, proc_data);
  const elapsed_secs = (new Date() - now) / 1000;
  
  log.debug(`Generated HTML in ${elapsed_secs} seconds`);

  return html_content
}

module.exports.procedure_pdf = async function procedure_pdf(ingenium_server, core_api_url, procedure_id, version, options, authorization_header) {
  
  let {html_content, procedure_info, procedure_version} = await module.exports.procedure_html(ingenium_server, core_api_url, procedure_id, version, options, authorization_header);

  const time_versioned = procedure_version.time_versioned ? procedure_version.time_versioned : 'N/A';
  const pbat_info = procedure_info.institutional_id.trim() === '' ?  
    'PBAT#: N/A' : (`P#: ${procedure_info.institutional_id}` + 
    (procedure_version.institutional_release_id.trim() === '' ? '' : ` (Release: ${procedure_version.institutional_release_id})`));
  const pdf_header = `<div style="width: 100%"><p style="${STYLE_STR}">${procedure_id} (Version: ${version} Date: ${time_versioned}) &nbsp; &nbsp; &nbsp;${pbat_info}</p></div>`;
  
  try {
    const time_number = (new Date()).getTime();
    const file_stem_path = path.join(config.OUTPUT_DIR, `${procedure_id}-v${version}-${time_number}`);
    const pdf_buffer = await save_files(file_stem_path, html_content, pdf_header);
    return pdf_buffer    
  } catch (err) {
    log.error(`Failed to generate PDF. procedure_id ${procedure_id} version: ${version} error: ${util.inspect(err)}`);
    return Promise.reject({
      message: err.message
    });
  }

}

module.exports.execution_pdf = async function execution_pdf(ingenium_server, core_api_url, execution_id, options, authorization_header) {
    
  let html_content = await module.exports.execution_html(ingenium_server, core_api_url, execution_id, options, authorization_header);
  
  const pdf_header = `<div style="width: 100%"><p style="${STYLE_STR}">As Run ID: ${execution_id}</p></div>`;
  try {
    const time_number = (new Date()).getTime();
    const file_stem_path = path.join(config.OUTPUT_DIR, `${execution_id}-${time_number}`);
    const pdf_buffer = await save_files(file_stem_path, html_content, pdf_header);
    return pdf_buffer;
  } catch (err) {
    log.error(`Failed to generate PDF. execution_id: ${execution_id} error: ${util.inspect(err)}`);
    return Promise.reject({
      message: err.message
    });
  }

}

async function save_files(file_stem_path, html_content, pdf_header) {
  const html_path = `${file_stem_path}.html`;
  const pdf_path = `${file_stem_path}.pdf`;
  
  const checked = check_output_dir();
  
  if (checked) {
    fs.writeFile(html_path, html_content, 'utf-8', (err) => {
      if (err) {
        log.warning(`Saving HTML file failed: ${err}`);          
      } else {
        log.debug(`Saved HTML file as: ${html_path}`);          
      }
    });    
  }
 
  const pdf_buffer = await module.exports.to_pdf(html_content, pdf_header);

  if (checked) {
    const timestamp = (new Date()).getTime();
    log.debug(`Save PDF file as: ${pdf_path}`);
    fs.writeFile(pdf_path, pdf_buffer, (err) => {
      if (err) {
        log.warning(`Saving PDF file failed: ${err}`);          
      } else {
        log.debug(`Saved PDF file as: ${pdf_path}`);          
      }
    });      
  }

  return pdf_buffer;
}

module.exports.logon = async function logon(ingenium_server) {
  const {username, password} = await inquirer.prompt([
    {name: 'username', message: 'Username:', type: 'input'}, 
    {name: 'password', message: 'Password:', type: 'password'}
  ]);
  
  const login_url = `${ingenium_server}/auth_server/api/v2/login`;
  
  console.log(`login_url: ${login_url}`);

  const options = {auth: {username: username, password: password}};
  
  let response = await axios.get(login_url, options);
  
  const access_token = response.data.access_token;
  
  const authorization_header = `Bearer ${access_token}`;
  return authorization_header;
}

function check_output_dir() {
  if (!fs.existsSync(config.OUTPUT_DIR)) {
    log.warning(`ouput directory does not exist: ${config.OUTPUT_DIR}`);
    return false;
  }

  const files = fs.readdirSync(config.OUTPUT_DIR);
  // latest first
  files.sort(function(a, b) {
    return fs.statSync(path.join(config.OUTPUT_DIR, b)).mtime.getTime() - 
           fs.statSync(path.join(config.OUTPUT_DIR, a)).mtime.getTime();
  });
  
  // log.debug(JSON.stringify(files, 0, 2));
  
  // keep only 20 PDF files
  for (let i=20; i < files.length; i++) {
    let file_path = path.join(config.OUTPUT_DIR, files[i]);
    log.debug(`Delete old PDF file: ${file_path}`);    
    fs.unlinkSync(file_path);
  }
  return true;
}




