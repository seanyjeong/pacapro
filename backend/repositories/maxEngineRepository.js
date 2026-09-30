const db = require('../config/database');
const peak = require('../config/peak-database');
const { PAGE_SIZE } = require('../config/maxEngine');

async function userByEmail(email) {
  const [rows] = await db.execute(
    `SELECT id, password_hash, role, academy_id, is_active, approval_status
     FROM users WHERE email = ? AND deleted_at IS NULL`, [email]);
  return rows[0];
}

async function userById(id) {
  const [rows] = await db.execute(
    `SELECT id, password_hash, role, academy_id, is_active, approval_status
     FROM users WHERE id = ? AND deleted_at IS NULL`, [id]);
  return rows[0];
}

async function academyById(id) {
  const [rows] = await db.execute(
    `SELECT a.id, a.name, s.settings FROM academies a
     LEFT JOIN academy_settings s ON s.academy_id = a.id WHERE a.id = ?`, [id]);
  return rows[0];
}

async function students(academyId, afterId) {
  const [rows] = await db.execute(
    `SELECT id, name, gender, grade, school, phone, parent_phone, status, updated_at
     FROM students WHERE academy_id = ? AND deleted_at IS NULL AND id > ?
       AND status IN ('active', 'paused', 'pending', 'trial', 'prospect')
     ORDER BY id LIMIT ${PAGE_SIZE + 1}`, [academyId, afterId]);
  return rows;
}

async function records(academyId, ids, today) {
  if (!ids.length) return { records: [], future_count: 0 };
  const marks = ids.map(() => '?').join(',');
  // Every join is academy scoped, including PEAK's copied student and event rows.
  const joins = `FROM student_records sr
    JOIN students s ON s.id = sr.student_id AND s.academy_id = sr.academy_id
    JOIN record_types rt ON rt.id = sr.record_type_id AND rt.academy_id = sr.academy_id
    WHERE sr.academy_id = ? AND s.paca_student_id IN (${marks}) AND rt.is_active = 1`;
  const [rows] = await peak.execute(
    `SELECT paca_student_id, record_id, record_type_id, record_type_name, unit, value, measured_at
     FROM (SELECT s.paca_student_id, sr.id AS record_id, sr.record_type_id,
       rt.name AS record_type_name, rt.unit, CAST(sr.value AS CHAR) AS value, sr.measured_at,
       ROW_NUMBER() OVER (PARTITION BY s.paca_student_id, sr.record_type_id
         ORDER BY sr.measured_at DESC, sr.id DESC) AS rn
       ${joins} AND sr.measured_at <= ?) ranked WHERE rn = 1
     ORDER BY paca_student_id, record_type_id`, [academyId, ...ids, today]);
  const [counts] = await peak.execute(
    `SELECT COUNT(*) AS count ${joins} AND sr.measured_at > ?`, [academyId, ...ids, today]);
  return { records: rows, future_count: Number(counts[0].count) };
}

module.exports = { userByEmail, userById, academyById, students, records };
