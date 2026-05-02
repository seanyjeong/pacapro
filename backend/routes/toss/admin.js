/**
 * paca/toss/admin.js — 관리자용 토스 결제 이력/큐/통계 라우터 (Phase 3 #8)
 *
 * 마운트: paca.js → routes/toss/index.js → require('./admin')(router)
 *         mount path: '/paca/toss'
 *
 * Endpoint (5건):
 *   - GET  /history             — 결제 이력 조회 (필터: payment_id, start/end_date, limit/offset)
 *   - GET  /queue               — 매칭 대기열 조회 (status 필터 + 통계)
 *   - POST /queue/:id/match     — 수동 매칭 (트랜잭션, 결제/이력/대기열 동시 처리)
 *   - POST /queue/:id/ignore    — 대기열 무시 처리
 *   - GET  /stats               — 결제 통계 (월별 + 대기열)
 *
 * 인증: verifyToken + checkPermission('payments', 'view'|'edit') + checkAcademyAccess
 *
 * 응답 표면 보존 (ADR-013):
 *   GET  /history             → { success, total, history }
 *   GET  /queue               → { success, stats, queue }
 *   POST /queue/:id/match     → { success, message, paymentId, newStatus, paidAmount }
 *   POST /queue/:id/ignore    → { success, message }
 *   GET  /stats               → { success, month, paymentStats, queueStats }
 *   4xx/5xx                   → { success:false, error, message }
 *
 * DB 호출 (ADR-005): pool.execute (단일) + conn.execute (트랜잭션 — match). db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 시그니처 무변경 (history JOIN students 학생 이름 복호화).
 *
 * 분리 결정 (ADR-006): ~330줄 — 분리 불요.
 */

const { pool, decrypt, logger } = require('./_utils');
const { verifyToken, checkPermission, checkAcademyAccess } = require('../../middleware/auth');

module.exports = function(router) {

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

        const [history] = await pool.execute(query, params);

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
        const [countResult] = await pool.execute(
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
            message: '결제 이력 조회에 실패했습니다.'
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

        const [queue] = await pool.execute(
            `SELECT * FROM toss_payment_queue
             WHERE (academy_id = ? OR academy_id IS NULL)
             AND match_status = ?
             ORDER BY created_at DESC
             LIMIT ?`,
            [academyId, status, parseInt(limit)]
        );

        // 통계
        const [stats] = await pool.execute(
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
            message: '대기열 조회에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/toss/queue/:id/match
 * 수동 매칭 처리 (관리자용)
 *
 * 트랜잭션: queue 조회 → 결제 조회 → student_payments UPDATE →
 *           toss_payment_queue UPDATE → toss_payment_history INSERT
 */
router.post('/queue/:id/match', verifyToken, checkPermission('payments', 'edit'), checkAcademyAccess, async (req, res) => {
    const connection = await pool.getConnection();
    const queueId = parseInt(req.params.id);
    const { payment_id } = req.body;

    try {
        await connection.beginTransaction();

        // 대기열 항목 조회
        const [queueItems] = await connection.execute(
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
        const [payments] = await connection.execute(
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
        await connection.execute(
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
        await connection.execute(
            `UPDATE toss_payment_queue SET
                match_status = 'matched',
                matched_payment_id = ?,
                matched_at = NOW(),
                matched_by = ?
            WHERE id = ?`,
            [payment_id, req.user.id, queueId]
        );

        // 토스 결제 이력 저장
        await connection.execute(
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
            message: '수동 매칭에 실패했습니다.'
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
        const [queueItem] = await pool.execute(
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

        await pool.execute(
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
            message: '무시 처리에 실패했습니다.'
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

        const [stats] = await pool.execute(
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
        const [queueStats] = await pool.execute(
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
            message: '통계 조회에 실패했습니다.'
        });
    }
});

};
