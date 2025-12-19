/**
 * 알림톡 자동 발송 스케줄러
 *
 * 변경사항 (2025-12-19):
 * - 기존 날짜 기반 발송 (auto_send_day, auto_send_days) 제거
 * - 수업일 기반 발송으로 전환 (n8n 워크플로우 사용)
 *
 * 자동 발송은 이제 n8n 워크플로우에서 처리:
 * - 솔라피: POST /paca/notifications/send-unpaid-today-auto
 * - 솔라피 체험수업: POST /paca/notifications/send-trial-today-auto
 * - SENS: POST /paca/notifications/send-unpaid-today-auto-sens
 * - SENS 체험수업: POST /paca/notifications/send-trial-today-auto-sens
 *
 * 이 스케줄러는 더 이상 자동 발송을 하지 않지만,
 * 기존 코드와의 호환성을 위해 빈 스케줄러로 유지됩니다.
 */

const cron = require('node-cron');

/**
 * 스케줄러 초기화 (빈 스케줄러)
 * 실제 발송은 n8n 워크플로우에서 처리
 */
function initNotificationScheduler() {
    console.log('📨 알림톡 스케줄러 초기화 완료 (n8n 워크플로우로 이관됨)');
    console.log('   - 솔라피 미납자: /send-unpaid-today-auto');
    console.log('   - 솔라피 체험수업: /send-trial-today-auto');
    console.log('   - SENS 미납자: /send-unpaid-today-auto-sens');
    console.log('   - SENS 체험수업: /send-trial-today-auto-sens');
}

/**
 * 빈 함수 (레거시 호환성)
 */
async function sendScheduledNotifications() {
    console.log('[NotificationScheduler] 이 기능은 n8n 워크플로우로 이관되었습니다.');
}

module.exports = {
    initNotificationScheduler,
    sendScheduledNotifications
};
