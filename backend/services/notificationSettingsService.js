/**
 * Notification Settings Service
 * 푸시 알림 설정 비즈니스 로직
 */

const db = require('../config/database');

const DEFAULTS = {
    unpaid_attendance: true,
    consultation_reminder: true,
    new_consultation: true,
    pause_ending: true
};

/**
 * 알림 설정 조회
 */
async function getSettings(userId) {
    const [rows] = await db.query(
        'SELECT unpaid_attendance, consultation_reminder, new_consultation, pause_ending FROM user_notification_settings WHERE user_id = ?',
        [userId]
    );

    if (rows.length === 0) {
        return { settings: { ...DEFAULTS } };
    }

    return {
        settings: {
            unpaid_attendance: !!rows[0].unpaid_attendance,
            consultation_reminder: !!rows[0].consultation_reminder,
            new_consultation: !!rows[0].new_consultation,
            pause_ending: !!rows[0].pause_ending
        }
    };
}

/**
 * 알림 설정 업데이트 (UPSERT)
 */
async function updateSettings(userId, body) {
    const { unpaid_attendance, consultation_reminder, new_consultation, pause_ending } = body;

    const values = {
        unpaid_attendance: unpaid_attendance ?? true,
        consultation_reminder: consultation_reminder ?? true,
        new_consultation: new_consultation ?? true,
        pause_ending: pause_ending ?? true
    };

    await db.query(
        `INSERT INTO user_notification_settings (user_id, unpaid_attendance, consultation_reminder, new_consultation, pause_ending)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
            unpaid_attendance = VALUES(unpaid_attendance),
            consultation_reminder = VALUES(consultation_reminder),
            new_consultation = VALUES(new_consultation),
            pause_ending = VALUES(pause_ending)`,
        [userId, values.unpaid_attendance, values.consultation_reminder, values.new_consultation, values.pause_ending]
    );

    return { message: '알림 설정이 저장되었습니다.', settings: values };
}

module.exports = { getSettings, updateSettings };
