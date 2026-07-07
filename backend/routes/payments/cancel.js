/**
 * paca/payments/cancel.js — 단건 결제 취소 라우터
 *
 * Endpoint:
 *   - POST /:id/cancel — 이미 기록된 납부 금액을 취소 사유와 함께 되돌림.
 *
 * 결제 취소는 청구 삭제가 아니다. student_payments 행은 유지하고 paid_amount,
 * payment_status, paid_date/payment_method, notes 만 보정한다.
 */

const { pool, decryptStudentName, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { remainingAmountSql } = require('../../utils/paymentAmountSql');

function getTodayString() {
    return new Date().toISOString().split('T')[0];
}

function parsePositiveAmount(value) {
    const amount = Number(String(value).replace(/,/g, ''));
    if (!Number.isFinite(amount) || amount <= 0) return null;
    return amount;
}

function getNextStatus(paidAmount, finalAmount) {
    if (paidAmount <= 0) return 'pending';
    if (paidAmount >= finalAmount) return 'paid';
    return 'partial';
}

function getCancelNote(cancelDate, cancelAmount, reason) {
    return `[납부취소] ${cancelDate} ${cancelAmount}원 취소 - ${reason}`;
}

module.exports = function(router) {

/**
 * POST /paca/payments/:id/cancel
 * Cancel a recorded payment amount.
 * Access: owner, admin
 */
router.post('/:id/cancel', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const paymentId = Number.parseInt(req.params.id, 10);

    try {
        const body = req.body || {};
        const cancelAmount = parsePositiveAmount(body.cancel_amount);
        const cancelReason = String(body.cancel_reason || '').trim();
        const cancelDate = body.cancel_date || getTodayString();

        if (!Number.isFinite(paymentId) || paymentId <= 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        if (!cancelAmount) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '취소 금액을 입력해주세요.'
            });
        }

        if (!cancelReason) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '결제 취소 사유를 입력해주세요.'
            });
        }

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
        const finalAmount = Number(payment.final_amount) || 0;
        const rawPaidAmount = Number(payment.paid_amount) || 0;
        const currentPaidAmount = payment.payment_status === 'paid' && rawPaidAmount === 0
            ? finalAmount
            : rawPaidAmount;

        if (currentPaidAmount <= 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '취소할 납부 금액이 없습니다.'
            });
        }

        if (cancelAmount > currentPaidAmount) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '현재 납부액보다 큰 금액은 취소할 수 없습니다.'
            });
        }

        const newPaidAmount = currentPaidAmount - cancelAmount;
        const paymentStatus = getNextStatus(newPaidAmount, finalAmount);
        const nextPaidDate = newPaidAmount <= 0 ? null : payment.paid_date;
        const nextPaymentMethod = newPaidAmount <= 0 ? null : payment.payment_method;
        const cancelNote = getCancelNote(cancelDate, cancelAmount, cancelReason);

        await pool.execute(
            `UPDATE student_payments
            SET
                paid_amount = ?,
                payment_status = ?,
                paid_date = ?,
                payment_method = ?,
                notes = CONCAT(IFNULL(notes, ''), '\n', ?),
                updated_at = NOW()
            WHERE id = ?`,
            [newPaidAmount, paymentStatus, nextPaidDate, nextPaymentMethod, cancelNote, paymentId]
        );

        const revenueCategory = payment.payment_type === 'season' ? 'season' : 'tuition';
        const revenueDescription = payment.payment_type === 'season'
            ? `시즌비 결제 취소 (${payment.description || ''})`.trim()
            : `수강료 결제 취소 (결제ID: ${paymentId})`;

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
                    -cancelAmount,
                    cancelDate,
                    payment.payment_method || 'other',
                    payment.student_id,
                    revenueDescription
                ]
            );
        } catch (revenueError) {
            logger.info('Revenue cancellation insert skipped:', revenueError.message);
        }

        const [updated] = await pool.execute(
            `SELECT
                p.*,
                ${remainingAmountSql('p')} as remaining_amount,
                s.name as student_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        return res.json({
            message: '결제 취소가 기록되었습니다.',
            payment: decryptStudentName(updated[0])
        });
    } catch (error) {
        logger.error('=== Error canceling payment ===');
        logger.error('Error:', error);
        logger.error('Payment ID:', paymentId);
        res.status(500).json({
            error: 'Server Error',
            message: '결제 취소에 실패했습니다.'
        });
    }
});

};
