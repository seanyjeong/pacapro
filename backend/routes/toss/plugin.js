/**
 * paca/toss/plugin.js — 토스 플러그인용 API (Phase 3 #8)
 *
 * 마운트: paca.js → routes/toss/index.js → require('./plugin')(router)
 *         mount path: '/paca/toss'
 *
 * Endpoint (2건):
 *   - GET /unpaid       — 학원 미납자 목록 (학생 이름 복호화 + 마스킹)
 *   - GET /student/:id  — 특정 학생 결제 정보 조회
 *
 * 인증: verifyTossPlugin (X-Toss-Plugin-Key 헤더). verifyToken 미적용.
 *
 * 응답 표면 보존 (ADR-013):
 *   GET /unpaid       → { success, stats, payments }
 *   GET /student/:id  → { success, payments }
 *   4xx/5xx           → { success:false, error, message }
 *
 * DB 호출 (ADR-005): pool.execute. 2건. db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 시그니처 무변경 (학생 이름 복호화 + maskName 마스킹).
 *
 * 분리 결정 (ADR-006): 단일 파일 ~140줄 — 분리 불요.
 */

const { pool, decrypt, logger, verifyTossPlugin, maskName } = require('./_utils');

module.exports = function(router) {

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
        const [payments] = await pool.execute(
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
            message: '미납 목록 조회에 실패했습니다.'
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

        const [payments] = await pool.execute(
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
            message: '학생 결제 정보 조회에 실패했습니다.'
        });
    }
});

};
