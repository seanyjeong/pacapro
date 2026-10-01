const cron = require('node-cron');
const logger = require('../utils/logger');
const { graduateDueSeasonStudents } = require('../services/seasonGraduationService');

function initSeasonLifecycleScheduler() {
    const run = () => graduateDueSeasonStudents().then(
        (count) => logger.info(`[SeasonLifecycle] 자동 졸업 ${count}명`),
        (error) => logger.error('[SeasonLifecycle] 자동 졸업 실패', error)
    );

    cron.schedule('0 0 * * *', run, { timezone: 'Asia/Seoul' });
    void run();
    logger.info('[SeasonLifecycle] 매일 00:00 KST 졸업 처리 등록');
}

module.exports = { initSeasonLifecycleScheduler };
