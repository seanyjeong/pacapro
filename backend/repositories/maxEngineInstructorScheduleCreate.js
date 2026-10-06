const { fail } = require('../models/maxEngineError');
const common = require('./maxEngineFullCommandRepository');
async function state(conn, actor, command, lock) {
  const c = command.changes, suffix = lock ? ' FOR UPDATE' : '';
  const [teachers] = await conn.execute(`SELECT id,name,status FROM instructors
    WHERE id=? AND academy_id=? AND status='active' AND deleted_at IS NULL${suffix}`, [c.instructor_id, actor.academy_id]);
  if (!teachers[0]) fail(404, 'NOT_FOUND', '내 교육원의 재직 강사를 선택해 주세요.');
  const [schedules] = await conn.execute(`SELECT id,time_slot,scheduled_start_time,scheduled_end_time FROM instructor_schedules
    WHERE academy_id=? AND instructor_id=? AND work_date=? ORDER BY id${suffix}`, [actor.academy_id,c.instructor_id,c.work_date]);
  return { instructor: teachers[0], schedules };
}
async function insert(conn, actor, changes) {
  return common.insert(conn, 'instructor_schedules', { academy_id: actor.academy_id, ...changes, created_by: actor.user_id });
}
module.exports = { state, insert };
