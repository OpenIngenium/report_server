'use strict';
const proc_export = require('./proc_export');
const fs = require('fs');

/*
Query EVR Example
https://ingenium-open.com/authoring/project-name-procedure-10005/8 // TODO: Update with your server URL
11-1-3-13

Wait EVR Example
https://ingenium-open.com/execute/as_run/project-name-ingenium-10402 // TODO: Update with your server URL
11-5-2-2

*/

function parse_options(args) {
  return {
    'comment': args.includes('--comment'),
    'activity_report_comment': args.includes('--ar-comment'),
    'data_review_comment': args.includes('--dr-comment')
  }
}

async function main() {
  if (process.argv.length < 5) {
    console.log('USAGE: node test.js ingenium_server procedure procedure_id version');
    console.log('USAGE: node test.js ingenium_server execution execution_id');
    console.log('EXAMPLE: node test.js https://ingenium-open.com procedure project-name-procedure-10093 0'); // TODO: Update with your server URL
    console.log('EXAMPLE: node test.js https://ingenium-open.com procedure project-name-procedure-10093 0 --comment'); // TODO: Update with your server URL
    console.log('EXAMPLE: node test.js https://ingenium-open.com execution project-name-ingenium-10748'); // TODO: Update with your server URL
    console.log('EXAMPLE: node test.js https://ingenium-open.com execution project-name-ingenium-10748 --comment --ar-comment --dr-comment'); // TODO: Update with your server URL
    process.exit(-1);
  }
  
  const ingenium_server = process.argv[2];
  const command = process.argv[3];
  const options = parse_options(process.argv);
  
  // console.log('options', options);
  
  const core_api_url = `${ingenium_server}/core_server/api/v5/`;
  
  const authorization_header = await proc_export.logon(ingenium_server);
  
  if (command === 'procedure') {
    const procedure_id = process.argv[4];
    const version = parseInt(process.argv[5]);
    try {
      let pdf_buffer = await proc_export.procedure_pdf(ingenium_server, core_api_url, procedure_id, version, options, authorization_header);
      let file_path = `${procedure_id}-v${version}.pdf`;
      fs.writeFileSync(file_path, pdf_buffer);
    } catch (err) {
      console.log(err);
    }
    
  } else if (command === 'execution') {
    const execution_id = process.argv[4];
    try {
      let pdf_buffer = await proc_export.execution_pdf(ingenium_server, core_api_url, execution_id, options, authorization_header);
      let file_path = `${execution_id}.pdf`;
      fs.writeFileSync(file_path, pdf_buffer);      
    } catch (err) {
      console.log(err);
    }
  }
}

main();