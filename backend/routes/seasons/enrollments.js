/**
 * paca/seasons/enrollments.js — 시즌 등록(student_seasons) 단일 건 관리 라우터
 *
 * 마운트: paca.js → routes/seasons/index.js → require('./enrollments')(router)
 *         mount path: '/paca/seasons'
 *
 * Endpoint (4건, 정적 /enrollments/* 경로 — /:id 와일드카드 충돌 회피 위해 가장 먼저 등록):
 *   - POST /enrollments/:enrollment_id/pay              — 시즌비 납부 기록 + revenues INSERT
 *   - PUT  /enrollments/:enrollment_id                   — 등록 정보 수정 (등록일/시즌비/할인/시간대)
 *   - POST /enrollments/:enrollment_id/refund-preview    — 환불 미리보기 계산
 *   - POST /enrollments/:enrollment_id/cancel            — 등록 취소 + 환불 처리 + 시즌비 청구 정리
 *
 * 인증: verifyToken + checkPermission('seasons', 'edit') (4건 동일).
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/seasons.ts (updateEnrollment / getRefundPreview /
 *   cancelEnrollmentWithRefund) + 직접 소비 페이지가 root 키 직접 접근:
 *     - POST /enrollments/:id/pay         → { message, enrollment }
 *     - PUT  /enrollments/:id             → { message, enrollment }
 *     - POST /enrollments/:id/refund-preview
 *           → { enrollment, cancellation_date, refund, academy }
 *     - POST /enrollments/:id/cancel      → { message, refundCalculation }
 *     - 4xx                                → { error, message }
 *     - 5xx                                → { error: 'Server Error', message } (cancel 의 message 는
 *       'Failed to cancel enrollment' 영문 — Phase 3 ADR-013 보존, 응답 표준화는 별도 트랙)
 *
 * DB 호출 (ADR-005): pool.execute(sql, params). db.query / connection.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt(value) 시그니처 무변경 (학생 이름 복호화). bcrypt/JWT/결제 외부 X.
 *
 * 분리 결정 (ADR-006): 단일 파일 ~400줄 — 본 phase 추가 분리 X. enrollment 도메인 응집도 높음
 *   (4 endpoint 모두 enrollment_id PK 진입 + 동일 JOIN + 동일 인증 정책).
 */

const {
    pool,
    decrypt,
    logger,
    calculateSeasonRefund,
    parseWeeklyDays
} = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

router.post('/enrollments/:enrollment_id/pay', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { paid_date, paid_amount, payment_method } = req.body;

        const [enrollments] = await pool.execute(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        if (enrollment.payment_status === 'paid') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Season fee already paid'
            });
        }

        const paymentDate = paid_date || new Date().toISOString().split('T')[0];
        const paymentAmount = paid_amount || enrollment.season_fee;

        await pool.execute(
            `UPDATE student_seasons
            SET payment_status = 'paid', paid_date = ?, paid_amount = ?, payment_method = ?, updated_at = NOW()
            WHERE id = ?`,
            [paymentDate, paymentAmount, payment_method || null, enrollmentId]
        );

        await pool.execute(
            `INSERT INTO revenues (
                academy_id,
                category,
                amount,
                revenue_date,
                student_id,
                description
            ) VALUES (?, 'season', ?, ?, ?, ?)`,
            [
                enrollment.academy_id,
                paymentAmount,
                paymentDate,
                enrollment.student_id,
                `시즌비 납부 (${enrollment.season_name})`
            ]
        );

        const [updated] = await pool.execute(
            `SELECT
                ss.*,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (updated[0]) {
            updated[0].student_name = decrypt(updated[0].student_name);
        }

        res.json({
            message: 'Season fee payment recorded successfully',
            enrollment: updated[0]
        });
    } catch (error) {
        logger.error('Error recording season payment:', error);
        logger.error('Enrollment ID:', enrollmentId);
        logger.error('Request body:', req.body);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌비 납부 처리에 실패했습니다.'
        });
    }
});

router.put('/enrollments/:enrollment_id', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { registration_date, season_fee, discount_amount, discount_reason, time_slots } = req.body;

        const [enrollments] = await pool.execute(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        const updates = [];
        const params = [];

        if (registration_date !== undefined) {
            updates.push('registration_date = ?');
            params.push(registration_date);
        }

        if (season_fee !== undefined) {
            updates.push('season_fee = ?');
            params.push(season_fee);
        }

        if (discount_amount !== undefined) {
            updates.push('discount_amount = ?');
            params.push(discount_amount);
        }

        if (discount_reason !== undefined) {
            updates.push('discount_type = ?');
            params.push(discount_reason ? 'custom' : 'none');
        }

        if (time_slots !== undefined) {
            updates.push('time_slots = ?');
            params.push(JSON.stringify(time_slots));
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(enrollmentId);

        await pool.execute(
            `UPDATE student_seasons SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        const [updated] = await pool.execute(
            `SELECT
                ss.*,
                s.name as student_name,
                se.season_name
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (updated[0]) {
            updated[0].student_name = decrypt(updated[0].student_name);
        }

        res.json({
            message: 'Season enrollment updated successfully',
            enrollment: updated[0]
        });
    } catch (error) {
        logger.error('Error updating enrollment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 등록 정보 수정에 실패했습니다.'
        });
    }
});

router.post('/enrollments/:enrollment_id/refund-preview', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { cancellation_date, include_vat = false } = req.body;

        const [enrollments] = await pool.execute(
            `SELECT
                ss.*,
                s.academy_id,
                s.name as student_name,
                s.class_days,
                se.season_name,
                se.season_start_date,
                se.season_end_date,
                se.operating_days,
                se.default_season_fee
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
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

        const cancelDate = cancellation_date || new Date().toISOString().split('T')[0];

        let weeklyDays = [];
        if (enrollment.operating_days) {
            weeklyDays = typeof enrollment.operating_days === 'string'
                ? JSON.parse(enrollment.operating_days)
                : enrollment.operating_days;
        } else {
            weeklyDays = parseWeeklyDays(enrollment.class_days);
        }

        const originalFee = parseFloat(enrollment.season_fee) || 0;
        const discountAmount = parseFloat(enrollment.discount_amount) || 0;
        const paidAmount = originalFee - discountAmount;

        const refundResult = calculateSeasonRefund({
            paidAmount: paidAmount,
            originalFee: originalFee,
            seasonStartDate: new Date(enrollment.season_start_date),
            seasonEndDate: new Date(enrollment.season_end_date),
            cancellationDate: new Date(cancelDate),
            weeklyDays,
            includeVat: include_vat
        });

        const [academySettings] = await pool.execute(
            `SELECT academy_name, phone, address FROM academy_settings WHERE academy_id = ?`,
            [req.user.academyId]
        );

        res.json({
            enrollment: {
                id: enrollment.id,
                student_name: enrollment.student_name,
                season_name: enrollment.season_name,
                season_start_date: enrollment.season_start_date,
                season_end_date: enrollment.season_end_date,
                original_fee: originalFee,
                discount_amount: discountAmount,
                paid_amount: paidAmount,
                payment_status: enrollment.payment_status
            },
            cancellation_date: cancelDate,
            refund: refundResult,
            academy: academySettings[0] || {}
        });
    } catch (error) {
        logger.error('Error calculating refund preview:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '환불 금액 계산에 실패했습니다.'
        });
    }
});

router.post('/enrollments/:enrollment_id/cancel', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const enrollmentId = parseInt(req.params.enrollment_id);

    try {
        const { cancellation_date, include_vat = false, final_refund_amount } = req.body;

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
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Enrollment not found'
            });
        }

        const enrollment = enrollments[0];

        if (enrollment.academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: 'Access denied'
            });
        }

        enrollment.student_name = decrypt(enrollment.student_name);

        if (enrollment.payment_status === 'cancelled') {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Enrollment already cancelled'
            });
        }

        const cancelDate = cancellation_date || new Date().toISOString().split('T')[0];

        const [seasonInfo] = await pool.execute(
            `SELECT operating_days FROM seasons WHERE id = ?`,
            [enrollment.season_id]
        );
        let weeklyDays = [];
        if (seasonInfo[0]?.operating_days) {
            weeklyDays = typeof seasonInfo[0].operating_days === 'string'
                ? JSON.parse(seasonInfo[0].operating_days)
                : seasonInfo[0].operating_days;
        } else {
            weeklyDays = parseWeeklyDays(enrollment.class_days);
        }

        const originalFee = parseFloat(enrollment.season_fee) || 0;
        const discountAmount = parseFloat(enrollment.discount_amount) || 0;
        const paidAmount = originalFee - discountAmount;

        const refundResult = calculateSeasonRefund({
            paidAmount: paidAmount,
            originalFee: originalFee,
            seasonStartDate: new Date(enrollment.season_start_date),
            seasonEndDate: new Date(enrollment.season_end_date),
            cancellationDate: new Date(cancelDate),
            weeklyDays,
            includeVat: include_vat
        });

        const actualRefundAmount = final_refund_amount !== undefined
            ? parseFloat(final_refund_amount)
            : refundResult.finalRefundAmount;

        if (actualRefundAmount > 0 && enrollment.payment_status === 'paid') {
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
                    actualRefundAmount,
                    cancelDate,
                    `시즌 중도 해지 환불 - ${enrollment.student_name} (${enrollment.season_name})${include_vat ? ' (부가세 제외)' : ''}`
                ]
            );
        }

        await pool.execute(`DELETE FROM student_seasons WHERE id = ?`, [enrollmentId]);

        await pool.execute(
            `UPDATE students SET is_season_registered = false, current_season_id = NULL WHERE id = ?`,
            [enrollment.student_id]
        );

        await pool.execute(
            `DELETE FROM student_payments
            WHERE student_id = ? AND payment_type = 'season' AND payment_status != 'paid'
            AND description LIKE ?`,
            [enrollment.student_id, `%${enrollment.season_name}%`]
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
