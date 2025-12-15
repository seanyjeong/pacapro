/**
 * 푸시 알림 설정 API
 * 사용자별로 어떤 알림을 받을지 설정
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');

// 모든 라우트에 인증 미들웨어 적용
router.use(verifyToken);

/**
 * GET /notification-settings
 * 현재 사용자의 알림 설정 조회
 */
router.get('/', async (req, res) => {
    try {
        const userId = req.user.id;

        const [rows] = await db.query(
            'SELECT unpaid_attendance, consultation_reminder, new_consultation, pause_ending FROM user_notification_settings WHERE user_id = ?',
            [userId]
        );

        if (rows.length === 0) {
            // 설정이 없으면 기본값 반환 (모두 true)
            return res.json({
                settings: {
                    unpaid_attendance: true,
                    consultation_reminder: true,
                    new_consultation: true,
                    pause_ending: true
                }
            });
        }

        res.json({
            settings: {
                unpaid_attendance: !!rows[0].unpaid_attendance,
                consultation_reminder: !!rows[0].consultation_reminder,
                new_consultation: !!rows[0].new_consultation,
                pause_ending: !!rows[0].pause_ending
            }
        });
    } catch (error) {
        console.error('알림 설정 조회 오류:', error);
        res.status(500).json({ error: '알림 설정을 조회하는 중 오류가 발생했습니다.' });
    }
});

/**
 * PUT /notification-settings
 * 알림 설정 업데이트
 */
router.put('/', async (req, res) => {
    try {
        const userId = req.user.id;
        const { unpaid_attendance, consultation_reminder, new_consultation, pause_ending } = req.body;

        // UPSERT: 있으면 업데이트, 없으면 생성
        await db.query(
            `INSERT INTO user_notification_settings (user_id, unpaid_attendance, consultation_reminder, new_consultation, pause_ending)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
                unpaid_attendance = VALUES(unpaid_attendance),
                consultation_reminder = VALUES(consultation_reminder),
                new_consultation = VALUES(new_consultation),
                pause_ending = VALUES(pause_ending)`,
            [userId, unpaid_attendance ?? true, consultation_reminder ?? true, new_consultation ?? true, pause_ending ?? true]
        );

        res.json({
            message: '알림 설정이 저장되었습니다.',
            settings: {
                unpaid_attendance: unpaid_attendance ?? true,
                consultation_reminder: consultation_reminder ?? true,
                new_consultation: new_consultation ?? true,
                pause_ending: pause_ending ?? true
            }
        });
    } catch (error) {
        console.error('알림 설정 저장 오류:', error);
        res.status(500).json({ error: '알림 설정을 저장하는 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
