/**
 * 청구를 만들거나 고치는 트랜잭션은 맨 먼저 학생 행을 잠근다(SELECT … FOR UPDATE).
 * 같은 학생의 청구 작업이 한 번에 하나씩만 돌아, 운영 표에 학생·월·종류 유일 키가 있든 없든
 * 같은 달 청구가 두 개 생기거나 크레딧이 두 번 빠지지 않는다.
 * 잠금 순서는 모든 경로에서 학생 → 청구 → 크레딧(교착 방지).
 * 쓰는 곳: 매달 자동 청구, 일괄 청구, 학생별 청구, 비시즌 종강 일할 청구, AI 연결 월회비 청구, 크레딧 수동 적용, 미리 납부, 선납.
 */
async function lockStudentForBilling(conn, studentId, academyId) {
    const [rows] = await conn.execute(
        'SELECT id FROM students WHERE id = ? AND academy_id = ? FOR UPDATE',
        [studentId, academyId]
    );
    return rows[0] || null;
}

module.exports = { lockStudentForBilling };
