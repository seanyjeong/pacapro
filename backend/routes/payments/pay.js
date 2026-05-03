/**
 * paca/payments/pay.js — 단건 납부 기록 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./pay')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (1건 — :id 와일드카드):
 *   - POST /:id/pay — 납부 기록 (full or partial). 추가 할인 적용 시 final_amount 감소.
 *                     0원 청구 건은 0원 납부 처리 허용 (100% 할인 등).
 *                     revenues 테이블 INSERT (선택 — table not exist 시 skip).
 *
 * 인증: verifyToken + checkPermission('payments', 'edit')
 *
 * 응답 표면 보존 (ADR-013):
 *   POST /:id/pay → { message, payment }
 *   4xx           → { error, message }
 *   5xx           → { error:'Server Error', message:'납부 기록에 실패했습니다.', details? }
 *                    details 는 NODE_ENV=development 일 때만 (운영 환경 0건).
 *
 * DB 호출 (ADR-005): pool.execute (4건). db.query 잔존 0건.
 * ADR-007: decrypt 시그니처 무변경 (decryptStudentName 헬퍼).
 *
 * **결제 데이터 영속 변경 X (사장님 결정 2026-05-02)**:
 *   - student_payments UPDATE 컬럼/순서/값 1:1 보존
 *   - revenues INSERT 컬럼/값 1:1 보존
 *   - notes CONCAT 패턴 보존 ('\n' 구분자)
 *   - paid_date 기본값 = today (`new Date().toISOString().split('T')[0]`) 보존
 *
 * 분리 결정 (ADR-006): ~170줄 — 분리 불요.
 */

const { pool, decryptStudentName, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * POST /paca/payments/:id/pay
 * Record payment (full or partial)
 * Access: owner, admin
 */
router.post('/:id/pay', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        const { paid_amount, payment_method, payment_date, notes, discount_amount } = req.body;

        if (paid_amount === undefined || paid_amount === null || !payment_method) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (납부금액, 결제방법)'
            });
        }

        // Get payment record
        const [payments] = await pool.execute(
            `SELECT p.*
            FROM student_payments p
            WHERE p.id = ? AND p.academy_id = ?`,
            [paymentId, req.user.academyId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        const payment = payments[0];

        // Check if payment already completed
        if (payment.payment_status === 'paid') {
            return res.status(400).json({
                error: 'Validation Error',
                message: '이미 완납된 내역입니다.'
            });
        }

        // 추가 할인 적용 시 final_amount 감소
        let additionalDiscount = 0;
        let newFinalAmount = parseFloat(payment.final_amount);
        let newDiscountAmount = parseFloat(payment.discount_amount) || 0;

        if (discount_amount && parseFloat(discount_amount) > 0) {
            additionalDiscount = parseFloat(discount_amount);
            newFinalAmount = Math.max(0, newFinalAmount - additionalDiscount);
            newDiscountAmount += additionalDiscount;
        }

        // Calculate amounts
        const totalDue = newFinalAmount;
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const newPaidAmount = currentPaidAmount + parseFloat(paid_amount);

        // 0원 청구 건은 0원으로 납부 처리 허용 (100% 할인 등)
        if (parseFloat(paid_amount) < 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '납부 금액은 0원 이상이어야 합니다.'
            });
        }

        // 0원이 아닌데 0원 납부하려는 경우만 차단
        if (parseFloat(paid_amount) === 0 && totalDue > 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '납부 금액은 0원보다 커야 합니다.'
            });
        }

        // Determine payment status based on total paid amount
        let paymentStatus;
        if (newPaidAmount >= totalDue) {
            paymentStatus = 'paid';
        } else {
            paymentStatus = 'partial';
        }

        // 할인 적용 시 notes에 기록
        let paymentNote = notes || `납부: ${paid_amount}원`;
        if (additionalDiscount > 0) {
            paymentNote = `납부: ${paid_amount}원 (할인 ${additionalDiscount}원 적용)`;
        }

        await pool.execute(
            `UPDATE student_payments
            SET
                paid_amount = ?,
                final_amount = ?,
                discount_amount = ?,
                payment_status = ?,
                payment_method = ?,
                paid_date = ?,
                notes = CONCAT(IFNULL(notes, ''), '\n', ?),
                updated_at = NOW()
            WHERE id = ?`,
            [
                newPaidAmount,
                newFinalAmount,
                newDiscountAmount,
                paymentStatus,
                payment_method,
                payment_date || new Date().toISOString().split('T')[0],
                paymentNote,
                paymentId
            ]
        );

        // Record in revenues table (optional - table may not exist)
        // payment_type에 따라 적절한 카테고리와 설명 사용
        const revenueCategory = payment.payment_type === 'season' ? 'season' : 'tuition';
        const revenueDescription = payment.payment_type === 'season'
            ? `시즌비 납부 (${payment.description || ''})`.trim()
            : `수강료 납부 (결제ID: ${paymentId})`;

        try {
            await pool.execute(
                `INSERT INTO revenues (
                    academy_id,
                    category,
                    amount,
                    revenue_date,
                    payment_method,
                    student_id,
                    description
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    payment.academy_id,
                    revenueCategory,
                    paid_amount,
                    payment_date || new Date().toISOString().split('T')[0],
                    payment_method,
                    payment.student_id,
                    revenueDescription
                ]
            );
        } catch (revenueError) {
            logger.info('Revenue table insert skipped:', revenueError.message);
        }

        // Fetch updated payment
        const [updated] = await pool.execute(
            `SELECT
                p.*,
                s.name as student_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        res.json({
            message: '납부가 기록되었습니다.',
            payment: decryptStudentName(updated[0])
        });
    } catch (error) {
        logger.error('=== Error recording payment ===');
        logger.error('Error:', error);
        logger.error('Error message:', error.message);
        logger.error('SQL State:', error.sqlState);
        logger.error('SQL Message:', error.sqlMessage);
        logger.error('Payment ID:', paymentId);
        logger.error('Request body:', req.body);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 기록에 실패했습니다.',
            details: process.env.NODE_ENV === 'development' ? error.toString() : undefined
        });
    }
});

};
