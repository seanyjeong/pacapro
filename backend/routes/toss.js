/**
 * 토스플레이스 연동 API
 * P-ACA 학원비 결제 시스템과 토스 프론트/터미널 연동
 *
 * 보안 고려사항:
 * - API 키 인증 (X-Toss-Plugin-Key)
 * - 콜백 서명 검증 (HMAC-SHA256)
 * - 타임스탬프 검증 (리플레이 공격 방지)
 * - 학원 ID 검증 (멀티테넌시)
 * - 민감정보 복호화 처리
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { decrypt, encrypt } = require('../utils/encryption');
const crypto = require('crypto');
const { verifyToken, checkPermission, checkAcademyAccess } = require('../middleware/auth');
const logger = require('../utils/logger');

// ============================================
// 설정 상수
// ============================================
// 주의: 기본값 제거됨! 프로덕션에서는 반드시 환경변수 설정 필요
const TOSS_PLUGIN_API_KEY = process.env.TOSS_PLUGIN_API_KEY;
const CALLBACK_TIMESTAMP_TOLERANCE = 5 * 60 * 1000; // 5분

// 토스 플러그인 API 키 미설정 경고
if (!TOSS_PLUGIN_API_KEY) {
    logger.warn('[TOSS] ⚠️ TOSS_PLUGIN_API_KEY 미설정. 토스 연동이 작동하지 않습니다.');
}

// ============================================
// 보안 미들웨어
// ============================================

/**
 * 토스 플러그인 API 키 인증
 * 토스 프론트 플러그인에서 호출하는 API용
 */
const verifyTossPlugin = async (req, res, next) => {
    const apiKey = req.headers['x-toss-plugin-key'];
    const academyId = req.headers['x-academy-id'] || req.query.academy_id;

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'API 키가 필요합니다.'
        });
    }

    // 전역 API 키 확인
    if (apiKey === TOSS_PLUGIN_API_KEY) {
        req.tossAuth = {
            type: 'global',
            academyId: parseInt(academyId) || null
        };
        return next();
    }

    // 학원별 API 키 확인
    if (academyId) {
        try {
            const [settings] = await db.query(
                `SELECT * FROM toss_settings
                 WHERE academy_id = ? AND is_active = 1`,
                [academyId]
            );

            if (settings.length > 0 && settings[0].plugin_api_key === apiKey) {
                req.tossAuth = {
                    type: 'academy',
                    academyId: parseInt(academyId),
                    settings: settings[0]
                };
                return next();
            }
        } catch (error) {
            logger.error('[Toss] API Key verification error:', error);
        }
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '유효하지 않은 API 키입니다.'
    });
};

/**
 * 콜백 서명 검증 (보안 강화)
 * 토스에서 결제 완료 시 호출하는 콜백 검증
 */
const verifyCallbackSignature = async (req, res, next) => {
    const signature = req.headers['x-toss-signature'];
    const timestamp = req.headers['x-toss-timestamp'];
    const academyId = req.body.metadata?.academyId;
    const isDev = process.env.NODE_ENV === 'development';

    // 1. 타임스탬프 검증 (리플레이 공격 방지)
    if (timestamp) {
        const requestTime = parseInt(timestamp);
        const now = Date.now();
        if (Math.abs(now - requestTime) > CALLBACK_TIMESTAMP_TOLERANCE) {
            logger.warn('[Toss] Callback timestamp expired:', {
                requestTime,
                now,
                diff: now - requestTime
            });
            // 프로덕션에서는 거부, 개발에서는 경고만
            if (!isDev) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    message: '타임스탬프가 만료되었습니다.'
                });
            }
        }
    }

    // 2. 서명 검증 (학원별 callback_secret 설정된 경우)
    if (signature && academyId) {
        try {
            const [settings] = await db.query(
                `SELECT callback_secret FROM toss_settings WHERE academy_id = ?`,
                [academyId]
            );

            if (settings.length > 0 && settings[0].callback_secret) {
                const secret = settings[0].callback_secret;
                const payload = JSON.stringify(req.body);
                const expectedSignature = crypto
                    .createHmac('sha256', secret)
                    .update(payload)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    logger.error('[Toss] Invalid callback signature for academy:', academyId);
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden',
                        message: '서명 검증 실패'
                    });
                }
                logger.info('[Toss] Callback signature verified for academy:', academyId);
            }
        } catch (error) {
            logger.error('[Toss] Signature verification error:', error);
        }
    }

    // 3. 요청 로깅 (보안 감사용)
    logger.info('[Toss] Callback received:', {
        orderId: req.body.orderId,
        amount: req.body.amount,
        academyId: academyId,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        ip: req.ip
    });

    next();
};

// ============================================
// 플러그인용 API (토스 프론트에서 호출)
// ============================================

/**
 * GET /paca/toss/unpaid
 * 미납자 목록 조회 (토스 프론트 플러그인용)
 *
 * Query: academy_id (필수)
 * Headers: X-Toss-Plugin-Key (필수)
 */
router.get('/unpaid', verifyTossPlugin, async (req, res) => {
    try {
        const academyId = req.tossAuth.academyId || req.query.academy_id;

        if (!academyId) {
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: 'academy_id가 필요합니다.'
            });
        }

        // 미납/부분납 학생 조회
        const [payments] = await db.query(
            `SELECT
                p.id as payment_id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.grade,
                s.school,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.final_amount,
                p.paid_amount,
                (p.final_amount - COALESCE(p.paid_amount, 0)) as remaining_amount,
                p.due_date,
                p.payment_status,
                p.description
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.academy_id = ?
            AND p.payment_status IN ('pending', 'partial')
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            ORDER BY p.due_date ASC, p.final_amount DESC`,
            [academyId]
        );

        // 학생 이름 복호화
        const decryptedPayments = payments.map(p => {
            try {
                return {
                    ...p,
                    student_name: decrypt(p.student_name),
                    // 민감정보는 마스킹
                    display_name: maskName(decrypt(p.student_name))
                };
            } catch (e) {
                return {
                    ...p,
                    student_name: p.student_name,
                    display_name: p.student_name
                };
            }
        });

        // 통계 계산
        const stats = {
            totalCount: decryptedPayments.length,
            totalAmount: decryptedPayments.reduce((sum, p) => sum + parseFloat(p.remaining_amount), 0),
            pendingCount: decryptedPayments.filter(p => p.payment_status === 'pending').length,
            partialCount: decryptedPayments.filter(p => p.payment_status === 'partial').length
        };

        res.json({
            success: true,
            stats,
            payments: decryptedPayments
        });

    } catch (error) {
        logger.error('[Toss] Error fetching unpaid:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '미납 목록 조회 실패'
        });
    }
});

/**
 * GET /paca/toss/student/:id
 * 특정 학생 결제 정보 조회 (플러그인용)
 */
router.get('/student/:id', verifyTossPlugin, async (req, res) => {
    try {
        const studentId = parseInt(req.params.id);
        const academyId = req.tossAuth.academyId || req.query.academy_id;

        const [payments] = await db.query(
            `SELECT
                p.id as payment_id,
                p.year_month,
                p.payment_type,
                p.final_amount,
                p.paid_amount,
                (p.final_amount - COALESCE(p.paid_amount, 0)) as remaining_amount,
                p.payment_status,
                p.due_date
            FROM student_payments p
            WHERE p.student_id = ?
            AND p.academy_id = ?
            AND p.payment_status IN ('pending', 'partial')
            ORDER BY p.year_month DESC`,
            [studentId, academyId]
        );

        res.json({
            success: true,
            payments
        });

    } catch (error) {
        logger.error('[Toss] Error fetching student payments:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '학생 결제 정보 조회 실패'
        });
    }
});

// ============================================
// 결제 콜백 API (토스에서 호출)
// ============================================

/**
 * POST /paca/toss/payment-callback
 * 토스 결제 완료 콜백 수신
 *
 * 보안: 서명 검증 + 타임스탬프 검증
 */
router.post('/payment-callback', verifyCallbackSignature, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            orderId,           // 주문번호: PACA-{payment_id}-{timestamp}
            paymentKey,        // 토스 결제 키
            amount,            // 결제 금액
            status,            // 결제 상태 (DONE, CANCELED 등)
            method,            // 결제 수단 (CARD, CASH 등)
            approvedAt,        // 승인 시간
            receipt,           // 영수증 정보
            card,              // 카드 정보
            metadata           // 커스텀 메타데이터
        } = req.body;

        logger.info('[Toss] Payment callback received:', {
            orderId,
            paymentKey,
            amount,
            status,
            method
        });

        // 중복 처리 방지
        const [existing] = await connection.query(
            `SELECT id FROM toss_payment_history WHERE payment_key = ?`,
            [paymentKey]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.json({
                success: true,
                message: '이미 처리된 결제입니다.',
                duplicate: true
            });
        }

        // 주문번호 파싱: PACA-{payment_id}-{timestamp}
        const orderIdMatch = orderId.match(/^PACA-(\d+)-(\d+)$/);
        const academyId = metadata?.academyId;

        // 학원 ID 필수 검증 (기본값 1 제거!)
        if (!academyId) {
            logger.warn('[Toss] Academy ID missing in callback:', orderId);
            // 대기열에 추가 (수동 확인 필요)
            await connection.query(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, receipt_url, card_company, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [
                    orderId,
                    paymentKey,
                    amount,
                    method,
                    approvedAt ? new Date(approvedAt) : null,
                    receipt?.url,
                    card?.company,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    '학원 ID 누락 - 수동 확인 필요'
                ]
            );
            await connection.commit();
            return res.json({
                success: true,
                matched: false,
                message: '결제 수신 완료 (학원 ID 확인 필요)',
                queueReason: 'ACADEMY_ID_MISSING'
            });
        }

        if (!orderIdMatch) {
            // 자동 매칭 실패 → 수동 확인 대기열에 추가
            await connection.query(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, receipt_url, card_company, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [
                    academyId,
                    orderId,
                    paymentKey,
                    amount,
                    method,
                    approvedAt ? new Date(approvedAt) : null,
                    receipt?.url,
                    card?.company,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    '주문번호 형식 불일치'
                ]
            );

            await connection.commit();

            logger.info('[Toss] Payment added to queue (format mismatch):', orderId);

            return res.json({
                success: true,
                matched: false,
                message: '결제 수신 완료 (수동 매칭 필요)',
                queueReason: 'ORDER_ID_FORMAT'
            });
        }

        const paymentId = parseInt(orderIdMatch[1]);

        // P-ACA 결제 레코드 조회
        const [existingPayment] = await connection.query(
            `SELECT * FROM student_payments WHERE id = ? AND academy_id = ?`,
            [paymentId, academyId]
        );

        if (existingPayment.length === 0) {
            // 결제 ID 불일치 → 대기열 추가
            await connection.query(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, receipt_url, card_company, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'error', ?)`,
                [
                    academyId,
                    orderId,
                    paymentKey,
                    amount,
                    method,
                    approvedAt ? new Date(approvedAt) : null,
                    receipt?.url,
                    card?.company,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    `Payment ID ${paymentId} not found`
                ]
            );

            await connection.commit();

            logger.info('[Toss] Payment added to queue (ID not found):', paymentId);

            return res.json({
                success: true,
                matched: false,
                message: '결제 ID를 찾을 수 없습니다.',
                queueReason: 'PAYMENT_NOT_FOUND'
            });
        }

        const payment = existingPayment[0];
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const newPaidAmount = currentPaidAmount + parseFloat(amount);
        const finalAmount = parseFloat(payment.final_amount);
        const remainingAmount = finalAmount - newPaidAmount;
        const newStatus = remainingAmount <= 0 ? 'paid' : 'partial';

        // 결제 방법 매핑
        const paymentMethodMap = {
            'CARD': 'card',
            'CASH': 'cash',
            'TRANSFER': 'account',
            'MOBILE': 'other',
            'OTHER': 'other'
        };

        // student_payments 업데이트
        await connection.query(
            `UPDATE student_payments SET
                paid_amount = ?,
                payment_status = ?,
                payment_method = ?,
                paid_date = ?,
                notes = CONCAT(IFNULL(notes, ''), ?)
            WHERE id = ?`,
            [
                newPaidAmount,
                newStatus,
                paymentMethodMap[method] || 'card',
                approvedAt ? new Date(approvedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                `\n[토스] ${amount.toLocaleString()}원 결제 (${new Date().toLocaleString('ko-KR')})`,
                paymentId
            ]
        );

        // 토스 결제 이력 저장
        await connection.query(
            `INSERT INTO toss_payment_history (
                payment_id, academy_id, order_id, payment_key, amount, method,
                approved_at, receipt_url, card_company, card_number,
                installment_months, status, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                paymentId,
                academyId,
                orderId,
                paymentKey,
                amount,
                method,
                approvedAt ? new Date(approvedAt) : null,
                receipt?.url,
                card?.company,
                card?.number,
                card?.installmentPlanMonths || 0,
                status,
                JSON.stringify(req.body)
            ]
        );

        await connection.commit();

        logger.info('[Toss] Payment matched successfully:', {
            paymentId,
            amount,
            newStatus,
            newPaidAmount
        });

        res.json({
            success: true,
            matched: true,
            paymentId,
            studentPaymentStatus: newStatus,
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(0, remainingAmount)
        });

    } catch (error) {
        await connection.rollback();
        logger.error('[Toss] Error processing callback:', error);

        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '결제 처리 실패'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /paca/toss/cancel-callback
 * 토스 결제 취소 콜백 수신
 *
 * 토스 터미널/프론트에서 취소 시 호출됨
 */
router.post('/cancel-callback', verifyCallbackSignature, async (req, res) => {
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        const {
            orderId,           // 주문번호: PACA-{payment_id}-{timestamp}
            paymentKey,        // 토스 결제 키
            cancelAmount,      // 취소 금액
            cancelReason,      // 취소 사유
            canceledAt,        // 취소 시간
            metadata           // 커스텀 메타데이터
        } = req.body;

        logger.info('[Toss] Cancel callback received:', {
            orderId,
            paymentKey,
            cancelAmount,
            cancelReason
        });

        // 기존 결제 이력 조회
        const [existingHistory] = await connection.query(
            `SELECT * FROM toss_payment_history WHERE payment_key = ?`,
            [paymentKey]
        );

        if (existingHistory.length === 0) {
            // 결제 이력 없음 → 대기열에 추가
            const academyId = metadata?.academyId || 1;

            await connection.query(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (?, ?, ?, ?, 'CANCEL', ?, ?, ?, 'pending', ?)`,
                [
                    academyId,
                    orderId,
                    paymentKey,
                    cancelAmount,
                    canceledAt ? new Date(canceledAt) : null,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    '원본 결제 이력 없음 - 수동 확인 필요'
                ]
            );

            await connection.commit();

            return res.json({
                success: true,
                matched: false,
                message: '취소 수신 완료 (수동 확인 필요)',
                queueReason: 'ORIGINAL_NOT_FOUND'
            });
        }

        const history = existingHistory[0];
        const paymentId = history.payment_id;
        const academyId = history.academy_id;

        // 이미 취소된 건인지 확인
        if (history.status === 'CANCELED') {
            await connection.rollback();
            return res.json({
                success: true,
                message: '이미 취소된 결제입니다.',
                duplicate: true
            });
        }

        // student_payments 조회
        const [payments] = await connection.query(
            `SELECT * FROM student_payments WHERE id = ?`,
            [paymentId]
        );

        if (payments.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: '결제 내역을 찾을 수 없습니다.'
            });
        }

        const payment = payments[0];
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const refundAmount = parseFloat(cancelAmount) || parseFloat(history.amount);
        const newPaidAmount = Math.max(0, currentPaidAmount - refundAmount);
        const finalAmount = parseFloat(payment.final_amount);

        // 새 상태 결정
        let newStatus;
        if (newPaidAmount <= 0) {
            newStatus = 'pending';
        } else if (newPaidAmount < finalAmount) {
            newStatus = 'partial';
        } else {
            newStatus = 'paid';
        }

        // student_payments 업데이트
        await connection.query(
            `UPDATE student_payments SET
                paid_amount = ?,
                payment_status = ?,
                notes = CONCAT(IFNULL(notes, ''), ?)
            WHERE id = ?`,
            [
                newPaidAmount,
                newStatus,
                `\n[토스 취소] ${refundAmount.toLocaleString()}원 환불 (${cancelReason || '사유 없음'}) (${new Date().toLocaleString('ko-KR')})`,
                paymentId
            ]
        );

        // toss_payment_history 상태 업데이트
        await connection.query(
            `UPDATE toss_payment_history SET
                status = 'CANCELED',
                raw_data = JSON_SET(COALESCE(raw_data, '{}'), '$.cancel', ?)
            WHERE id = ?`,
            [
                JSON.stringify({
                    cancelAmount: refundAmount,
                    cancelReason,
                    canceledAt,
                    raw: req.body
                }),
                history.id
            ]
        );

        await connection.commit();

        logger.info('[Toss] Cancel processed successfully:', {
            paymentId,
            refundAmount,
            newStatus,
            newPaidAmount
        });

        res.json({
            success: true,
            matched: true,
            paymentId,
            refundAmount,
            newStatus,
            newPaidAmount,
            remainingAmount: finalAmount - newPaidAmount
        });

    } catch (error) {
        await connection.rollback();
        logger.error('[Toss] Error processing cancel callback:', error);

        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '취소 처리 실패'
        });
    } finally {
        connection.release();
    }
});

// ============================================
// 관리자용 API (P-ACA 프론트엔드에서 호출)
// ============================================

/**
 * GET /paca/toss/history
 * 토스 결제 이력 조회 (관리자용)
 */
router.get('/history', verifyToken, checkPermission('payments', 'view'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;
        const { payment_id, start_date, end_date, limit = 50, offset = 0 } = req.query;

        let query = `
            SELECT
                h.*,
                p.year_month,
                s.name as student_name,
                s.student_number
            FROM toss_payment_history h
            JOIN student_payments p ON h.payment_id = p.id
            JOIN students s ON p.student_id = s.id
            WHERE h.academy_id = ?
        `;
        const params = [academyId];

        if (payment_id) {
            query += ' AND h.payment_id = ?';
            params.push(payment_id);
        }

        if (start_date) {
            query += ' AND h.approved_at >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND h.approved_at <= ?';
            params.push(end_date + ' 23:59:59');
        }

        query += ' ORDER BY h.created_at DESC LIMIT ? OFFSET ?';
        params.push(parseInt(limit), parseInt(offset));

        const [history] = await db.query(query, params);

        // 학생 이름 복호화
        const decryptedHistory = history.map(h => {
            try {
                return {
                    ...h,
                    student_name: decrypt(h.student_name)
                };
            } catch (e) {
                return h;
            }
        });

        // 전체 개수 조회
        const [countResult] = await db.query(
            `SELECT COUNT(*) as total FROM toss_payment_history WHERE academy_id = ?`,
            [academyId]
        );

        res.json({
            success: true,
            total: countResult[0].total,
            history: decryptedHistory
        });

    } catch (error) {
        logger.error('[Toss] Error fetching history:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '결제 이력 조회 실패'
        });
    }
});

/**
 * GET /paca/toss/queue
 * 수동 매칭 대기열 조회 (관리자용)
 */
router.get('/queue', verifyToken, checkPermission('payments', 'view'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;
        const { status = 'pending', limit = 50 } = req.query;

        const [queue] = await db.query(
            `SELECT * FROM toss_payment_queue
             WHERE (academy_id = ? OR academy_id IS NULL)
             AND match_status = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [academyId, status, parseInt(limit)]
        );

        // 통계
        const [stats] = await db.query(
            `SELECT
                match_status,
                COUNT(*) as count,
                SUM(amount) as total_amount
             FROM toss_payment_queue
             WHERE academy_id = ? OR academy_id IS NULL
             GROUP BY match_status`,
            [academyId]
        );

        res.json({
            success: true,
            stats: stats.reduce((acc, s) => {
                acc[s.match_status] = { count: s.count, amount: s.total_amount };
                return acc;
            }, {}),
            queue
        });

    } catch (error) {
        logger.error('[Toss] Error fetching queue:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '대기열 조회 실패'
        });
    }
});

/**
 * POST /paca/toss/queue/:id/match
 * 수동 매칭 처리 (관리자용)
 */
router.post('/queue/:id/match', verifyToken, checkPermission('payments', 'edit'), checkAcademyAccess, async (req, res) => {
    const connection = await db.getConnection();
    const queueId = parseInt(req.params.id);
    const { payment_id } = req.body;

    try {
        await connection.beginTransaction();

        // 대기열 항목 조회
        const [queueItems] = await connection.query(
            'SELECT * FROM toss_payment_queue WHERE id = ?',
            [queueId]
        );

        if (queueItems.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: '대기열 항목을 찾을 수 없습니다.'
            });
        }

        const queueItem = queueItems[0];

        if (queueItem.match_status !== 'pending') {
            await connection.rollback();
            return res.status(400).json({
                success: false,
                error: 'Bad Request',
                message: '이미 처리된 항목입니다.'
            });
        }

        // 결제 레코드 조회
        const [payments] = await connection.query(
            'SELECT * FROM student_payments WHERE id = ? AND academy_id = ?',
            [payment_id, req.user.academy_id]
        );

        if (payments.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: '결제 내역을 찾을 수 없습니다.'
            });
        }

        const payment = payments[0];
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const newPaidAmount = currentPaidAmount + parseFloat(queueItem.amount);
        const remainingAmount = parseFloat(payment.final_amount) - newPaidAmount;
        const newStatus = remainingAmount <= 0 ? 'paid' : 'partial';

        // student_payments 업데이트
        await connection.query(
            `UPDATE student_payments SET
                paid_amount = ?,
                payment_status = ?,
                payment_method = 'card',
                paid_date = ?,
                notes = CONCAT(IFNULL(notes, ''), ?)
            WHERE id = ?`,
            [
                newPaidAmount,
                newStatus,
                queueItem.approved_at ? new Date(queueItem.approved_at).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                `\n[토스 수동매칭] ${parseFloat(queueItem.amount).toLocaleString()}원 (${new Date().toLocaleString('ko-KR')})`,
                payment_id
            ]
        );

        // 대기열 상태 업데이트
        await connection.query(
            `UPDATE toss_payment_queue SET
                match_status = 'matched',
                matched_payment_id = ?,
                matched_at = NOW(),
                matched_by = ?
            WHERE id = ?`,
            [payment_id, req.user.id, queueId]
        );

        // 토스 결제 이력 저장
        await connection.query(
            `INSERT INTO toss_payment_history (
                payment_id, academy_id, order_id, payment_key, amount, method,
                approved_at, receipt_url, card_company, status, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'DONE', ?)`,
            [
                payment_id,
                req.user.academy_id,
                queueItem.order_id,
                queueItem.payment_key,
                queueItem.amount,
                queueItem.method,
                queueItem.approved_at,
                queueItem.receipt_url,
                queueItem.card_company,
                queueItem.raw_data
            ]
        );

        await connection.commit();

        logger.info('[Toss] Manual match completed:', {
            queueId,
            paymentId: payment_id,
            amount: queueItem.amount,
            matchedBy: req.user.id
        });

        res.json({
            success: true,
            message: '수동 매칭 완료',
            paymentId: payment_id,
            newStatus,
            paidAmount: newPaidAmount
        });

    } catch (error) {
        await connection.rollback();
        logger.error('[Toss] Error manual matching:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '수동 매칭 실패'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /paca/toss/queue/:id/ignore
 * 대기열 항목 무시 처리 (관리자용)
 * 보안: 자기 학원 대기열만 접근 가능
 */
router.post('/queue/:id/ignore', verifyToken, checkPermission('payments', 'edit'), checkAcademyAccess, async (req, res) => {
    try {
        const queueId = parseInt(req.params.id);
        const academyId = req.user.academy_id;
        const { reason } = req.body;

        // 학원 소속 검증
        const [queueItem] = await db.query(
            'SELECT id FROM toss_payment_queue WHERE id = ? AND academy_id = ?',
            [queueId, academyId]
        );

        if (queueItem.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: '대기열 항목을 찾을 수 없습니다.'
            });
        }

        await db.query(
            `UPDATE toss_payment_queue SET
                match_status = 'ignored',
                error_reason = ?,
                matched_by = ?,
                matched_at = NOW()
            WHERE id = ? AND academy_id = ?`,
            [reason || '관리자 무시 처리', req.user.id, queueId, academyId]
        );

        res.json({
            success: true,
            message: '무시 처리 완료'
        });

    } catch (error) {
        logger.error('[Toss] Error ignoring queue item:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '무시 처리 실패'
        });
    }
});

/**
 * GET /paca/toss/stats
 * 토스 결제 통계 (관리자용)
 */
router.get('/stats', verifyToken, checkPermission('payments', 'view'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;
        const { year_month } = req.query;

        // 이번 달 기본
        const targetMonth = year_month || new Date().toISOString().slice(0, 7);

        const [stats] = await db.query(
            `SELECT
                COUNT(*) as total_count,
                SUM(amount) as total_amount,
                COUNT(DISTINCT payment_id) as unique_payments,
                method,
                DATE(approved_at) as date
             FROM toss_payment_history
             WHERE academy_id = ?
             AND DATE_FORMAT(approved_at, '%Y-%m') = ?
             GROUP BY method, DATE(approved_at)
             ORDER BY date DESC`,
            [academyId, targetMonth]
        );

        // 대기열 통계
        const [queueStats] = await db.query(
            `SELECT match_status, COUNT(*) as count
             FROM toss_payment_queue
             WHERE academy_id = ?
             GROUP BY match_status`,
            [academyId]
        );

        res.json({
            success: true,
            month: targetMonth,
            paymentStats: stats,
            queueStats: queueStats.reduce((acc, s) => {
                acc[s.match_status] = s.count;
                return acc;
            }, {})
        });

    } catch (error) {
        logger.error('[Toss] Error fetching stats:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '통계 조회 실패'
        });
    }
});

/**
 * GET /paca/toss/settings
 * 토스 연동 설정 조회 (관리자용)
 */
router.get('/settings', verifyToken, checkPermission('settings', 'view'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;

        const [settings] = await db.query(
            `SELECT
                id, academy_id, merchant_id, is_active,
                auto_match_enabled, auto_receipt_print,
                created_at, updated_at
             FROM toss_settings
             WHERE academy_id = ?`,
            [academyId]
        );

        if (settings.length === 0) {
            return res.json({
                success: true,
                settings: null,
                message: '토스 연동 설정이 없습니다.'
            });
        }

        res.json({
            success: true,
            settings: settings[0]
        });

    } catch (error) {
        logger.error('[Toss] Error fetching settings:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '설정 조회 실패'
        });
    }
});

/**
 * PUT /paca/toss/settings
 * 토스 연동 설정 저장 (관리자용)
 */
router.put('/settings', verifyToken, checkPermission('settings', 'edit'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;
        const {
            merchant_id,
            plugin_api_key,
            callback_secret,
            is_active,
            auto_match_enabled,
            auto_receipt_print
        } = req.body;

        // 기존 설정 확인
        const [existing] = await db.query(
            'SELECT id FROM toss_settings WHERE academy_id = ?',
            [academyId]
        );

        if (existing.length === 0) {
            // 새로 생성
            await db.query(
                `INSERT INTO toss_settings (
                    academy_id, merchant_id, plugin_api_key, callback_secret,
                    is_active, auto_match_enabled, auto_receipt_print
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    academyId,
                    merchant_id,
                    plugin_api_key,
                    callback_secret,
                    is_active ? 1 : 0,
                    auto_match_enabled !== false ? 1 : 0,
                    auto_receipt_print !== false ? 1 : 0
                ]
            );
        } else {
            // 업데이트
            await db.query(
                `UPDATE toss_settings SET
                    merchant_id = COALESCE(?, merchant_id),
                    plugin_api_key = COALESCE(?, plugin_api_key),
                    callback_secret = COALESCE(?, callback_secret),
                    is_active = ?,
                    auto_match_enabled = ?,
                    auto_receipt_print = ?
                WHERE academy_id = ?`,
                [
                    merchant_id,
                    plugin_api_key,
                    callback_secret,
                    is_active ? 1 : 0,
                    auto_match_enabled !== false ? 1 : 0,
                    auto_receipt_print !== false ? 1 : 0,
                    academyId
                ]
            );
        }

        res.json({
            success: true,
            message: '설정이 저장되었습니다.'
        });

    } catch (error) {
        logger.error('[Toss] Error saving settings:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '설정 저장 실패'
        });
    }
});

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 이름 마스킹 (홍*동)
 */
function maskName(name) {
    if (!name || name.length < 2) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

module.exports = router;
