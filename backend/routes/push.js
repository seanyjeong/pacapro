/**
 * Push Routes
 * 웹 푸시 알림 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const pushService = require('../services/pushService');
const logger = require('../utils/logger');

/** GET /paca/push/vapid-public-key */
router.get('/vapid-public-key', (req, res) => {
    res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

/** POST /paca/push/subscribe */
router.post('/subscribe', verifyToken, async (req, res) => {
    try {
        const { subscription, deviceName } = req.body;
        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({ error: 'Validation Error', message: 'Invalid subscription data' });
        }
        const result = await pushService.subscribe(req.user.id, subscription, deviceName);
        res.json(result);
    } catch (error) {
        logger.error('Error subscribing to push:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to register push subscription' });
    }
});

/** DELETE /paca/push/subscribe */
router.delete('/subscribe', verifyToken, async (req, res) => {
    try {
        const { endpoint } = req.body;
        if (!endpoint) {
            return res.status(400).json({ error: 'Validation Error', message: 'Endpoint is required' });
        }
        const result = await pushService.unsubscribe(req.user.id, endpoint);
        res.json(result);
    } catch (error) {
        logger.error('Error unsubscribing from push:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to remove push subscription' });
    }
});

/** GET /paca/push/subscriptions */
router.get('/subscriptions', verifyToken, async (req, res) => {
    try {
        const result = await pushService.getSubscriptions(req.user.id);
        res.json(result);
    } catch (error) {
        logger.error('Error fetching subscriptions:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch subscriptions' });
    }
});

/** POST /paca/push/test */
router.post('/test', verifyToken, async (req, res) => {
    try {
        const result = await pushService.sendTestPush(req.user.id);
        if (result.status !== 200) {
            return res.status(result.status).json({ error: result.error, message: result.message });
        }
        res.json({ message: result.message, success: result.success, failed: result.failed });
    } catch (error) {
        logger.error('Error sending test push:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to send test push' });
    }
});

// 유틸 함수 re-export (다른 모듈에서 사용)
module.exports = router;
module.exports.sendPushToUser = pushService.sendPushToUser;
module.exports.sendPushToAcademyAdmins = pushService.sendPushToAcademyAdmins;
