/**
 * routes/notifications/send/webhooks.js
 *
 * verifyToken 무적용 webhook endpoint 4건을 기능별 파일로 마운트한다.
 * 각 endpoint는 X-API-Key를 자체 검증한다.
 */

module.exports = function(router) {
    require('./webhookUnpaidTodaySens')(router);
    require('./webhookTrialTodaySens')(router);
    require('./webhookReminderSolapi')(router);
    require('./webhookReminderSens')(router);
};
