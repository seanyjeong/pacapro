const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');
const { createAdmissionService } = require('../services/ilsanAdmissionService');
function initIlsanAdmissionScheduler() {
  const service = createAdmissionService(pool);
  let running = false;
  const run = async () => {
    if (running) return;
    running = true;
    try {
      const result = await service.activateDue();
      if (result.enrolled || result.review) logger.info('[IlsanAdmissions] scheduled enrollment', result);
    } catch (error) { logger.error('[IlsanAdmissions] scheduler failed', {code:error.code || 'INTERNAL'}); }
    finally { running = false; }
  };
  cron.schedule('* * * * *', run, {timezone:'Asia/Seoul'});
  void run();
}
module.exports = { initIlsanAdmissionScheduler };
