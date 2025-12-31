/**
 * 월별 자동 스케줄 배정 스케줄러
 * 매월 1일 00:05에 실행
 */

const cron = require('node-cron');
const { runMonthlyAssignment } = require('../cron/monthly-schedule-assign');

function initMonthlyScheduleScheduler() {
    // 매월 1일 00:05 실행
    cron.schedule('5 0 1 * *', async () => {
        console.log('[MonthlyScheduleScheduler] 월별 스케줄 자동 배정 시작...');
        try {
            const result = await runMonthlyAssignment();
            console.log('[MonthlyScheduleScheduler] 완료:', result);
        } catch (error) {
            console.error('[MonthlyScheduleScheduler] 실패:', error);
        }
    });

    console.log('📅 월별 스케줄 배정 스케줄러 초기화 완료 (매월 1일 00:05 실행)');
}

// 수동 실행용
async function runNow() {
    console.log('[MonthlyScheduleScheduler] 수동 실행 시작...');
    try {
        const result = await runMonthlyAssignment();
        console.log('[MonthlyScheduleScheduler] 수동 실행 완료:', result);
        return result;
    } catch (error) {
        console.error('[MonthlyScheduleScheduler] 수동 실행 실패:', error);
        throw error;
    }
}

module.exports = { initMonthlyScheduleScheduler, runNow };
