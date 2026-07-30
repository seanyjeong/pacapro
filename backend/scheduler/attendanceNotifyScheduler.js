/**
 * 출결 알림톡 지연/일괄 발송 스케줄러
 * - attendance_send_mode = after_class_start 큐를 매분 처리
 */

const cron = require('node-cron');
const { processAttendanceNotificationQueue } = require('../utils/attendanceNotify');

function initAttendanceNotifyScheduler() {
    // 매분 실행 (KST 서버 기준)
    cron.schedule('* * * * *', async () => {
        try {
            await processAttendanceNotificationQueue();
        } catch (err) {
            console.error('[AttendanceNotifyScheduler] queue process failed:', err.message);
        }
    });

    console.log('[AttendanceNotifyScheduler] initialized — every minute');
}

module.exports = { initAttendanceNotifyScheduler };
