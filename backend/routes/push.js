const express = require('express');
const router = express.Router();
const webpush = require('web-push');
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

// VAPID 설정
webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * GET /paca/push/vapid-public-key
 * VAPID 공개키 조회 (클라이언트에서 푸시 구독 시 필요)
 */
router.get('/vapid-public-key', (req, res) => {
    res.json({
        publicKey: process.env.VAPID_PUBLIC_KEY
    });
});

/**
 * POST /paca/push/subscribe
 * 푸시 알림 구독 등록
 */
router.post('/subscribe', verifyToken, async (req, res) => {
    try {
        const { subscription, deviceName } = req.body;

        if (!subscription || !subscription.endpoint || !subscription.keys) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid subscription data'
            });
        }

        const { endpoint, keys } = subscription;
        const { p256dh, auth } = keys;

        // 기존 구독 확인 (같은 endpoint면 업데이트)
        const [existing] = await db.query(
            'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
            [req.user.id, endpoint.substring(0, 255)]
        );

        if (existing.length > 0) {
            // 업데이트
            await db.query(
                `UPDATE push_subscriptions
                 SET p256dh = ?, auth = ?, device_name = ?, updated_at = NOW()
                 WHERE id = ?`,
                [p256dh, auth, deviceName || null, existing[0].id]
            );
        } else {
            // 새로 등록
            await db.query(
                `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name)
                 VALUES (?, ?, ?, ?, ?)`,
                [req.user.id, endpoint, p256dh, auth, deviceName || null]
            );
        }

        logger.info(`[Push] User ${req.user.id} subscribed (${deviceName || 'unknown device'})`);

        res.json({
            message: 'Push subscription registered successfully'
        });
    } catch (error) {
        logger.error('Error subscribing to push:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to register push subscription'
        });
    }
});

/**
 * DELETE /paca/push/subscribe
 * 푸시 알림 구독 해제
 */
router.delete('/subscribe', verifyToken, async (req, res) => {
    try {
        const { endpoint } = req.body;

        if (!endpoint) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Endpoint is required'
            });
        }

        await db.query(
            'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
            [req.user.id, endpoint]
        );

        logger.info(`[Push] User ${req.user.id} unsubscribed`);

        res.json({
            message: 'Push subscription removed successfully'
        });
    } catch (error) {
        logger.error('Error unsubscribing from push:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to remove push subscription'
        });
    }
});

/**
 * GET /paca/push/subscriptions
 * 내 구독 목록 조회
 */
router.get('/subscriptions', verifyToken, async (req, res) => {
    try {
        const [subscriptions] = await db.query(
            `SELECT id, device_name, created_at, updated_at
             FROM push_subscriptions
             WHERE user_id = ?
             ORDER BY updated_at DESC`,
            [req.user.id]
        );

        res.json({
            message: 'Subscriptions retrieved successfully',
            subscriptions
        });
    } catch (error) {
        logger.error('Error fetching subscriptions:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch subscriptions'
        });
    }
});

/**
 * POST /paca/push/test
 * 테스트 푸시 발송
 */
router.post('/test', verifyToken, async (req, res) => {
    try {
        const [subscriptions] = await db.query(
            'SELECT * FROM push_subscriptions WHERE user_id = ?',
            [req.user.id]
        );

        if (subscriptions.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '등록된 푸시 구독이 없습니다. 먼저 알림을 허용해주세요.'
            });
        }

        const payload = JSON.stringify({
            title: 'P-ACA 테스트 알림',
            body: '푸시 알림이 정상적으로 설정되었습니다!',
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'test',
                url: '/'
            }
        });

        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, payload);
                successCount++;
            } catch (error) {
                logger.error(`[Push] Failed to send to ${sub.device_name}:`, error.message);
                failCount++;

                // 만료된 구독은 삭제
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                    logger.info(`[Push] Removed expired subscription ${sub.id}`);
                }
            }
        }

        res.json({
            message: `테스트 알림 발송 완료`,
            success: successCount,
            failed: failCount
        });
    } catch (error) {
        logger.error('Error sending test push:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to send test push'
        });
    }
});

/**
 * 푸시 알림 발송 유틸리티 함수 (다른 모듈에서 사용)
 */
async function sendPushToUser(userId, payload) {
    const [subscriptions] = await db.query(
        'SELECT * FROM push_subscriptions WHERE user_id = ?',
        [userId]
    );

    const results = { success: 0, failed: 0 };

    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        };

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            results.success++;
        } catch (error) {
            results.failed++;
            if (error.statusCode === 410 || error.statusCode === 404) {
                await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
            }
        }
    }

    return results;
}

/**
 * 학원의 모든 관리자에게 푸시 발송
 */
async function sendPushToAcademyAdmins(academyId, payload) {
    const [admins] = await db.query(
        `SELECT DISTINCT ps.*
         FROM push_subscriptions ps
         JOIN users u ON ps.user_id = u.id
         WHERE u.academy_id = ? AND u.role IN ('owner', 'admin')`,
        [academyId]
    );

    const results = { success: 0, failed: 0 };

    for (const sub of admins) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: {
                p256dh: sub.p256dh,
                auth: sub.auth
            }
        };

        try {
            await webpush.sendNotification(pushSubscription, JSON.stringify(payload));
            results.success++;
        } catch (error) {
            results.failed++;
            if (error.statusCode === 410 || error.statusCode === 404) {
                await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
            }
        }
    }

    return results;
}

module.exports = router;
module.exports.sendPushToUser = sendPushToUser;
module.exports.sendPushToAcademyAdmins = sendPushToAcademyAdmins;
