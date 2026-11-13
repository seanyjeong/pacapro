/**
 * 지점별 보기 공용 — 쿼리 값 branch_ids=3,5,0 (0 = 지점 없음). 비우면 학원 전체.
 */

// '3,5,0' → [3, 5, 0]. 비었으면 []. 형식이 틀리면 null.
function parseBranchIds(value) {
    if (value === undefined || value === null || value === '') return [];
    const parts = String(value).split(',');
    if (!parts.every((part) => /^\d+$/.test(part))) return null;
    return [...new Set(parts.map(Number))];
}

const placeholders = (ids) => ids.map(() => '?').join(',');

// 학생의 지금 지점으로 가르는 조건. ids 가 비면 빈 문자열.
function studentBranchSql(student, ids) {
    return ids.length ? ` AND COALESCE(${student}.branch_id, 0) IN (${placeholders(ids)})` : '';
}

// 청구서의 지점(옮긴 적 없으면 학생의 지금 지점)으로 가르는 조건. ids 가 비면 빈 문자열.
function paymentBranchSql(payment, student, ids) {
    return ids.length ? ` AND COALESCE(${payment}.branch_id, ${student}.branch_id, 0) IN (${placeholders(ids)})` : '';
}

// DB의 users.branch_ids(JSON) → 번호 배열. 비었거나 읽을 수 없으면 [].
function readUserBranchIds(value) {
    try {
        const ids = typeof value === 'string' ? JSON.parse(value) : value;
        return Array.isArray(ids) ? ids.filter(Number.isSafeInteger) : [];
    } catch {
        return [];
    }
}

module.exports = { parseBranchIds, studentBranchSql, paymentBranchSql, readUserBranchIds };
