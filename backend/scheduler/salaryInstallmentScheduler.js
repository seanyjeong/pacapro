/**
 * 분할 지급 달이 되면 출근이 없는 강사도 급여 명세서를 만든다. 매일 00:15 (KST).
 */
const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');
const { inTransaction, createInstallmentSalaries } = require('../services/salaryService');

function startSalaryInstallmentScheduler() {
    cron.schedule('15 0 * * *', async () => {
        try {
            const created = await inTransaction(db, conn => createInstallmentSalaries(conn));
            if (created > 0) logger.info(`[SalaryInstallmentScheduler] 급여 명세서 ${created}건 생성`);
        } catch (error) {
            logger.error('[SalaryInstallmentScheduler] 오류:', error);
        }
    }, { timezone: 'Asia/Seoul' });
    logger.info('[SalaryInstallmentScheduler] 스케줄러 시작됨 (매일 00:15 KST)');
}

module.exports = { startSalaryInstallmentScheduler };
