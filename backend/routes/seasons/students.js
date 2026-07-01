/**
 * paca/seasons/students.js — 시즌별 등록 학생 조회·취소 라우터
 *
 * 마운트: paca.js → routes/seasons/index.js → require('./students')(router)
 *         mount path: '/paca/seasons'
 *
 * Endpoint (2건):
 *   - GET    /:id/students                 — 시즌 등록 학생 전체 목록 + 학생 정보 복호화
 *   - DELETE /:id/students/:student_id     — 시즌 등록 취소 (refund 'legal' 정책 + DB 정리)
 *
 * 인증:
 *   - GET    → verifyToken (조회 — checkPermission 없음)
 *   - DELETE → verifyToken + checkPermission('seasons', 'edit')
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/seasons.ts (getEnrolledStudents / cancelEnrollment):
 *     - GET    /:id/students          → { message, enrolled_students }   (root 키 enrolled_students)
 *     - DELETE /:id/students/:sid     → { message, refundCalculation }
 *     - 4xx/5xx                        → { error, message }
 *
 * DB 호출 (ADR-005): pool.execute. 6건. db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 시그니처 무변경 (학생 이름/전화/부모 전화 복호화).
 *   결제(student_payments) DELETE 만 — payments / toss 미접촉.
 *
 * 분리 결정 (ADR-006): ~150줄 — 분리 불요.
 *
 * 원본 동작 보존: DELETE 의 calculateSeasonRefund 호출 인자 셰이프 (seasonFee + refundPolicy:'legal')
 *   가 enrollments.js 의 cancel (paidAmount + originalFee + includeVat) 와 다름. 의도된 차이로
 *   ADR-013 응답 표면 보존 원칙에 따라 1:1 보존.
 */

const {
    pool,
    decrypt,
    logger,
    calculateSeasonRefund,
    parseWeeklyDays
} = require('./_utils');
const { SEASON_PAYMENT_SUMMARY_JOIN, applySeasonPaymentSummary } = require('./payment-summary');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

router.get('/:id/students', verifyToken, async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const [enrollments] = await pool.execute(
            `SELECT
                ss.*,
                s.name as student_name,
                s.student_number,
                s.phone as student_phone,
                s.parent_phone,
                s.class_days,
                s.grade as student_grade,
                sp.payment_paid_amount,
                sp.payment_final_amount,
                sp.payment_record_status
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            ${SEASON_PAYMENT_SUMMARY_JOIN}
            WHERE ss.season_id = ?
            AND s.academy_id = ?
            ORDER BY ss.registration_date DESC`,
            [seasonId, req.user.academyId]
        );

        enrollments.forEach(e => {
            e.student_name = decrypt(e.student_name);
            e.student_phone = decrypt(e.student_phone);
            e.parent_phone = decrypt(e.parent_phone);
            applySeasonPaymentSummary(e);
        });

        res.json({
            message: `Found ${enrollments.length} enrolled students`,
            enrolled_students: enrollments
        });
    } catch (error) {
        logger.error('Error fetching enrolled students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 등록 학생 목록을 불러오지 못했습니다.'
        });
    }
});

router.delete('/:id/students/:student_id', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);
    const studentId = parseInt(req.params.student_id);

    try {
        const [enrollments] = await pool.execute(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                s.class_days,
                se.season_name,
                se.season_start_date,
                se.season_end_date
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.season_id = ? AND ss.student_id = ?`,
            [seasonId, studentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];
        enrollment.student_name = decrypt(enrollment.student_name);

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        if (enrollment.payment_status === 'cancelled') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Enrollment already cancelled'
            });
        }

        const cancelDate = new Date().toISOString().split('T')[0];
        const weeklyDays = parseWeeklyDays(enrollment.class_days);

        const refundResult = calculateSeasonRefund({
            seasonFee: parseFloat(enrollment.season_fee),
            seasonStartDate: new Date(enrollment.season_start_date),
            seasonEndDate: new Date(enrollment.season_end_date),
            cancellationDate: new Date(cancelDate),
            weeklyDays,
            refundPolicy: 'legal'
        });

        if (refundResult.refundAmount > 0 && enrollment.payment_status === 'paid') {
            await pool.execute(
                `INSERT INTO expenses (
                    academy_id,
                    category,
                    amount,
                    expense_date,
                    description
                ) VALUES (?, 'refund', ?, ?, ?)`,
                [
                    enrollment.academy_id,
                    refundResult.refundAmount,
                    cancelDate,
                    `시즌 중도 해지 환불 - ${enrollment.student_name} (${enrollment.season_name})`
                ]
            );
        }

        await pool.execute(`DELETE FROM student_seasons WHERE id = ?`, [enrollment.id]);

        await pool.execute(
            `UPDATE students SET is_season_registered = false, current_season_id = NULL WHERE id = ?`,
            [studentId]
        );

        await pool.execute(
            `DELETE FROM student_payments
            WHERE student_id = ? AND payment_type = 'season' AND payment_status != 'paid'
            AND description LIKE ?`,
            [studentId, `%${enrollment.season_name}%`]
        );

        res.json({
            message: 'Season enrollment deleted successfully',
            refundCalculation: refundResult
        });
    } catch (error) {
        logger.error('Error cancelling enrollment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 등록 취소에 실패했습니다.'
        });
    }
});

};
