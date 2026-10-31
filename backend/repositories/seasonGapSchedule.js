/**
 * 시즌 공백 기간 — 비시즌 종강일 다음 날부터 시즌 시작 전날까지는 그 시즌 등록생에게 정규 수업을 배정하지 않는다
 * (2026-11-01 주인님 결정: 일산 2027 정시집중 10/31 종강 ~ 11/23 시작 사이에 정규 수업이 들어감).
 * 취소되지 않은 등록 + 시작 전·진행 중 시즌만 본다. 정규 수업 자동 배정(슬롯 열기·등록·요일 변경·휴원 복귀)이 같은 규칙을 쓴다.
 */
const ENROLLED = `FROM student_seasons ss
        JOIN seasons se ON se.id = ss.season_id
        WHERE COALESCE(ss.is_cancelled, 0) = 0
          AND ss.payment_status != 'cancelled'
          AND se.status IN ('upcoming', 'active')
          AND se.non_season_end_date IS NOT NULL`;

// 학생(s)이 그 날짜에 공백 기간이 아니면 참. 날짜 자리 2개 — seasonGapExclusionParams(date)
function seasonGapExclusionSql(studentAlias = 's') {
    if (!['s'].includes(studentAlias)) throw new TypeError('Invalid student alias');
    return `NOT EXISTS (
        SELECT 1 ${ENROLLED}
          AND ss.student_id = ${studentAlias}.id
          AND se.academy_id = ${studentAlias}.academy_id
          AND ? > se.non_season_end_date
          AND ? < se.season_start_date
    )`;
}
const seasonGapExclusionParams = date => [date, date];

// 한 학생의 공백 기간 목록 [{ non_season_end, season_start }] (YYYY-MM-DD, 두 날짜 사이만 공백)
async function seasonGapRanges(db, studentId, academyId) {
    const [rows] = await db.query(
        `SELECT DATE_FORMAT(se.non_season_end_date, '%Y-%m-%d') AS non_season_end, DATE_FORMAT(se.season_start_date, '%Y-%m-%d') AS season_start
        ${ENROLLED}
          AND ss.student_id = ?
          AND se.academy_id = ?
          AND se.non_season_end_date < se.season_start_date`,
        [studentId, academyId]
    );
    return rows;
}
const inSeasonGap = (ranges, date) => ranges.some(range => date > range.non_season_end && date < range.season_start);

module.exports = { seasonGapExclusionSql, seasonGapExclusionParams, seasonGapRanges, inSeasonGap };
