const events = require('./academyEventService');
const { fail } = require('../models/maxEngineError');
const { TIME_SLOTS, MORNING_END_HOUR, AFTERNOON_END_HOUR } = require('../constants/academyEvents');
const { clock, timeSlot, timeRange, conflict } = require('./maxEngineScheduleValidation');
const eventRepo = require('../repositories/academyEventRepository');
const blocks = require('./maxEngineConsultationBlocks');

const today = () => new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul',
  year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());

function plan(command, state) {
  const old = state.record;
  const { event, error } = events.normalizeEvent(command.changes, old);
  if (error) fail(422, 'SCHEDULE_TIME_RANGE', error);
  if (!event.is_all_day && !event.is_holiday) timeRange(event.start_time, event.end_time, true);
  const blocksChanged = ['block_consultation', 'is_all_day', 'is_holiday'].some(key => Boolean(old[key]) !== Boolean(event[key])) ||
    ['event_date', 'title'].some(key => old[key] !== event[key]) ||
    ['start_time', 'end_time'].some(key => clock(old[key]) !== clock(event[key]));
  const holidayChanged = Boolean(old.is_holiday) !== event.is_holiday || old.event_date !== event.event_date || old.title !== event.title;
  const slots = events.consultationSlots(event);
  if (blocksChanged) {
    const bounds = ['00:00', `${MORNING_END_HOUR}:00`, `${AFTERNOON_END_HOUR}:00`, '24:00'];
    const collision = state.blocks.some(block => block.academy_event_id !== old.id && slots.some(slot => {
      if (block.is_all_day) return true;
      if (block.time_slot) return block.time_slot === slot;
      const index = TIME_SLOTS.indexOf(slot);
      return block.start_time && block.end_time && clock(block.start_time) < bounds[index + 1] && clock(block.end_time) > bounds[index];
    }));
    if (collision) conflict('옮길 날짜의 상담 차단이 다른 행사 또는 수동 차단과 겹칩니다. 기존 차단을 먼저 확인해 주세요.');
  }
  if (holidayChanged && event.is_holiday && (state.holidays.length || state.classes.some(row =>
    row.class_date === event.event_date && (row.is_closed || row.academy_event_id) && row.academy_event_id !== old.id))) {
    conflict('옮길 날짜에 다른 휴일 또는 별도 휴강이 있습니다. 해당 일정을 먼저 확인해 주세요.');
  }
  const beforeClasses = holidayChanged ? state.classes.filter(row => row.academy_event_id === old.id || (event.is_holiday && row.class_date === event.event_date)) : [];
  const afterClasses = beforeClasses.map(row => {
    if (event.is_holiday && row.class_date === event.event_date) return { ...row, is_closed: 1, close_reason: `휴일: ${event.title}`, academy_event_id: old.id };
    return { ...row, is_closed: 0, close_reason: null, academy_event_id: null };
  });
  const beforeBlocks = blocksChanged ? state.blocks.filter(row => row.academy_event_id === old.id)
    .map(row => ({ blocked_date: row.blocked_date, time_slot: row.time_slot })) : [];
  const afterBlocks = blocksChanged ? slots.map(time_slot => ({ blocked_date: event.event_date, time_slot })) : [];
  const reservations = blocksChanged ? state.reservations.filter(row => slots.includes(timeSlot(row.preferred_time))) : [];
  return { event, before: { classes: beforeClasses, consultation_blocks: beforeBlocks },
    after: { classes: afterClasses, consultation_blocks: afterBlocks, unchanged_reservations_in_blocked_slots: reservations } };
}
function display(command, state) {
  const result = plan(command, state);
  const keys = new Set(['id', 'title', 'event_date', 'start_time', 'end_time', 'is_all_day', 'is_holiday', 'block_consultation', ...Object.keys(command.changes)]);
  const pick = row => Object.fromEntries([...keys].map(key => [key, row[key] ?? null]));
  return { before: { ...pick(state.record), related: result.before },
    after: { ...pick({ ...state.record, ...command.changes }), related: result.after } };
}
async function apply(conn, actor, command) {
  const changes = { ...command.changes };
  // MySQL returns HH:MM:SS. Equal times must not rebuild blocks outside the preview plan.
  for (const field of ['start_time', 'end_time']) if (changes[field]) changes[field] += ':00';
  const result = await events.updateEventInTransaction(conn, command.resource_id, actor.academy_id, changes, { patchOnly: true });
  if (result.status !== 200) fail(result.status, 'SCHEDULE_CONFLICT', result.message);
  return command.resource_id;
}
// 일정 화면의 등록(createEvent)과 같은 결과: 시간을 주면 종일 아님, 종료는 선택(상담 차단 시 필수)
function createPlan(command, state) {
  const changes = command.changes;
  if (changes.event_date < today()) fail(422, 'SCHEDULE_TIME_RANGE', '오늘 이전 날짜에는 일정을 만들 수 없습니다.');
  const timed = changes.start_time != null || changes.end_time != null;
  const allDay = changes.is_all_day ?? !timed;
  if (allDay && timed) fail(422, 'SCHEDULE_TIME_RANGE', '종일 일정에는 시작·종료 시간을 넣지 않습니다.');
  if (!allDay && !changes.start_time) fail(422, 'SCHEDULE_TIME_RANGE', '시작 시간을 넣어 주세요.');
  if (changes.end_time != null) timeRange(changes.start_time, changes.end_time, true);
  const { event, error } = events.normalizeEvent({ ...changes, is_all_day: allDay });
  if (error) fail(422, 'SCHEDULE_TIME_RANGE', error);
  const slots = events.consultationSlots(event);
  if (slots.some(slot => { const [start, end] = blocks.range({ time_slot: slot }); return state.blocks.some(row => blocks.overlaps(row, start, end)); })) {
    conflict('같은 날짜의 기존 상담 차단과 겹칩니다. 기존 차단을 먼저 확인해 주세요.');
  }
  if (event.is_holiday && (state.holidays.length || state.classes.some(row => row.is_closed || row.academy_event_id))) {
    conflict('같은 날짜에 다른 휴일 또는 별도 휴강이 있습니다. 해당 일정을 먼저 확인해 주세요.');
  }
  return { event, slots, related: {
    classes_to_close: event.is_holiday ? state.classes.map(({ id, class_date, time_slot }) => ({ id, class_date, time_slot })) : [],
    consultation_blocks: slots.map(time_slot => ({ blocked_date: event.event_date, time_slot })),
    unchanged_reservations_in_blocked_slots: state.reservations.filter(row => slots.includes(timeSlot(row.preferred_time))) } };
}
function createDisplay(command, state) {
  const { event, related } = createPlan(command, state);
  const keys = ['title', 'description', 'event_type', 'event_date', 'start_time', 'end_time', 'is_all_day', 'is_holiday', 'block_consultation', 'color'];
  return { before: null, after: { ...Object.fromEntries(keys.map(key => [key, event[key] ?? null])), related } };
}
async function create(conn, actor, command, state) {
  const { event, slots } = createPlan(command, state);
  for (const field of ['start_time', 'end_time']) if (event[field]) event[field] += ':00';
  const id = await eventRepo.insertEvent(conn, actor.academy_id, actor.user_id, event);
  for (const slot of slots) await eventRepo.addConsultationBlock(conn, id, actor.academy_id, event, slot);
  if (event.is_holiday) await eventRepo.closeClasses(conn, id, actor.academy_id, event);
  return Number(id);
}
module.exports = { display, apply, createDisplay, create };
