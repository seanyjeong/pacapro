/**
 * paca/payments/credits.js — 크레딧 관리 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./credits')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (2건 — 모두 정적 경로):
 *   - GET /credits         — 전체 크레딧 목록 (필터: status / credit_type) + 통계
 *   - GET /credits/summary — 잔여 크레딧 학생 목록 + 크레딧 타입별 통계
 *
 * 인증: verifyToken + checkPermission('payments', 'view')
 *
 * 응답 표면 보존 (ADR-013):
 *   GET /credits         → { credits, stats }
 *   GET /credits/summary → { students_with_credit, type_stats }
 *   5xx                  → { error:'Server Error', message:'...' }
 *
 * DB 호출 (ADR-005): pool.execute (4건). db.query 잔존 0건.
 * ADR-016 IN 절: status='all' / credit_type='all' 분기 처리 (자리표시자 0건 — IN 절 미사용).
 * ADR-007: decrypt 시그니처 무변경 (학생 이름 복호화).
 *
 * 분리 결정 (ADR-006): ~120줄 — 분리 불요.
 */

const { pool, decrypt, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/payments/credits
 * 전체 크레딧 목록 조회 (학원 전체)
 */
router.get('/credits', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const { status, credit_type } = req.query;

        let whereClause = 'rc.academy_id = ?';
        const params = [req.user.academyId];

        if (status && status !== 'all') {
            whereClause += ' AND rc.status = ?';
            params.push(status);
        }

        if (credit_type && credit_type !== 'all') {
            whereClause += ' AND rc.credit_type = ?';
            params.push(credit_type);
        }

        const [credits] = await pool.execute(
            `SELECT rc.*, s.name as student_name, s.status as student_status
             FROM rest_credits rc
             JOIN students s ON rc.student_id = s.id
             WHERE ${whereClause}
             ORDER BY rc.created_at DESC`,
            params
        );

        // 학생 이름 복호화
        const decryptedCredits = credits.map(c => ({
            ...c,
            student_name: decrypt(c.student_name) || c.student_name
        }));

        // 통계
        const [stats] = await pool.execute(
            `SELECT
                COUNT(*) as total_count,
                SUM(credit_amount) as total_credit,
                SUM(remaining_amount) as total_remaining,
                SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending_count,
                SUM(CASE WHEN status = 'pending' THEN remaining_amount ELSE 0 END) as pending_amount,
                SUM(CASE WHEN status = 'partial' THEN 1 ELSE 0 END) as partial_count,
                SUM(CASE WHEN status = 'applied' THEN 1 ELSE 0 END) as applied_count
             FROM rest_credits
             WHERE academy_id = ?`,
            [req.user.academyId]
        );

        res.json({
            credits: decryptedCredits,
            stats: stats[0] || {
                total_count: 0,
                total_credit: 0,
                total_remaining: 0,
                pending_count: 0,
                pending_amount: 0,
                partial_count: 0,
                applied_count: 0
            }
        });
    } catch (error) {
        logger.error('Error fetching all credits:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 목록 조회에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/credits/summary
 * 크레딧 요약 통계
 */
router.get('/credits/summary', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        // 잔여 크레딧이 있는 학생 목록
        const [studentsWithCredit] = await pool.execute(
            `SELECT s.id, s.name, s.status as student_status,
                    SUM(rc.remaining_amount) as total_remaining,
                    COUNT(rc.id) as credit_count
             FROM rest_credits rc
             JOIN students s ON rc.student_id = s.id
             WHERE rc.academy_id = ? AND rc.remaining_amount > 0
             GROUP BY s.id, s.name, s.status
             ORDER BY total_remaining DESC`,
            [req.user.academyId]
        );

        const decryptedStudents = studentsWithCredit.map(s => ({
            ...s,
            name: decrypt(s.name) || s.name
        }));

        // 크레딧 타입별 통계
        const [typeStats] = await pool.execute(
            `SELECT credit_type,
                    COUNT(*) as count,
                    SUM(credit_amount) as total_amount,
                    SUM(remaining_amount) as remaining_amount
             FROM rest_credits
             WHERE academy_id = ?
             GROUP BY credit_type`,
            [req.user.academyId]
        );

        res.json({
            students_with_credit: decryptedStudents,
            type_stats: typeStats
        });
    } catch (error) {
        logger.error('Error fetching credit summary:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 요약 조회에 실패했습니다.'
        });
    }
});

};
