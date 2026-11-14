/**
 * 시즌비 청구를 그 시즌 등록에 잇는 조건.
 * season_id 로 잇고, season_id 가 없는 예전 청구(services/seasonEnrollmentService 의 예전 형식 INSERT)만 설명 속 시즌 이름으로 찾는다.
 * 예전엔 설명의 시즌 이름으로만 찾아, 등록 뒤 시즌 이름을 바꾸면 등록 취소·수정이 시즌비 청구를 못 찾아 미납 청구가 남았다.
 * services/seasonPaymentSummary 의 시즌비 요약과 같은 규칙이다.
 */
const seasonBillMatchSql = (alias = '') => `(${alias}season_id = ? OR (${alias}season_id IS NULL AND ${alias}description LIKE ?))`;
const seasonBillMatchParams = (seasonId, seasonName) => [seasonId, `%${seasonName}%`];

module.exports = { seasonBillMatchSql, seasonBillMatchParams };
