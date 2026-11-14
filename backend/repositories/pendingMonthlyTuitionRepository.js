/**
 * 이번 달(한국 시간)부터의 미납 월 청구를 학생 학원비에 맞춘다.
 * 학생 수정(routes/students/crud/update/paymentEffects), 수업일 변경(routes/students/classDays),
 * 반 학원비 적용·반 이동(services/branchService)이 같이 쓴다.
 * 금액은 월 자동 청구(scheduler/paymentScheduler, routes/payments/bulk)와 같은 식이고,
 * 일할 청구·낸 청구는 건드리지 않으며, 이미 적용된 크레딧(carryover_amount)·추가 금액은 남긴다.
 */
const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');
const { monthlyBillAmounts } = require('../utils/monthlyBillAmounts');

/**
 * 학원비에 맞춰 다시 쓰는 청구: 이번 달(한국 시간)부터, 미납, 월 청구, 그리고 일할이 아닌 것.
 * 일할 청구는 그 달 일부 금액이라 월 정액으로 덮으면 안 된다 —
 * 첫 달·복귀 일할(is_prorated = 1 또는 설명 '일할계산'), 비시즌 종강 일할(services/nonSeasonProratedBilling, 설명 '(비시즌 종강 일할)').
 * 비시즌 종강 일할 청구에 is_prorated 를 넣지 않는 이유: is_prorated 는 휴원·퇴원 정산과 첫 달 재계산이 '첫 달·복귀 일할'로 읽는다.
 */
const PENDING_MONTHLY_FILTER = `\`year_month\` >= ?
           AND payment_status = 'pending'
           AND payment_type = 'monthly'
           AND NOT (is_prorated = 1 OR description LIKE '%일할계산%')
           AND description NOT LIKE '%비시즌 종강 일할%'`;

/**
 * 미납 월 청구를 맞추는 UPDATE [sql, params]. 부르는 쪽이 자기 연결 방식(query/execute)으로 실행한다.
 * 최종 금액은 청구마다 추가 금액·크레딧이 달라 SQL 에서 monthlyBillAmounts 와 같은 순서로 계산한다
 * (학원비 − 할인액 + 추가 금액 − 크레딧 → 천원 절삭 → 0 이상). 학원비 인자는 DECIMAL 로 바꿔 넣어
 * 소수(DOUBLE) 계산이 섞이지 않게 한다(학원비는 DECIMAL(10,2) 저장값이라 넷째 자리 안에서 그대로다).
 */
function pendingMonthlyTuitionUpdate({ studentId, academyId, tuition, discountRate }) {
    const base = Number(tuition);
    const { discount } = monthlyBillAmounts(tuition, discountRate || 0);
    const currentYearMonth = getKoreaDateText().slice(0, 7);
    return [
        `UPDATE student_payments
         SET base_amount = ?,
             discount_amount = ?,
             final_amount = GREATEST(FLOOR((CAST(? AS DECIMAL(14,4)) - ? + COALESCE(additional_amount, 0) - COALESCE(carryover_amount, 0)) / 1000) * 1000, 0),
             updated_at = NOW()
         WHERE student_id = ?
           AND academy_id = ?
           AND ${PENDING_MONTHLY_FILTER}`,
        [base, discount, base, discount, studentId, academyId, currentYearMonth]
    ];
}

async function updatePendingMonthlyTuition(conn, args) {
    await conn.execute(...pendingMonthlyTuitionUpdate(args));
    return monthlyBillAmounts(args.tuition, args.discountRate || 0);
}

// 위 UPDATE 가 바꿀 청구(미리보기용). 학생 여러 명을 한 번에.
async function findPendingMonthlyTuition(conn, academyId, studentIds) {
    if (studentIds.length === 0) return [];
    const [rows] = await conn.execute(
        `SELECT id, student_id, \`year_month\`, base_amount, final_amount, additional_amount, carryover_amount
         FROM student_payments
         WHERE student_id IN (${studentIds.map(() => '?').join(',')})
           AND academy_id = ?
           AND ${PENDING_MONTHLY_FILTER}
         ORDER BY student_id, \`year_month\`, id`,
        [...studentIds, academyId, getKoreaDateText().slice(0, 7)]
    );
    return rows;
}

module.exports = { pendingMonthlyTuitionUpdate, updatePendingMonthlyTuition, findPendingMonthlyTuition };
