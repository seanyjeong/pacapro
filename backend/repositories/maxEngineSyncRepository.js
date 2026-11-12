const db = require('../config/database');
const { pageSize } = require('../config/maxEngineSync');
const SEASON_LIMIT = 200; // 교육원 시즌(끝나지 않은 것 + 1년 안에 끝난 것) 상한
const SEASON_PAGE_SIZE = 1000; // 학생 시즌 등록 한 쪽
const { isoToMysql } = require('../models/maxEngineSyncPage');
async function serverTime() {
  // Source TIMESTAMP has second precision: checkpoint only a closed second so
  // later writes in the current second remain eligible for the next strict > scan.
  const [rows] = await db.execute("SELECT DATE_FORMAT(UTC_TIMESTAMP() - INTERVAL 1 SECOND, '%Y-%m-%dT%H:%i:%sZ') AS server_time");
  return new Date(rows[0].server_time).toISOString();
}
async function students(page) {
  // 지점 범위 조회만 지점·반 칸을 읽는다. 범위 없는 조회는 SQL 이 지금과 글자까지 같다.
  const scoped = Boolean(page.branchIds), col = scoped ? 's.' : '';
  const where = [`${col}academy_id = ?`, `${col}updated_at <= ?`];
  const params = [page.academyId, isoToMysql(page.watermark)];
  if (page.since) { where.push(`${col}updated_at > ?`); params.push(isoToMysql(page.since)); }
  if (page.after) {
    where.push(`(${col}updated_at > ? OR (${col}updated_at = ? AND ${col}id > ?))`);
    params.push(page.after.updated_at, page.after.updated_at, page.after.id);
  }
  // No status/deleted filter: tombstones and prospect students are required for safe reconciliation.
  if (!scoped) {
    const [rows] = await db.execute(`SELECT id, academy_id, name, gender, school, grade,
    phone, parent_phone, father_phone, mother_phone, admission_type, status, deleted_at, updated_at
    FROM students WHERE ${where.join(' AND ')} ORDER BY updated_at, id LIMIT ${pageSize + 1}`, params);
    return rows;
  }
  // 범위 밖 학생도 같이 읽는다 — 다른 지점으로 옮긴 학생을 맥스엔진이 "삭제"로 보지 않게 번호만 알려 준다.
  const [rows] = await db.execute(`SELECT s.id, s.academy_id, s.name, s.gender, s.school, s.grade,
    s.phone, s.parent_phone, s.father_phone, s.mother_phone, s.admission_type, s.status, s.deleted_at, s.updated_at,
    s.branch_id, s.class_id, b.name AS branch_name, c.class_name
    FROM students s
    LEFT JOIN branches b ON b.id = s.branch_id AND b.academy_id = s.academy_id
    LEFT JOIN classes c ON c.id = s.class_id AND c.academy_id = s.academy_id
    WHERE ${where.join(' AND ')} ORDER BY s.updated_at, s.id LIMIT ${pageSize + 1}`, params);
  return rows;
}
async function branches(academyId) {
  const [rows] = await db.execute(`SELECT b.id, b.name, b.status, c.id AS class_id, c.class_name, c.status AS class_status
    FROM branches b LEFT JOIN classes c ON c.branch_id = b.id AND c.academy_id = b.academy_id
    WHERE b.academy_id = ? ORDER BY b.sort_order, b.id, c.sort_order, c.id`, [academyId]);
  return rows;
}
async function seasons(academyId) {
  // LIMIT 은 정수 상수로 넣는다(pool.execute 의 LIMIT ? 비호환).
  const [rows] = await db.execute(`SELECT id, season_name, season_type, status, season_start_date, season_end_date, non_season_end_date
    FROM seasons WHERE academy_id = ? AND (status <> 'ended' OR season_end_date >= DATE_SUB(CURDATE(), INTERVAL 1 YEAR))
    ORDER BY season_start_date, id LIMIT ${SEASON_LIMIT}`, [academyId]);
  return rows;
}
async function studentSeasons(academyId, seasonIds, studentId, offset) {
  if (!Number.isSafeInteger(offset) || offset < 0) throw new Error('offset');
  const marks = seasonIds.map(() => '?').join(', ');
  const where = [`ss.season_id IN (${marks})`];
  const params = [academyId, academyId, ...seasonIds];
  if (studentId !== null) { where.push('ss.student_id = ?'); params.push(studentId); }
  // 시즌·학생 모두 같은 교육원(student_seasons 에는 academy_id 가 없다). LIMIT·OFFSET 은 검사한 정수를 그대로.
  const [rows] = await db.execute(`SELECT ss.id, ss.season_id, ss.student_id, ss.registration_date, ss.payment_status, ss.is_cancelled
    FROM student_seasons ss
    JOIN seasons se ON se.id = ss.season_id AND se.academy_id = ?
    JOIN students st ON st.id = ss.student_id AND st.academy_id = ?
    WHERE ${where.join(' AND ')} ORDER BY ss.id LIMIT ${SEASON_PAGE_SIZE + 1} OFFSET ${offset}`, params);
  return rows;
}
module.exports = { serverTime, students, branches, seasons, studentSeasons, SEASON_PAGE_SIZE };
