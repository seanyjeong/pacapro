const repo = require('../repositories/maxEngineScheduleRepository');
const commandRepo = require('../repositories/maxEngineFullCommandRepository');
const { fail } = require('../models/maxEngineError');
const { TIME_SLOTS, MORNING_END_HOUR, AFTERNOON_END_HOUR } = require('../constants/academyEvents');
const { clock, timeRange, conflict } = require('./maxEngineScheduleValidation');

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
const bounds = ['00:00', `${MORNING_END_HOUR}:00`, `${AFTERNOON_END_HOUR}:00`, '24:00'];
// 공개 상담 예약(routes/public.js)과 같은 해석: 종일 → 하루 전체, time_slot → 오전·오후·저녁, 그 외 → 시작~종료
function range(block) {
  if (block.time_slot) {
    const index = TIME_SLOTS.indexOf(block.time_slot);
    return [bounds[index], bounds[index + 1]];
  }
  if (block.is_all_day) return ['00:00', '24:00'];
  return block.start_time && block.end_time ? [clock(block.start_time), clock(block.end_time)] : null;
}
function overlaps(block, start, end) {
  const taken = range(block);
  return Boolean(taken && taken[0] < end && taken[1] > start);
}
function plan(changes) {
  if (changes.blocked_date < today()) fail(422, 'SCHEDULE_TIME_RANGE', '오늘 이전 날짜는 차단할 수 없습니다.');
  if (changes.is_all_day && (changes.start_time || changes.end_time)) fail(422, 'SCHEDULE_TIME_RANGE', '종일 차단에는 시작·종료 시간을 넣지 않습니다.');
  if (!changes.is_all_day) timeRange(changes.start_time, changes.end_time, true);
  return { blocked_date: changes.blocked_date, is_all_day: Boolean(changes.is_all_day),
    start_time: changes.is_all_day ? null : changes.start_time, end_time: changes.is_all_day ? null : changes.end_time, reason: changes.reason };
}
function display(command, state) {
  if (command.operation === 'consultation_block_delete') {
    const old = state.record;
    if (old.academy_event_id) conflict('학원 행사에 연결된 상담 차단입니다. 해당 행사의 상담 차단을 꺼 주세요(academy_event_update block_consultation=false).');
    return { before: { id: old.id, blocked_date: old.blocked_date, is_all_day: Boolean(old.is_all_day), time_slot: old.time_slot,
      start_time: clock(old.start_time), end_time: clock(old.end_time), reason: old.reason }, after: null };
  }
  const block = plan(command.changes);
  const [start, end] = range(block);
  if (state.blocks.some(row => overlaps(row, start, end))) {
    conflict('같은 날짜의 기존 상담 차단과 시간이 겹칩니다. 기존 차단을 먼저 확인해 주세요.');
  }
  const reservations = state.reservations.filter(row => start <= clock(row.preferred_time) && clock(row.preferred_time) < end);
  return { before: null, after: { ...block, related: { unchanged_reservations_in_blocked_slots: reservations } } };
}
async function apply(conn, actor, command) {
  if (command.operation === 'consultation_block_delete') {
    await repo.removeBlock(conn, command.resource_id, actor.academy_id);
    return command.resource_id;
  }
  const block = plan(command.changes);
  return commandRepo.insert(conn, 'consultation_blocked_slots', { academy_id: actor.academy_id, blocked_date: block.blocked_date,
    is_all_day: block.is_all_day, start_time: block.start_time && block.start_time + ':00', end_time: block.end_time && block.end_time + ':00',
    reason: block.reason, created_by: actor.user_id });
}
module.exports = { display, apply, range, overlaps };
