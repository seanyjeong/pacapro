/**
 * paca/payments/early-pay.js — 단월 미리납 (원장용)
 *
 * POST /early-pay — 지정 월 월수강료 청구 생성(없으면) + 완납 처리 (트랜잭션)
 */

const { pool, decrypt, truncateToThousands, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * POST /paca/payments/early-pay
 */
router.post('/early-pay', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { student_id, year_month, payment_method, payment_date } = req.body;

        if (!student_id || !year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생과 청구 월(YYYY-MM)을 입력해주세요.',
            });
        }

        if (!payment_method || !['account', 'card', 'cash', 'other'].includes(payment_method)) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 납부 방법을 선택해주세요.',
            });
        }

        const payDate = payment_date || new Date().toISOString().split('T')[0];

        await connection.beginTransaction();

        const [students] = await connection.execute(
            `SELECT s.id, s.name, s.monthly_tuition, s.discount_rate, s.payment_due_day, s.status, s.academy_id,
                    a.tuition_due_day
             FROM students s
             LEFT JOIN academy_settings a ON s.academy_id = a.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            connection.release();
            return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        }

        const student = students[0];
        if (student.status !== 'active') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '재원 중인 학생만 미리 납부가 가능합니다.',
            });
        }

        const [existing] = await connection.execute(
            `SELECT id, payment_status, paid_amount, final_amount
             FROM student_payments
             WHERE student_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'
             FOR UPDATE`,
            [student_id, year_month]
        );

        if (existing.length > 0 && existing[0].payment_status === 'paid') {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '해당 월은 이미 완납 처리되어 있습니다.',
            });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;
        const discountAmount = truncateToThousands(baseAmount * studentDiscountRate / 100);
        const finalAmount = Math.max(0, baseAmount - discountAmount);
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const [year, month] = year_month.split('-').map(Number);
        const dueDateStr = new Date(year, month - 1, dueDay).toISOString().split('T')[0];
        const earlyNote = '[미리납] 원장 직접 수납';
        const description = `${year}년 ${month}월 학원비`;

        let paymentId;

        if (existing.length === 0) {
            const [result] = await connection.execute(
                `INSERT INTO student_payments (
                    student_id, academy_id, \`year_month\`, payment_type,
                    base_amount, discount_amount, additional_amount, final_amount,
                    paid_amount, paid_date, due_date,
                    payment_status, payment_method, description, notes,
                    recorded_by
                ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, ?, ?, ?, 'paid', ?, ?, ?, ?)`,
                [
                    student_id,
                    req.user.academyId,
                    year_month,
                    baseAmount,
                    discountAmount,
                    finalAmount,
                    finalAmount,
                    payDate,
                    dueDateStr,
                    payment_method,
                    description,
                    earlyNote,
                    req.user.userId,
                ]
            );
            paymentId = result.insertId;
        } else {
            paymentId = existing[0].id;
            await connection.execute(
                `UPDATE student_payments SET
                    base_amount = ?, discount_amount = ?, final_amount = ?,
                    paid_amount = ?, paid_date = ?,
                    payment_status = 'paid', payment_method = ?,
                    notes = CONCAT(IFNULL(notes, ''), CASE WHEN IFNULL(notes, '') = '' THEN '' ELSE '\n' END, ?),
                    updated_at = NOW()
                 WHERE id = ?`,
                [
                    baseAmount,
                    discountAmount,
                    finalAmount,
                    finalAmount,
                    payDate,
                    payment_method,
                    earlyNote,
                    paymentId,
                ]
            );
        }

        try {
            await connection.execute(
                `INSERT INTO revenues (
                    academy_id, category, amount, revenue_date,
                    payment_method, student_id, description
                ) VALUES (?, 'tuition', ?, ?, ?, ?, ?)`,
                [
                    req.user.academyId,
                    finalAmount,
                    payDate,
                    payment_method,
                    student_id,
                    `미리납 - ${year_month}`,
                ]
            );
        } catch (revenueError) {
            logger.info('Revenue table insert skipped:', revenueError.message);
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `${year}년 ${month}월 학원비 미리 납부가 완료되었습니다.`,
            payment_id: paymentId,
            year_month,
            final_amount: finalAmount,
            student_name: decrypt(student.name),
        });
    } catch (error) {
        try {
            await connection.rollback();
        } catch (_) { /* ignore */ }
        connection.release();
        logger.error('Error in early pay:', error);
        res.status(500).json({ error: 'Server Error', message: '미리 납부 처리에 실패했습니다.' });
    }
});

};
