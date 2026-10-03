const db = require('../config/database');
const { fail } = require('../models/maxEngineError');

async function transaction(work, pool = db) {
  const conn = await pool.getConnection();
  try {
    await conn.beginTransaction();
    const result = await work(conn);
    await conn.commit();
    return result;
  } catch (error) {
    await conn.rollback();
    throw error;
  } finally { conn.release(); }
}
async function lockAcademy(conn, academyId) {
  const [rows] = await conn.execute('SELECT id FROM academies WHERE id = ? FOR UPDATE', [academyId]);
  if (!rows.length) fail(403, 'LINK_FORBIDDEN', '교육원을 확인해 주세요.');
}
async function row(conn, table, id, academyId, lock = false) {
  const join = table === 'attendance'
    ? 'JOIN class_schedules cs ON cs.id = t.class_schedule_id JOIN students s ON s.id = t.student_id AND s.academy_id = cs.academy_id'
    : '';
  const scope = table === 'attendance' ? 'cs.academy_id' : 't.academy_id';
  const [rows] = await conn.execute(`SELECT t.* FROM \`${table}\` t ${join}
    WHERE t.id = ? AND ${scope} = ? ${table === 'students' ? 'AND t.deleted_at IS NULL' : ''} ${lock ? 'FOR UPDATE' : ''}`, [id, academyId]);
  if (!rows[0]) fail(404, 'NOT_FOUND', '내 교육원에서 대상 자료를 찾을 수 없습니다.');
  return rows[0];
}
async function roster(conn, academyId, lock = false) {
  // 삭제된 학생의 학번도 재사용하지 않는다. 기존 학생 등록 API와 같은 범위다.
  const [rows] = await conn.execute('SELECT id, name, phone, student_number, deleted_at, updated_at FROM students WHERE academy_id = ? ORDER BY id' + (lock ? ' FOR UPDATE' : ''), [academyId]);
  return rows;
}
async function insert(conn, table, values) {
  const fields = Object.keys(values);
  const [result] = await conn.execute(`INSERT INTO \`${table}\` (${fields.map(f => `\`${f}\``).join(',')}) VALUES (${fields.map(() => '?').join(',')})`, Object.values(values));
  return Number(result.insertId);
}
async function update(conn, table, id, values) {
  const fields = Object.keys(values);
  const [result] = await conn.execute(`UPDATE \`${table}\` SET ${fields.map(f => `\`${f}\` = ?`).join(',')}, updated_at = CURRENT_TIMESTAMP WHERE id = ?`, [...Object.values(values), id]);
  if (result.affectedRows !== 1) fail(409, 'SOURCE_CHANGED', '대상이 변경되었습니다. 다시 미리보기해 주세요.');
}
async function previous(conn, actor, idempotencyHash) {
  const [rows] = await conn.execute(`SELECT request_hash, result_json FROM max_engine_commands
    WHERE academy_id = ? AND user_id = ? AND idempotency_hash = ? FOR UPDATE`, [actor.academy_id, actor.user_id, idempotencyHash]);
  return rows[0];
}
async function completed(conn, actor, idempotencyHash, requestHash, operation, result) {
  await insert(conn, 'max_engine_commands', { academy_id: actor.academy_id, user_id: actor.user_id,
    idempotency_hash: idempotencyHash, request_hash: requestHash, operation, resource_id: result.resource_id,
    result_json: JSON.stringify(result) });
}
module.exports = { transaction, lockAcademy, row, roster, insert, update, previous, completed };
