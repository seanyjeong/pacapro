const { commands } = require('../constants/maxEngineScheduleCommands');
const repo = require('../repositories/maxEngineScheduleRepository');
const commandRepo = require('../repositories/maxEngineFullCommandRepository');
const events = require('./maxEngineEventCommand');
const { clock, blocksTime, timeRange, conflict } = require('./maxEngineScheduleValidation');

function supports(operation) { return Object.hasOwn(commands, operation); }
async function state(conn, actor, command, lock) {
  switch (command.operation) {
    case 'class_schedule_update': return repo.classState(conn, actor, command, lock);
    case 'instructor_schedule_update': return repo.instructorState(conn, actor, command, lock);
    case 'consultation_reschedule': return repo.consultationState(conn, actor, command, lock);
    case 'academy_event_update': return repo.eventState(conn, actor, command, lock);
  }
}
function validateClass(before, after) {
  const old = before.record;
  const moved = old.class_date !== after.class_date || old.time_slot !== after.time_slot;
  const reassigned = old.instructor_id !== after.instructor_id;
  if ((moved || reassigned) && before.instructorAttendance.length) conflict('연결된 강사 출근 기록이 있어 수업의 날짜·시간·담당 강사를 바꿀 수 없습니다. 출근 기록을 먼저 정리해 주세요.');
  if (!moved) return;
  if (old.attendance_taken || before.attendance.some(row => row.attendance_status) || before.notifications.length) {
    conflict('출결 또는 출결 알림 기록이 있는 수업은 날짜·시간을 이동할 수 없습니다. 출결 기록을 먼저 확인해 주세요.');
  }
  if (before.attendance.some(row => row.is_trial || row.status === 'trial' || row.is_makeup)) {
    conflict('체험·보강 예약이 연결된 수업은 예약 기록을 먼저 정리한 뒤 이동해 주세요.');
  }
  if (old.is_closed || old.academy_event_id || before.holidays.length) conflict('휴강·휴일에 연결된 수업입니다. 학원 행사·휴강 일정을 먼저 수정해 주세요.');
  if (before.duplicates.length) conflict('옮길 날짜와 시간대에 이미 수업이 있습니다. 다른 시간대를 선택해 주세요.');
}
function display(command, before) {
  const notice = commands[command.operation].notice;
  if (command.operation === 'academy_event_update') return { ...events.display(command, before), notice };
  const old = before.record, after = { ...old, ...command.changes };
  let identity;
  if (command.operation === 'class_schedule_update') {
    validateClass(before, after);
    identity = ['id', 'title', 'class_date', 'time_slot', 'instructor_id'];
  } else if (command.operation === 'instructor_schedule_update') {
    timeRange(after.scheduled_start_time, after.scheduled_end_time);
    const moved = old.work_date !== after.work_date || old.time_slot !== after.time_slot;
    if (moved && before.attendance.length) conflict('기존 또는 변경할 날짜·시간대에 강사 출근 기록이 있습니다. 출근 기록을 먼저 확인해 주세요.');
    if (moved && before.duplicates.length) conflict('해당 강사의 근무 일정이 같은 날짜·시간대에 이미 있습니다.');
    identity = ['id', 'instructor_id', 'work_date', 'time_slot', 'scheduled_start_time', 'scheduled_end_time'];
  } else {
    const moved = old.preferred_date !== after.preferred_date || clock(old.preferred_time) !== clock(after.preferred_time);
    if (!['pending', 'confirmed'].includes(old.status)) conflict('완료·취소·미방문 상담은 예약 일정을 이동할 수 없습니다. 대기·확정 상태의 예약을 선택해 주세요.');
    if (moved && before.blocks.some(block => blocksTime(block, after.preferred_time))) conflict('변경할 상담 시간은 차단된 시간대입니다. 다른 날짜·시간을 선택해 주세요.');
    if (moved && before.reservations.length >= (before.settings[0]?.max_reservations_per_slot || 1)) conflict('변경할 상담 시간의 예약 정원이 찼습니다. 다른 날짜·시간을 선택해 주세요.');
    identity = ['id', 'preferred_date', 'preferred_time', 'status'];
  }
  const keys = new Set([...identity, ...Object.keys(command.changes)]);
  const pick = row => Object.fromEntries([...keys].map(key => [key, row[key] ?? null]));
  return { before: pick(old), after: pick(after), notice };
}
async function apply(conn, actor, command) {
  if (command.operation === 'academy_event_update') return events.apply(conn, actor, command);
  await commandRepo.update(conn, commands[command.operation].resource, command.resource_id, command.changes);
  return command.resource_id;
}
module.exports = { supports, state, display, apply };
