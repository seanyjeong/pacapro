/**
 * paca/payments/early-pay.js — 단월 미리납 (원장용)
 *
 * POST /early-pay-preview — 확인 창 금액(실행과 같은 계산, DB 변경 없음)
 * POST /early-pay — 지정 월 월수강료 청구 생성(없으면) + 완납 처리 (트랜잭션)
 */

const { pool, decrypt, logger } = require('./_utils');
const { floorPercent, billFinalAmount, billFinalAfterChange, isSeparatelyPricedBill } = require('../../utils/monthlyBillAmounts');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { getKoreaDateText } = require('../../utils/proratedPaymentDueDate');
const { lockStudentForBilling } = require('../../repositories/studentBillingLock');

/**
 * 미리 납부 금액 — 미리 납부 실행과 확인 창 미리보기(early-pay-preview)가 같이 쓴다.
 * - 새 청구·보통 미납 청구: 학원비 = 학생 월 학원비, 할인 = 학생 할인율 천원 절삭, 최종은 월 청구와 같은 공통 식
 *   (이미 있는 청구의 추가 금액·이미 적용된 크레딧은 지킨다).
 * - 일할·정산 등 금액을 따로 정한 청구(isSeparatelyPricedBill): 학원비·할인 칸을 바꾸지 않고 그 청구 금액 그대로.
 * 일부 납부한 청구는 이번에 받는 돈이 남은 금액(최종 − 이미 낸 금액)뿐이다(수납 pay.js 가 낸 만큼 이미 매출에 넣었다).
 */
function earlyPayAmounts(student, existingBill) {
    const baseAmount = parseFloat(student.monthly_tuition) || 0;
    const discountAmount = floorPercent(baseAmount, parseFloat(student.discount_rate) || 0);
    const separatelyPriced = Boolean(existingBill) && isSeparatelyPricedBill(existingBill);
    const billBase = separatelyPriced ? existingBill.base_amount : baseAmount;
    const billDiscount = separatelyPriced ? existingBill.discount_amount : discountAmount;
    const finalAmount = existingBill
        ? billFinalAfterChange(existingBill, { base_amount: billBase, discount_amount: billDiscount })
        : billFinalAmount(baseAmount, discountAmount);
    const alreadyPaid = existingBill ? parseFloat(existingBill.paid_amount) || 0 : 0;
    return { baseAmount, discountAmount, billBase, billDiscount, finalAmount, alreadyPaid, receivedAmount: finalAmount - alreadyPaid, separatelyPriced };
}

module.exports = function(router) {

/**
 * POST /paca/payments/early-pay-preview — 미리 납부 확인 창 금액(DB 변경 없음, 실행과 같은 함수)
 * 응답: { year_month, status: new|existing_unpaid|already_paid, final_amount, already_paid_amount, received_amount, separately_priced }
 */
router.post('/early-pay-preview', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const { student_id, year_month } = req.body;
        if (!student_id || !year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
            return res.status(400).json({ error: 'Validation Error', message: '학생과 청구 월(YYYY-MM)을 입력해주세요.' });
        }
        const [students] = await pool.execute(
            'SELECT id, monthly_tuition, discount_rate FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [student_id, req.user.academyId]
        );
        if (students.length === 0) return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        const [existing] = await pool.execute(
            `SELECT id, payment_status, paid_amount, base_amount, discount_amount, additional_amount, carryover_amount, final_amount,
                    is_prorated, description
             FROM student_payments
             WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
            [student_id, req.user.academyId, year_month]
        );
        const bill = existing[0] || null;
        if (bill && bill.payment_status === 'paid') {
            return res.json({ year_month, status: 'already_paid', final_amount: Number(bill.final_amount), already_paid_amount: Number(bill.paid_amount), received_amount: 0, separately_priced: false });
        }
        const amounts = earlyPayAmounts(students[0], bill);
        res.json({
            year_month,
            status: bill ? 'existing_unpaid' : 'new',
            final_amount: amounts.finalAmount,
            already_paid_amount: amounts.alreadyPaid,
            received_amount: Math.max(amounts.receivedAmount, 0),
            separately_priced: amounts.separatelyPriced,
        });
    } catch (error) {
        logger.error('Error in early pay preview:', error);
        res.status(500).json({ error: 'Server Error', message: '미리 납부 금액을 불러오지 못했습니다.' });
    }
});

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

        const payDate = payment_date || getKoreaDateText();

        await connection.beginTransaction();

        // 학생 → 청구 순서로 잠근다 — 다른 청구 경로와 같은 순서, 유일 키가 없어도 같은 달 청구가 두 개 생기지 않는다
        await lockStudentForBilling(connection, student_id, req.user.academyId);

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
            `SELECT id, payment_status, paid_amount, base_amount, discount_amount, additional_amount, carryover_amount, final_amount,
                    is_prorated, description
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

        const { baseAmount, discountAmount, billBase, billDiscount, finalAmount, alreadyPaid, receivedAmount } =
            earlyPayAmounts(student, existing[0] || null);
        if (alreadyPaid > finalAmount) {
            await connection.rollback();
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: `이미 낸 금액(${alreadyPaid.toLocaleString()}원)이 미리 납부 금액(${finalAmount.toLocaleString()}원)보다 많습니다. 청구 내역에서 금액을 확인해 주세요.`,
            });
        }
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const [year, month] = year_month.split('-').map(Number);
        const dueDateStr = new Date(Date.UTC(year, month - 1, dueDay)).toISOString().split('T')[0];
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
                    billBase,
                    billDiscount,
                    finalAmount,
                    finalAmount,
                    payDate,
                    payment_method,
                    earlyNote,
                    paymentId,
                ]
            );
        }

        // 매출 장부: 수납(pay.js)과 같은 칸(payment_id 로 청구 연결, 운영 장부에 payment_method 칸 없음)·같은 트랜잭션.
        // 이번에 받은 남은 금액만 넣는다. (예전 INSERT 는 없는 payment_method 칸 때문에 늘 실패해 조용히 빠졌다)
        if (receivedAmount > 0) {
            await connection.execute(
                `INSERT INTO revenues (
                    academy_id, category, amount, revenue_date,
                    payment_id, student_id, description
                ) VALUES (?, 'tuition', ?, ?, ?, ?, ?)`,
                [
                    req.user.academyId,
                    receivedAmount,
                    payDate,
                    paymentId,
                    student_id,
                    `미리납 - ${year_month}`,
                ]
            );
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `${year}년 ${month}월 학원비 미리 납부가 완료되었습니다. (받은 금액 ${receivedAmount.toLocaleString()}원)`,
            payment_id: paymentId,
            year_month,
            final_amount: finalAmount,
            received_amount: receivedAmount,
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
