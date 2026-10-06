const { pacaSchema } = require('../config/maxEnginePeak');
const { fail } = require('../models/maxEngineError');
const { TABLES } = require('../constants/maxEnginePeakCommands');
async function row(conn, table, id, academyId, lock = false, shared = false) {
  if (!TABLES.has(table)) throw new Error('Unknown command table');
  const [rows] = await conn.execute(`SELECT * FROM \`${table}\` WHERE id = ?
    AND (academy_id = ? ${shared ? 'OR academy_id IS NULL' : ''}) ${lock ? 'FOR UPDATE' : ''}`, [id, academyId]);
  if (!rows[0]) fail(404, 'NOT_FOUND', '내 교육원에서 PEAK 대상 자료를 찾을 수 없습니다.');
  return rows[0];
}
async function linkedStudent(conn, actor, id, lock) {
  const student = await row(conn, 'students', id, actor.academy_id, lock);
  const [paca] = await conn.execute(`SELECT id, academy_id, status, deleted_at, updated_at
    FROM ${pacaSchema()}.students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL
    ${lock ? 'FOR SHARE' : ''}`, [student.paca_student_id, actor.academy_id]);
  if (!paca[0]) fail(404, 'NOT_FOUND', 'PEAK 학생의 현재 PACA 소속을 확인할 수 없습니다.');
  return { student, paca: paca[0] };
}
async function instructor(conn, actor, id, lock) {
  const owner = id < 0;
  const [rows] = await conn.execute(`SELECT id, academy_id, ${owner ? 'role, is_active' : 'status'}, deleted_at
    FROM ${pacaSchema()}.${owner ? 'users' : 'instructors'}
    WHERE id = ? AND academy_id = ? AND deleted_at IS NULL
    ${owner ? "AND role = 'owner' AND is_active = 1" : "AND status = 'active'"}
    ${lock ? 'FOR SHARE' : ''}`, [Math.abs(id), actor.academy_id]);
  if (!rows[0]) fail(404, 'NOT_FOUND', '현재 교육원의 재직 강사·원장 id를 확인해 주세요.');
  return rows[0];
}
async function matching(conn, table, fields, lock) {
  if (!['student_records', 'daily_plans', 'exercises'].includes(table)) throw new Error('Unknown matching table');
  const [rows] = await conn.execute(`SELECT * FROM \`${table}\`
    WHERE ${Object.keys(fields).map(f => '\`' + f + '\` = ?').join(' AND ')} ORDER BY id ${lock ? 'FOR UPDATE' : ''}`, Object.values(fields));
  return rows;
}
async function lockAcademy(conn, academyId) {
  // Upsert acquires an exclusive lock directly; INSERT IGNORE can deadlock on lock upgrades.
  await conn.execute('INSERT INTO max_engine_academy_locks (academy_id) VALUES (?) ON DUPLICATE KEY UPDATE academy_id = academy_id', [academyId]);
  await conn.execute('SELECT academy_id FROM max_engine_academy_locks WHERE academy_id = ? FOR UPDATE', [academyId]);
}
async function update(conn, table, id, academyId, values) {
  if (!TABLES.has(table)) throw new Error('Unknown command table');
  const [result] = await conn.execute(`UPDATE \`${table}\` SET
    ${Object.keys(values).map(f => '\`' + f + '\` = ?').join(',')}
    WHERE id = ? AND academy_id = ?`, [...Object.values(values), id, academyId]);
  if (result.affectedRows !== 1) fail(409, 'SOURCE_CHANGED', 'PEAK 원본이 변경되었습니다. 새 미리보기를 확인해 주세요.');
}
async function removeRecord(conn, id, academyId) {
  const [result] = await conn.execute('DELETE FROM student_records WHERE id = ? AND academy_id = ?', [id, academyId]);
  if (result.affectedRows !== 1) fail(409, 'SOURCE_CHANGED', '삭제할 기록이 변경되었습니다.');
}
module.exports = { row, linkedStudent, instructor, matching, lockAcademy, update, removeRecord };
