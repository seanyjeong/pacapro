const { seasonBillMatchSql, seasonBillMatchParams } = require('./seasonBillMatch');

/**
 * 시즌 등록 취소 때 그 시즌의 청구 정리(화면 두 경로·AI 연결이 같이 쓴다).
 * - 받은 돈이 있는 일부 납부 청구: 지우면 받은 기록이 사라진다. 청구액을 받은 돈에 맞춰 완납으로 닫고 메모에 남긴다.
 * - 받은 돈이 없는 청구: 지운다. 완납 청구는 그대로 둔다.
 */
async function closeSeasonBills(conn, studentId, seasonId, seasonName) {
    const params = [studentId, ...seasonBillMatchParams(seasonId, seasonName)];
    // MySQL 은 SET 을 왼쪽부터 적용한다 — 메모는 바꾸기 전 청구액으로 쓴다
    await conn.execute(
        `UPDATE student_payments
        SET notes = CONCAT_WS('\n', NULLIF(notes, ''), CONCAT('시즌 등록 취소: 청구액 ', FORMAT(final_amount, 0), '원 → 받은 돈 ', FORMAT(paid_amount, 0), '원')),
            final_amount = paid_amount, payment_status = 'paid'
        WHERE student_id = ? AND payment_type = 'season' AND payment_status NOT IN ('paid', 'cancelled') AND paid_amount > 0
        AND ${seasonBillMatchSql()}`,
        params
    );
    await conn.execute(
        `DELETE FROM student_payments
        WHERE student_id = ? AND payment_type = 'season' AND payment_status != 'paid' AND COALESCE(paid_amount, 0) = 0
        AND ${seasonBillMatchSql()}`,
        params
    );
}

module.exports = { closeSeasonBills };
