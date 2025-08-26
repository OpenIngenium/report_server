/* eslint-disable no-unused-vars */
const bullmq = require('bullmq');
const path = require('path');

const Service = require('./Service');
const log = require('../logger');
const funcs = require('../funcs');
const config = require('../config');

const diff_report_queue = new bullmq.Queue('diff_report_queue', {
  connection: {
    port: config.REDIS_PORT, 
    host: config.REDIS_HOST
  }
});

async function reset_queue() {
  const before_job_count = await diff_report_queue.getJobCountByTypes();
  log.info(`job count before resetting queue: ${before_job_count}`);
  log.info('resetting queue');
  await diff_report_queue.pause();
  await diff_report_queue.clean(0, 0, 'completed');
  await diff_report_queue.clean(0, 0, 'failed');
  await diff_report_queue.clean(0, 0, 'active');
  await diff_report_queue.clean(0, 0, 'delayed');
  await diff_report_queue.clean(0, 0, 'paused');
  await diff_report_queue.resume();
  const after_job_count = await diff_report_queue.getJobCountByTypes();
  log.info(`job count after resetting queue: ${after_job_count}`);
}

async function init_queue() {
  // remove old jobs
  await reset_queue();

  // register event listeners
  diff_report_queue.on('error', function(error) {
    log.error(`Error: ${error}`);
  });
  
  diff_report_queue.on('waiting', function(job){
    log.info(`Waiting in Queue JobID: ${job.id}`);
  });
  
  diff_report_queue.on('active', async function(job, jobPromise){
    log.info(`Active in Queue JobID: ${job.id}`);
    let count = await job.queue.getJobCounts();
    log.info(`job count: ${count}`);
  });
  
  diff_report_queue.on('stalled', async function(job){
    log.info(`Stalled in Queue JobID: ${job.id}`);
    let count = await job.queue.getJobCounts();
    log.info(`job count: ${count}`);
  });
  
  diff_report_queue.on('completed', async function(job, result){
    log.info(`Completed in Queue JobID: ${job.id}. Result: ${result}`);
    let count = await job.queue.getJobCounts();
    log.info(`job count: ${count}`);
  });
  
  diff_report_queue.on('failed', async function(job, err){
    log.info(`Failed in Queue JobID: ${job.id}. Error: ${err}`);
    let count = await job.queue.getJobCounts();
    log.info(`job count: ${count}`);
  });

  // add workers
  const processor_file = path.join(__dirname, '/diff_report/process_diff.js');
  log.info(`NUM_WORKERS: ${config.NUM_WORKERS} processor_file: ${processor_file}`);
  for (let i=0; i < config.NUM_WORKERS; i++) {
    const worker = new bullmq.Worker('diff_report_queue', processor_file, {
      connection: {
        port: config.REDIS_PORT, 
        host: config.REDIS_HOST
      }
    });
    worker.on('completed', job => {
      log.info(`worker ${i}: JobId ${job.id} has completed!`);
    });
    worker.on('failed', (job, err) => {
      log.info(`worker ${i}: JobId ${job.id} has failed with ${err.message}`);
    });  
  }
}

// initialze job queue for diff reports
init_queue();

class DifferenceReportService {

  /**
   * Difference Report Request
   *
   * base_type String The type of the report only following value accepted PROCEDURE/EXECUTION
   * base_id String The id of the procedure/execution 
   * base_version Integer The version of procedure (optional)
   * target_type String The type of the report only following value accepted PROCEDURE/EXECUTION
   * target_id String The id of the procedure/execution 
   * target_version Integer The version of procedure (optional)
   * returns report_id and message
   **/

  static async get_difference_report({base_type, base_id, base_version, target_type, target_id, target_version, authorization_header}) {
    let user_name = '';
    try {
      user_name = funcs.parse_username(authorization_header);
    } catch (err) {
      log.warning(`failed to get user_name. err: ${err}`);    
    }
    try {
      const job_counts = await diff_report_queue.getJobCounts('completed', 'failed', 'active', 'delayed', 'paused', 'repeat');
      log.info(`job_counts: ${JSON.stringify(job_counts)}`);

      const active_count = await diff_report_queue.getActiveCount();
      log.info(`active_count: ${active_count}`);

      const waiting_count = await diff_report_queue.getWaitingCount();
      log.info(`waiting_count: ${waiting_count}`);

      const job = await diff_report_queue.add('diff_report', 
        {base_type, base_id, base_version, target_type, target_id, target_version, active_count, waiting_count, authorization_header, user_name},
        {attempts: 1}
      );

      log.info(`submitted job.id: ${job.id}`)

      return Service.successResponse({'report_id': job.id, 'message':'Diffing Report Request Accepted'}, 202)
    } catch (err) {
      return Service.rejectResponse(
        `Failed to accept request for difference report`,
        err,
        400
      );
    }
  }
}

module.exports = DifferenceReportService;
