const db = require('../config/database');
// Same settings rows and sender precedence as routes/sms.js (설정 > 알림톡 및 SMS 설정):
// the academy's default solapi sender number, otherwise the settings column.
async function solapiSettings(academyId) {
  const [settings] = await db.execute(`SELECT service_type, solapi_api_key, solapi_api_secret, solapi_sender_phone
    FROM notification_settings WHERE academy_id = ?`, [academyId]);
  const [senders] = await db.execute(`SELECT phone FROM sender_numbers
    WHERE academy_id = ? AND service_type = 'solapi' AND is_default = 1`, [academyId]);
  return { setting: settings[0] || null, defaultSender: senders[0]?.phone || null };
}
module.exports = { solapiSettings };
