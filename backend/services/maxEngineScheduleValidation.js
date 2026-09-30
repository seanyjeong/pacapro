const { fail } = require('../models/maxEngineError');
const { TIME_SLOTS, MORNING_END_HOUR, AFTERNOON_END_HOUR } = require('../constants/academyEvents');

const clock = value => typeof value === 'string' ? value.slice(0, 5) : value;
function timeSlot(time) {
  const hour = Number(time.slice(0, 2));
  return TIME_SLOTS[hour < MORNING_END_HOUR ? 0 : hour < AFTERNOON_END_HOUR ? 1 : 2];
}
function blocksTime(block, time) {
  if (block.is_all_day) return true;
  if (block.time_slot) return block.time_slot === timeSlot(time);
  return Boolean(block.start_time && block.end_time && clock(block.start_time) <= clock(time) && clock(time) < clock(block.end_time));
}
function timeRange(start, end, required = false) {
  if (start == null && end == null && !required) return;
  if (!start || !end || clock(start) >= clock(end)) {
    fail(422, 'SCHEDULE_TIME_RANGE', '시작·종료 시간을 함께 지정하고 종료 시간을 시작 시간보다 늦게 입력해 주세요.');
  }
}
function conflict(message) { fail(409, 'SCHEDULE_CONFLICT', message); }
module.exports = { clock, timeSlot, blocksTime, timeRange, conflict };
