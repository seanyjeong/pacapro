/**
 * routes/notifications/logs.js
 *
 * 발송 로그 / 통계 read-only 조회 라우터.
 *  - GET /paca/notifications/logs   : 발송 로그 페이징 + 필터(status/message_type/start_date/end_date)
 *  - GET /paca/notifications/stats  : 발송 통계 (year/month 옵션)
 *
 * 리팩 노트 (Phase 1 — Tier 1 #3, ADR-005 점진 적용):
 *  - DB 호출은 ADR-005 에 맞춰 모두 `pool.execute(sql, params)` 로 통일.
 *  - 응답 표면 (`{message, logs, pagination}`, `{message, stats}`, `{error, message}`)
 *    은 프론트 src/lib/api/notifications.ts (LogsResponse / StatsResponse) 와의
 *    하위 호환을 위해 ADR-013 결정에 따라 유지한다.
 *    응답 표면을 RULES.md 표준({data, meta} / {error: {code, message}}) 으로 옮기는
 *    작업은 프론트와 동기 진행하는 별도 단계로 분리한다.
 *  - 사용자 노출 메시지는 ADR-003 한국어 친화 원칙을 그대로 유지.
 */

const { pool, verifyToken, checkPermission, logger } = require('./_utils');

module.exports = function(router) {

/**
 * GET /paca/notifications/logs
 * 발송 로그 조회
 */
router.get('/logs', verifyToken, checkPermission('notifications', 'view'), async (req, res) => {
    try {
        const { page = 1, limit = 20, status, message_type, start_date, end_date } = req.query;
        const offset = (page - 1) * limit;

        let whereClause = 'WHERE academy_id = ?';
        const params = [req.user.academyId];

        if (status) {
            whereClause += ' AND status = ?';
            params.push(status);
        }
        if (message_type) {
            whereClause += ' AND message_type = ?';
            params.push(message_type);
        }
        if (start_date) {
            whereClause += ' AND created_at >= ?';
            params.push(start_date);
        }
        if (end_date) {
            whereClause += ' AND created_at <= ?';
            params.push(end_date + ' 23:59:59');
        }

        const [countResult] = await pool.execute(
            `SELECT COUNT(*) AS total FROM notification_logs ${whereClause}`,
            params
        );

        const [logs] = await pool.execute(
            `SELECT * FROM notification_logs ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
            [...params, parseInt(limit), parseInt(offset)]
        );

        res.json({
            message: '발송 로그 조회 성공',
            logs,
            pagination: {
                total: countResult[0].total,
                page: parseInt(page),
                limit: parseInt(limit),
                totalPages: Math.ceil(countResult[0].total / limit)
            }
        });
    } catch (error) {
        logger.error('발송 로그 조회 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '발송 로그 조회에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/notifications/stats
 * 발송 통계
 */
router.get('/stats', verifyToken, checkPermission('notifications', 'view'), async (req, res) => {
    try {
        const { year, month } = req.query;

        let whereClause = 'WHERE academy_id = ?';
        const params = [req.user.academyId];

        if (year && month) {
            whereClause += ' AND YEAR(created_at) = ? AND MONTH(created_at) = ?';
            params.push(year, month);
        }

        const [stats] = await pool.execute(
            `SELECT
                COUNT(*) AS total,
                SUM(CASE WHEN status = 'sent' THEN 1 ELSE 0 END) AS sent,
                SUM(CASE WHEN status = 'delivered' THEN 1 ELSE 0 END) AS delivered,
                SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) AS failed
            FROM notification_logs
            ${whereClause}`,
            params
        );

        res.json({
            message: '발송 통계 조회 성공',
            stats: stats[0]
        });
    } catch (error) {
        logger.error('발송 통계 조회 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '발송 통계 조회에 실패했습니다.'
        });
    }
});

};
