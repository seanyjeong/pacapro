const { scanLimit } = require('../constants/maxEngineReadOptions');
const { fail } = require('../models/maxEngineError');
const repo = require('./maxEngineFullCommandRepository');
async function reservations(conn, academyId, studentId, today, lock) {
  const [rows] = await conn.execute(`SELECT a.*, cs.class_date, cs.academy_id AS schedule_academy_id
    FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
    WHERE a.student_id = ? AND cs.academy_id = ?
    AND (cs.class_date = ? OR (cs.class_date > ? AND a.attendance_status IS NULL))
    ORDER BY a.id LIMIT ${scanLimit + 1} ${lock ? 'FOR UPDATE' : ''}`, [studentId, academyId, today, today]);
  if (rows.length > scanLimit) fail(422, 'QUERY_TOO_BROAD', '퇴원 대상 출결이 10,000건을 넘습니다. 원본 수업 배정을 먼저 확인해 주세요.');
  return rows;
}
async function withdraw(conn, actor, command, before) {
  await repo.update(conn, 'students', command.resource_id, { status: 'withdrawn',
    withdrawal_date: command.changes.withdrawal_date, withdrawal_reason: command.changes.reason || null });
  // Only the previewed reservations are removed; checked future and past history survive.
  if (before.reservations.length) await conn.execute(`DELETE FROM attendance
    WHERE student_id = ? AND id IN (${before.reservations.map(() => '?').join(',')})`,
  [command.resource_id, ...before.reservations.map(r => r.id)]);
  return command.resource_id;
}
module.exports = { reservations, withdraw };
