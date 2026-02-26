/**
 * 푸시 알림 설정 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const notificationSettingsService = require('../services/notificationSettingsService');
const logger = require('../utils/logger');

router.use(verifyToken);

/** GET /notification-settings */
router.get('/', async (req, res) => {
    try {
        const result = await notificationSettingsService.getSettings(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error('알림 설정 조회 오류:', error);
        res.status(500).json({ error: '알림 설정을 조회하는 중 오류가 발생했습니다.' });
    }
});

/** PUT /notification-settings */
router.put('/', async (req, res) => {
    try {
        const result = await notificationSettingsService.updateSettings(req.user.id, req.body);
        res.json(result);
    } catch (error) {
        logger.error('알림 설정 저장 오류:', error);
        res.status(500).json({ error: '알림 설정을 저장하는 중 오류가 발생했습니다.' });
    }
});

module.exports = router;
