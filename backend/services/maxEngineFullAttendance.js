const repo = require('../repositories/maxEngineFullCommandRepository');
const { applyTrialAttendanceChange } = require('./trialStatusService');

async function state(conn, actor, id, lock) {
  const attendance = await repo.row(conn, 'attendance', id, actor.academy_id, lock);
  const student = await repo.row(conn, 'students', attendance.student_id, actor.academy_id, lock);
  const schedule = await repo.row(conn, 'class_schedules', attendance.class_schedule_id, actor.academy_id, lock);
  return { attendance, student, schedule };
}
async function apply(conn, actor, id, changes, before) {
  await repo.update(conn, 'attendance', id, { ...changes, recorded_by: actor.user_id });
  await applyTrialAttendanceChange({ connection: conn, attendanceStatus: changes.attendance_status || 'none',
    context: { student: before.student, previousAttendanceStatus: before.attendance.attendance_status }, schedule: before.schedule });
  return id;
}
module.exports = { state, apply };
