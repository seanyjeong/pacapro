/**
 * 월 청구 크레딧 차감 — 일괄 청구(POST /payments/bulk-monthly)와 학생별 청구(POST /payments/generate-monthly-for-student)가 같이 쓴다.
 * 휴식 이월·공결·수동 크레딧 중 가장 오래된 한 건에서 청구 금액(학원비 − 할인액 + 추가 금액)만큼까지 뺀다.
 * 매달 자동 청구(scheduler/paymentScheduler)·AI 연결 월회비 청구(services/maxEngineMonthlyPayment)도 같은 규칙이다.
 * 낸 청구를 건너뛸 학생에게는 부르지 않는다(부르면 크레딧이 청구 없이 사라진다).
 * lock: 트랜잭션 안에서 크레딧 행을 잠근다(FOR UPDATE) — 같은 학생 청구를 동시에 두 번 만들어도 크레딧은 한 번만 빠진다.
 */
async function deductMonthlyCredit(conn, { studentId, academyId, amountBeforeCarryover, lock = false }) {
    const [pendingCredits] = await conn.execute(
        `SELECT id, remaining_amount, credit_type FROM rest_credits
         WHERE student_id = ?
         AND academy_id = ?
         AND credit_type IN ('carryover', 'excused', 'manual')
         AND status IN ('pending', 'partial')
         AND remaining_amount > 0
         ORDER BY created_at ASC${lock ? '\n         FOR UPDATE' : ''}`,
        [studentId, academyId]
    );
    if (pendingCredits.length === 0) return { carryoverAmount: 0, restCreditId: null };

    const credit = pendingCredits[0];
    // 이월 금액이 청구 금액보다 크면 청구 금액만큼만 차감
    const carryoverAmount = Math.min(credit.remaining_amount, amountBeforeCarryover);
    const newRemaining = credit.remaining_amount - carryoverAmount;
    const newStatus = newRemaining <= 0 ? 'applied' : 'partial';

    await conn.execute(
        `UPDATE rest_credits SET
            remaining_amount = ?,
            status = ?,
            processed_at = NOW()
         WHERE id = ?`,
        [newRemaining, newStatus, credit.id]
    );
    return { carryoverAmount, restCreditId: credit.id };
}

module.exports = { deductMonthlyCredit };
