/**
 * 이번 달(한국 시간)부터의 미납 월 청구를 학생 학원비에 맞춘다.
 * 학생 수정(routes/students/crud/update/paymentEffects)과 반 학원비 적용·반 이동(services/branchService)이 같이 쓴다.
 * 일할 청구·낸 청구는 건드리지 않고, 이미 적용된 크레딧(carryover_amount)·추가 금액은 남긴다.
 */
const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');

// 미납 월 청구에 넣는 할인 후 금액 (학생 수정과 같은 식)
function pendingMonthlyFinal(tuition, discountRate) {
    return tuition * (1 - discountRate / 100);
}

async function updatePendingMonthlyTuition(conn, { studentId, academyId, tuition, discountRate }) {
    const finalTuition = pendingMonthlyFinal(tuition, discountRate);
    const currentYearMonth = getKoreaDateText().slice(0, 7);

    // 이미 적용된 크레딧(carryover_amount)·추가 금액은 남긴다.
    await conn.execute(
        `UPDATE student_payments
         SET base_amount = ?,
             final_amount = GREATEST(? + COALESCE(additional_amount, 0) - COALESCE(carryover_amount, 0), 0),
             updated_at = NOW()
         WHERE student_id = ?
           AND academy_id = ?
           AND \`year_month\` >= ?
           AND payment_status = 'pending'
           AND payment_type = 'monthly'
           AND NOT (is_prorated = 1 OR description LIKE '%일할계산%')`,
        [tuition, finalTuition, studentId, academyId, currentYearMonth]
    );
    return { finalTuition };
}

// 위 UPDATE 가 바꿀 청구(미리보기용). 학생 여러 명을 한 번에.
async function findPendingMonthlyTuition(conn, academyId, studentIds) {
    if (studentIds.length === 0) return [];
    const [rows] = await conn.execute(
        `SELECT id, student_id, \`year_month\`, base_amount, final_amount, additional_amount, carryover_amount
         FROM student_payments
         WHERE student_id IN (${studentIds.map(() => '?').join(',')})
           AND academy_id = ?
           AND \`year_month\` >= ?
           AND payment_status = 'pending'
           AND payment_type = 'monthly'
           AND NOT (is_prorated = 1 OR description LIKE '%일할계산%')
         ORDER BY student_id, \`year_month\`, id`,
        [...studentIds, academyId, getKoreaDateText().slice(0, 7)]
    );
    return rows;
}

module.exports = { pendingMonthlyFinal, updatePendingMonthlyTuition, findPendingMonthlyTuition };
