/**
 * paca/payments/stats.js — 결제 통계 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./stats')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (1건 — 정적 경로):
 *   - GET /stats/summary — 결제 통계 (전체 / 연월별)
 *
 * 인증: verifyToken + checkPermission('payments', 'view')
 *
 * 응답 표면 보존 (ADR-013):
 *   GET /stats/summary → { message, stats }
 *   5xx                → { error:'Server Error', message:'...' }
 *
 * DB 호출 (ADR-005): pool.execute (1건). db.query 잔존 0건.
 *
 * 분리 결정 (ADR-006): ~50줄 — 분리 불요.
 */

const { pool, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { paidAmountSql, remainingAmountSql, dueUnpaidSql } = require('../../utils/paymentAmountSql');

module.exports = function(router) {

/**
 * GET /paca/payments/stats/summary
 * Get payment statistics summary
 * Access: owner, admin
 */
router.get('/stats/summary', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const { year, month } = req.query;

        let dateFilter = '';
        const params = [req.user.academyId];

        if (year && month) {
            dateFilter = ` AND p.year_month = ?`;
            params.push(`${year}-${String(month).padStart(2, '0')}`);
        }

        const paidAmount = paidAmountSql('p');
        const remainingAmount = remainingAmountSql('p');
        const dueUnpaid = dueUnpaidSql('p');

        // Get payment statistics
        const [stats] = await pool.execute(
            `SELECT
                COUNT(*) as total_count,
                SUM(CASE WHEN p.payment_status = 'paid' THEN 1 ELSE 0 END) as paid_count,
                SUM(CASE WHEN p.payment_status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN p.payment_status = 'pending' AND ${dueUnpaid} THEN 1 ELSE 0 END) as unpaid_count,
                SUM(COALESCE(p.final_amount, 0)) as total_expected,
                SUM(${paidAmount}) as total_collected,
                SUM(CASE
                    WHEN p.payment_status IN ('pending', 'partial') AND ${dueUnpaid}
                        THEN ${remainingAmount}
                    ELSE 0
                END) as total_outstanding
            FROM student_payments p
            WHERE p.academy_id = ?${dateFilter}`,
            params
        );

        res.json({
            message: '납부 통계를 불러왔습니다.',
            stats: stats[0]
        });
    } catch (error) {
        logger.error('Error fetching payment stats:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 통계를 불러오는데 실패했습니다.'
        });
    }
});

};
