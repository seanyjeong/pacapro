/**
 * paca/payments/prepaid.js — 선납 할인 결제 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./prepaid')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (2건 — 모두 정적 경로):
 *   - POST /prepaid-preview — 선납 결제 미리보기 (금액 계산, DB 변경 X)
 *   - POST /prepaid-pay     — 선납 결제 실행 (트랜잭션 — student_payments INSERT/UPDATE + revenues INSERT)
 *
 * 인증: verifyToken (학원 관리자 직접 호출 — checkPermission 없음, 원본 보존)
 *
 * 응답 표면 보존 (ADR-013):
 *   POST /prepaid-preview → { student_name, monthly_tuition, student_discount_rate, prepaid_discount_rate, months, total_final, total_prepaid_discount, months_payable, months_already_paid }
 *     months[].paid_amount(이미 낸 금액) 추가, total_final·total_amount 는 이번에 받을 금액(최종 − 이미 낸 금액) 합계
 *   POST /prepaid-pay     → { message, prepaid_group_id, total_amount, total_discount, months_processed, months_skipped }
 *   4xx                   → { error, message }
 *   5xx                   → { error:'Server Error', message:'...' }
 *
 * DB 호출 (ADR-005):
 *   - prepaid-preview: pool.execute (학생 + 월별 existing N건)
 *   - prepaid-pay: conn.execute (트랜잭션 — student SELECT + 월별 SELECT FOR UPDATE + INSERT/UPDATE + revenues INSERT)
 *
 * **트랜잭션 패턴 보존 (lesson #217)**:
 *   - dry_run 분기 X (preview 는 별도 endpoint)
 *   - SELECT FOR UPDATE 로 동시성 보호
 *   - 정상: conn.commit() + release / 에러: conn.rollback() + release
 *   - validation 실패 시 connection.release() 만 (트랜잭션 시작 전)
 *
 * ADR-007: decrypt 시그니처 무변경 (preview 응답에서 학생 이름 복호화).
 *
 * **결제 데이터 영속 변경 X (사장님 결정 2026-05-02)**:
 *   - student_payments INSERT/UPDATE 컬럼/순서/값 1:1 보존
 *   - prepaid_group_id (crypto.randomUUID) 발급 패턴 보존
 *   - notes (`[선납 N개월] X% 할인 (Y원)`) 포맷 보존
 *   - revenues INSERT (선납 결제): 이번에 받은 금액만, 수납(pay.js)과 같은 칸(payment_id)으로 같은 트랜잭션에 기록
 *
 * 분리 결정 (ADR-006): ~290줄 — 분리 불요.
 */

const { pool, decrypt, logger } = require('./_utils');
const { floorPercent, billFinalAmount, billFinalAfterChange, billTuitionCharge, isSeparatelyPricedBill, addWon } = require('../../utils/monthlyBillAmounts');
const { verifyToken } = require('../../middleware/auth');
const crypto = require('crypto');
const { getKoreaDateText } = require('../../utils/proratedPaymentDueDate');
const { lockStudentForBilling } = require('../../repositories/studentBillingLock');

/**
 * 한 달 선납 금액 — 미리보기·실행이 같이 쓴다. 선납 할인 = 할인 전 청구 금액(학생 할인 뒤) × 선납 할인율, 천원 절삭.
 * - 새 청구·보통 미납 청구: 학원비 = 학생 월 학원비, 할인액 = 학생 할인 + 선납 할인, 최종은 월 청구와 같은 공통 식.
 *   이미 있는 청구의 추가 금액·이미 적용된 크레딧은 지킨다.
 * - 일할·정산 등 금액을 따로 정한 미납 청구(isSeparatelyPricedBill — 첫 달·복귀·비시즌 일할, 휴원·퇴원 정산):
 *   학원비 칸은 그대로 두고 그 청구의 학원비 몫(billTuitionCharge) × 선납 할인율을 할인액에 더한다. 최종은 그 청구 금액 − 선납 할인.
 *   (예전엔 학원비 칸을 한 달 정액으로 바꿔 첫 달 일할 60,000원 청구가 428,000원이 되고, 줄인 청구 할인도 정액 기준이었다)
 * baseAmount·totalDiscountAmount: 저장할 학원비·할인액 칸, listAmount: 선납 할인 전 금액(미리보기 정상가)
 */
function prepaidMonthAmounts(tuition, studentDiscountRate, prepaidRate, existingBill) {
    if (existingBill && isSeparatelyPricedBill(existingBill)) {
        const listAmount = Number(billTuitionCharge(existingBill));
        // 선납 할인은 0 미만이 될 수 없다(할인이 음수면 더 청구된다)
        const prepaidDiscount = Math.max(floorPercent(billTuitionCharge(existingBill), prepaidRate), 0);
        const totalDiscountAmount = addWon(existingBill.discount_amount, prepaidDiscount);
        return { baseAmount: existingBill.base_amount, studentDiscount: 0, listAmount, prepaidDiscount, totalDiscountAmount,
            finalAmount: billFinalAfterChange(existingBill, { discount_amount: totalDiscountAmount }) };
    }
    const studentDiscount = floorPercent(tuition, studentDiscountRate);
    const prepaidDiscount = Math.max(floorPercent(tuition - studentDiscount, prepaidRate), 0);
    const totalDiscountAmount = studentDiscount + prepaidDiscount;
    const finalAmount = existingBill
        ? billFinalAfterChange(existingBill, { base_amount: tuition, discount_amount: totalDiscountAmount })
        : billFinalAmount(tuition, totalDiscountAmount);
    return { baseAmount: tuition, studentDiscount, listAmount: tuition - studentDiscount, prepaidDiscount, totalDiscountAmount, finalAmount };
}

module.exports = function(router) {

/**
 * POST /paca/payments/prepaid-preview
 * 선납 미리보기 (금액 계산, DB 변경 X)
 */
router.post('/prepaid-preview', verifyToken, async (req, res) => {
    try {
        const { student_id, months, prepaid_discount_rate } = req.body;

        // Validation
        if (!student_id || !Array.isArray(months) || months.length < 2 || months.length > 6) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생 ID와 2~6개월 범위의 월 목록이 필요합니다.'
            });
        }

        const rate = parseFloat(prepaid_discount_rate);
        if (isNaN(rate) || rate < 0 || rate > 50) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '선납 할인율은 0~50% 범위여야 합니다.'
            });
        }

        // 학생 조회
        const [students] = await pool.execute(
            `SELECT s.id, s.name, s.monthly_tuition, s.discount_rate, s.payment_due_day, s.status,
                    a.tuition_due_day
             FROM students s
             LEFT JOIN academy_settings a ON s.academy_id = a.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        }

        const student = students[0];
        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;

        // 각 월별 계산
        const monthDetails = [];
        let totalFinal = 0;
        let totalPrepaidDiscount = 0;
        let monthsPayable = 0;
        let monthsAlreadyPaid = 0;

        for (const yearMonth of months) {
            // 기존 결제 레코드 확인
            const [existing] = await pool.execute(
                'SELECT id, payment_status, paid_amount, base_amount, discount_amount, additional_amount, carryover_amount, final_amount, is_prorated, description FROM student_payments WHERE student_id = ? AND `year_month` = ? AND payment_type = ?',
                [student_id, yearMonth, 'monthly']
            );

            let status = 'new';
            if (existing.length > 0) {
                const ex = existing[0];
                if (ex.payment_status === 'paid') {
                    status = 'already_paid';
                } else {
                    status = 'existing_unpaid';
                }
            }

            const { studentDiscount, listAmount, prepaidDiscount, finalAmount } =
                prepaidMonthAmounts(baseAmount, studentDiscountRate, rate, status === 'existing_unpaid' ? existing[0] : null);

            // 일부 납부한 청구는 이미 낸 금액을 빼고 받는다(실행과 같음) — total_final 은 이번에 받을 금액 합계
            const paidAmount = status === 'existing_unpaid' ? parseFloat(existing[0].paid_amount) || 0 : 0;
            const detail = {
                year_month: yearMonth,
                // 정상가(화면: 기본 − 학생 할인): 일할·정산 청구는 그 청구 금액
                base_amount: status === 'already_paid' ? baseAmount : listAmount + studentDiscount,
                student_discount: studentDiscount,
                prepaid_discount: status === 'already_paid' ? 0 : prepaidDiscount,
                final_amount: status === 'already_paid' ? 0 : finalAmount,
                paid_amount: paidAmount,
                status
            };

            monthDetails.push(detail);

            if (status !== 'already_paid') {
                totalFinal += Math.max(finalAmount - paidAmount, 0);
                totalPrepaidDiscount += prepaidDiscount;
                monthsPayable++;
            } else {
                monthsAlreadyPaid++;
            }
        }

        res.json({
            student_name: decrypt(student.name),
            monthly_tuition: baseAmount,
            student_discount_rate: studentDiscountRate,
            prepaid_discount_rate: rate,
            months: monthDetails,
            total_final: totalFinal,
            total_prepaid_discount: totalPrepaidDiscount,
            months_payable: monthsPayable,
            months_already_paid: monthsAlreadyPaid
        });
    } catch (error) {
        logger.error('Error in prepaid preview:', error);
        res.status(500).json({ error: 'Server Error', message: '선납 미리보기에 실패했습니다.' });
    }
});

/**
 * POST /paca/payments/prepaid-pay
 * 선납 결제 실행 (트랜잭션)
 */
router.post('/prepaid-pay', verifyToken, async (req, res) => {
    const connection = await pool.getConnection();
    try {
        const { student_id, months, prepaid_discount_rate, payment_method, payment_date } = req.body;

        // Validation
        if (!student_id || !Array.isArray(months) || months.length < 2 || months.length > 6) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '학생 ID와 2~6개월 범위의 월 목록이 필요합니다.'
            });
        }

        const rate = parseFloat(prepaid_discount_rate);
        if (isNaN(rate) || rate < 0 || rate > 50) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '선납 할인율은 0~50% 범위여야 합니다.'
            });
        }

        if (!payment_method || !['account', 'card', 'cash', 'other'].includes(payment_method)) {
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 납부 방법을 선택해주세요.'
            });
        }

        const payDate = payment_date || getKoreaDateText();

        await connection.beginTransaction();

        // 학생 → 청구 순서로 잠근다 — 다른 청구 경로와 같은 순서, 유일 키가 없어도 같은 달 청구가 두 개 생기지 않는다
        await lockStudentForBilling(connection, student_id, req.user.academyId);

        // 학생 조회
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
            return res.status(400).json({ error: 'Validation Error', message: '재원 중인 학생만 선납 결제가 가능합니다.' });
        }

        const baseAmount = parseFloat(student.monthly_tuition) || 0;
        const studentDiscountRate = parseFloat(student.discount_rate) || 0;
        const dueDay = student.payment_due_day || student.tuition_due_day || 5;
        const prepaidGroupId = crypto.randomUUID();

        const monthsProcessed = [];
        const monthsSkipped = [];
        let totalAmount = 0;
        let totalDiscount = 0;

        for (const yearMonth of months) {
            // 기존 레코드 SELECT FOR UPDATE
            const [existing] = await connection.execute(
                'SELECT id, payment_status, paid_amount, base_amount, discount_amount, additional_amount, carryover_amount, final_amount, is_prorated, description FROM student_payments WHERE student_id = ? AND `year_month` = ? AND payment_type = ? FOR UPDATE',
                [student_id, yearMonth, 'monthly']
            );

            // 이미 완납이면 skip
            if (existing.length > 0 && existing[0].payment_status === 'paid') {
                monthsSkipped.push(yearMonth);
                continue;
            }

            // 금액 계산 (미리보기와 같은 함수)
            const { baseAmount: billBase, prepaidDiscount, totalDiscountAmount, finalAmount } =
                prepaidMonthAmounts(baseAmount, studentDiscountRate, rate, existing[0] || null);

            // 일부 납부한 청구: 이번에 받는 돈은 남은 금액(최종 − 이미 낸 금액)뿐이다(수납 pay.js 가 낸 만큼 이미 매출에 넣었다).
            // 선납 할인으로 최종 금액이 이미 낸 금액보다 작아지면 넘는 돈을 돌려줄 경로가 없어 선납 전체를 막는다.
            const alreadyPaid = existing.length ? parseFloat(existing[0].paid_amount) || 0 : 0;
            if (alreadyPaid > finalAmount) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `${yearMonth}은 이미 낸 금액(${alreadyPaid.toLocaleString()}원)이 선납 금액(${finalAmount.toLocaleString()}원)보다 많습니다. 이 달을 빼고 선납하거나 청구 내역에서 금액을 확인해 주세요.`
                });
            }
            const receivedAmount = finalAmount - alreadyPaid;

            const [year, month] = yearMonth.split('-').map(Number);
            const dueDateStr = new Date(Date.UTC(year, month - 1, dueDay)).toISOString().split('T')[0];
            const prepaidNote = `[선납 ${months.length}개월] ${rate}% 할인 (${prepaidDiscount.toLocaleString()}원)`;

            let paymentId = existing.length ? existing[0].id : null;
            if (existing.length === 0) {
                // INSERT 새 레코드 (paid 상태로)
                const [inserted] = await connection.execute(
                    `INSERT INTO student_payments (
                        student_id, academy_id, \`year_month\`, payment_type,
                        base_amount, discount_amount, additional_amount, final_amount,
                        paid_amount, paid_date, due_date,
                        payment_status, payment_method, description, notes,
                        recorded_by, prepaid_group_id
                    ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, ?, ?, ?, 'paid', ?, ?, ?, ?, ?)`,
                    [
                        student_id,
                        req.user.academyId,
                        yearMonth,
                        baseAmount,
                        totalDiscountAmount,
                        finalAmount,
                        finalAmount,
                        payDate,
                        dueDateStr,
                        payment_method,
                        `${year}년 ${month}월 학원비`,
                        prepaidNote,
                        req.user.userId,
                        prepaidGroupId
                    ]
                );
                paymentId = inserted.insertId;
            } else {
                // UPDATE 기존 미납 레코드
                await connection.execute(
                    `UPDATE student_payments SET
                        base_amount = ?, discount_amount = ?, final_amount = ?,
                        paid_amount = ?, paid_date = ?,
                        payment_status = 'paid', payment_method = ?,
                        notes = CONCAT(IFNULL(notes, ''), '\n', ?),
                        prepaid_group_id = ?,
                        updated_at = NOW()
                     WHERE id = ?`,
                    [
                        billBase,
                        totalDiscountAmount,
                        finalAmount,
                        finalAmount,
                        payDate,
                        payment_method,
                        prepaidNote,
                        prepaidGroupId,
                        existing[0].id
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
                        `선납 결제 - ${yearMonth} (${months.length}개월)`
                    ]
                );
            }

            monthsProcessed.push(yearMonth);
            totalAmount += receivedAmount;
            totalDiscount += prepaidDiscount;
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `선납 결제가 완료되었습니다. (${monthsProcessed.length}개월)`,
            prepaid_group_id: prepaidGroupId,
            total_amount: totalAmount,
            total_discount: totalDiscount,
            months_processed: monthsProcessed,
            months_skipped: monthsSkipped
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error in prepaid pay:', error);
        res.status(500).json({ error: 'Server Error', message: '선납 결제에 실패했습니다.' });
    }
});

};
