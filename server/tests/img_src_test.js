'use strict';

const fs = require('fs');
const path = require('path');

const ING_SERVER = 'https://ingenium-open.com'; // TODO: Update with your server URL
const FILE_SERVER_API_HOST = 'https://s3-us-gov-west-1.amazonaws.com';

function update_image_src(html_str) {
  html_str = html_str.split(`src="${ING_SERVER}/file_server/`).join('src="/file_server/');
  html_str = html_str.split(`src="/file_server/`).join(`src="${FILE_SERVER_API_HOST}/`);
  return html_str;
}

function main() {

  const html_str = fs.readFileSync(path.join(__dirname, 'input.txt'), 'utf8');

  let out_str = update_image_src(html_str);
  
  fs.writeFileSync(path.join(__dirname, 'output.txt'), out_str);

}

main();