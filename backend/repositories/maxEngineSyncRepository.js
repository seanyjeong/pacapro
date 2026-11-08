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
  const where = ['academy_id = ?', 'updated_at <= ?'];
  const params = [page.academyId, isoToMysql(page.watermark)];
  if (page.since) { where.push('updated_at > ?'); params.push(isoToMysql(page.since)); }
  if (page.after) {
    where.push('(updated_at > ? OR (updated_at = ? AND id > ?))');
    params.push(page.after.updated_at, page.after.updated_at, page.after.id);
  }
  // No status/deleted filter: tombstones and prospect students are required for safe reconciliation.
  const [rows] = await db.execute(`SELECT id, academy_id, name, gender, school, grade,
    phone, parent_phone, father_phone, mother_phone, admission_type, status, deleted_at, updated_at
    FROM students WHERE ${where.join(' AND ')} ORDER BY updated_at, id LIMIT ${pageSize + 1}`, params);
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
module.exports = { serverTime, students, seasons, studentSeasons, SEASON_PAGE_SIZE };
