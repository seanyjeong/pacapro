const repository = require('../repositories/maxEngineInstructorScheduleCreate');
const { timeRange, clock, conflict } = require('./maxEngineScheduleValidation');
const { decrypt } = require('./maxEngineFullSecurity');
const supports = operation => operation === 'instructor_schedule_create';
function display(command, before) {
  const c = command.changes;
  timeRange(c.scheduled_start_time, c.scheduled_end_time, true);
  if (before.schedules.some(row => row.time_slot === c.time_slot)) conflict('해당 강사의 날짜·시간대 근무 일정이 이미 있습니다. 기존 일정 id를 조회해 주세요.');
  if (before.schedules.some(row => row.scheduled_start_time && row.scheduled_end_time &&
      clock(row.scheduled_start_time) < c.scheduled_end_time && clock(row.scheduled_end_time) > c.scheduled_start_time)) {
    conflict('선택한 근무 시각이 해당 강사의 다른 근무 일정과 겹칩니다.');
  }
  return { before: null, after: { ...c, instructor_name: decrypt(before.instructor.name) } };
}
async function apply(conn, actor, command) { return repository.insert(conn, actor, command.changes); }
module.exports = { supports, state: repository.state, display, apply };
