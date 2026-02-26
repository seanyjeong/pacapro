/**
 * Push Service
 * 웹 푸시 알림 비즈니스 로직
 */

const webpush = require('web-push');
const db = require('../config/database');
const logger = require('../utils/logger');

// VAPID 설정
webpush.setVapidDetails(
    process.env.VAPID_EMAIL || 'mailto:admin@example.com',
    process.env.VAPID_PUBLIC_KEY,
    process.env.VAPID_PRIVATE_KEY
);

/**
 * 푸시 구독 등록/업데이트 (UPSERT)
 */
async function subscribe(userId, subscription, deviceName) {
    const { endpoint, keys } = subscription;
    const { p256dh, auth } = keys;

    const [existing] = await db.query(
        'SELECT id FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
        [userId, endpoint.substring(0, 255)]
    );

    if (existing.length > 0) {
        await db.query(
            `UPDATE push_subscriptions
             SET p256dh = ?, auth = ?, device_name = ?, updated_at = NOW()
             WHERE id = ?`,
            [p256dh, auth, deviceName || null, existing[0].id]
        );
    } else {
        await db.query(
            `INSERT INTO push_subscriptions (user_id, endpoint, p256dh, auth, device_name)
             VALUES (?, ?, ?, ?, ?)`,
            [userId, endpoint, p256dh, auth, deviceName || null]
        );
    }

    logger.info(`[Push] User ${userId} subscribed (${deviceName || 'unknown device'})`);
    return { message: 'Push subscription registered successfully' };
}

/**
 * 푸시 구독 해제
 */
async function unsubscribe(userId, endpoint) {
    await db.query(
        'DELETE FROM push_subscriptions WHERE user_id = ? AND endpoint = ?',
        [userId, endpoint]
    );
    logger.info(`[Push] User ${userId} unsubscribed`);
    return { message: 'Push subscription removed successfully' };
}

/**
 * 내 구독 목록 조회
 */
async function getSubscriptions(userId) {
    const [subscriptions] = await db.query(
        `SELECT id, device_name, created_at, updated_at
         FROM push_subscriptions
         WHERE user_id = ?
         ORDER BY updated_at DESC`,
        [userId]
    );
    return { message: 'Subscriptions retrieved successfully', subscriptions };
}

/**
 * 테스트 푸시 발송
 */
async function sendTestPush(userId) {
    const [subscriptions] = await db.query(
        'SELECT * FROM push_subscriptions WHERE user_id = ?',
        [userId]
    );

    if (subscriptions.length === 0) {
        return { status: 404, error: 'Not Found', message: '등록된 푸시 구독이 없습니다. 먼저 알림을 허용해주세요.' };
    }

    const payload = JSON.stringify({
        title: 'P-ACA 테스트 알림',
        body: '푸시 알림이 정상적으로 설정되었습니다!',
        icon: '/icons/icon-192x192.png',
        badge: '/icons/icon-72x72.png',
        data: { type: 'test', url: '/' }
    });

    let successCount = 0;
    let failCount = 0;

    for (const sub of subscriptions) {
        const pushSubscription = {
            endpoint: sub.endpoint,
            keys: { p256dh: sub.p256dh, auth: sub.auth }
        };

        try {
            await webpush.sendNotification(pushSubscription, payload);
            successCount++;
        } catch (error) {
            logger.error(`[Push] Failed to send to ${sub.device_name}:`, error.message);
            failCount++;
            if (error.statusCode === 410 || error.statusCode === 404) {
                await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                logger.info(`[Push] Removed expired subscription ${sub.id}`);
            }
        }
    }

    return { status: 200, message: '테스트 알림 발송 완료', success: successCount, failed: failCount };
}

/**
 * 특정 사용자에게 푸시 발송 (다른 모듈에서 사용)
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
            keys: { p256dh: sub.p256dh, auth: sub.auth }
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
            keys: { p256dh: sub.p256dh, auth: sub.auth }
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

module.exports = { subscribe, unsubscribe, getSubscriptions, sendTestPush, sendPushToUser, sendPushToAcademyAdmins };
