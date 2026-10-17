const commands = require('./maxEngineFullCommandRepository');
const { fail } = require('../models/maxEngineError');
async function rows(conn, sql, params, lock) {
  const [result] = await conn.execute(sql + (lock ? ' FOR UPDATE' : ''), params);
  return result;
}
async function state(conn, actor, command, lock) {
  const student = await commands.row(conn, 'students', command.resource_id, actor.academy_id, lock);
  const dates = command.changes.trial_dates || [command.changes];
  const days = [...new Set(dates.map(d => d.date))].sort();
  const placeholders = days.map(() => '?').join(',');
  return { student,
    attendance: await rows(conn, `SELECT a.id, a.class_schedule_id, a.attendance_status, a.is_makeup,
      cs.class_date, cs.time_slot FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
      WHERE a.student_id = ? AND cs.academy_id = ? ORDER BY a.id`, [student.id, actor.academy_id], lock),
    schedules: await rows(conn, `SELECT id, class_date, time_slot, is_closed, academy_event_id FROM class_schedules
      WHERE academy_id = ? AND class_date IN (${placeholders}) ORDER BY id`, [actor.academy_id, ...days], lock),
    holidays: await rows(conn, `SELECT id, event_date FROM academy_events
      WHERE academy_id = ? AND is_holiday = 1 AND event_date IN (${placeholders}) ORDER BY id`, [actor.academy_id, ...days], lock),
    settings: await rows(conn, `SELECT morning_class_time, afternoon_class_time, evening_class_time
      FROM academy_settings WHERE academy_id = ? ORDER BY id`, [actor.academy_id], lock) };
}
async function apply(conn, actor, studentId, plan, before) {
  await commands.update(conn, 'students', studentId, {
    status: plan.status, is_trial: plan.is_trial, trial_remaining: plan.trial_remaining,
    trial_dates: JSON.stringify(plan.trial_dates),
  });
  for (const item of plan.related.remove_attendance) {
    const [result] = await conn.execute(`DELETE a FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
      WHERE a.id = ? AND a.student_id = ? AND cs.academy_id = ? AND a.attendance_status IS NULL`,
    [item.id, studentId, actor.academy_id]);
    if (result.affectedRows !== 1) fail(409, 'SOURCE_CHANGED', '출결 배정이 변경되었습니다. 다시 미리보기해 주세요.');
  }
  for (const item of plan.related.assign_schedules) {
    let scheduleId = before.schedules.find(s => s.class_date === item.date && s.time_slot === item.time_slot)?.id;
    if (!scheduleId) scheduleId = await commands.insert(conn, 'class_schedules', {
      academy_id: actor.academy_id, class_date: item.date, time_slot: item.time_slot,
    });
    await commands.insert(conn, 'attendance', { class_schedule_id: scheduleId, student_id: studentId, attendance_status: null });
  }
  return studentId;
}
module.exports = { state, apply };
