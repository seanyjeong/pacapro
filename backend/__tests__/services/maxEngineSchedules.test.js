jest.mock('../../config/database', () => ({}));
jest.mock('../../config/peak-database', () => ({}));
const { validate } = require('../../services/maxEngineFullCommands');
const schedules = require('../../services/maxEngineScheduleCommands');
const { blocksTime } = require('../../services/maxEngineScheduleValidation');
const command = (operation, changes) => ({ operation, resource_id: 1, changes });

test.each([
  ['class_schedule_update', { class_date: '2028-02-29', title: null }],
  ['instructor_schedule_update', { scheduled_start_time: '09:30', scheduled_end_time: '12:00' }],
  ['academy_event_update', { event_date: '2026-10-01', is_all_day: true }],
  ['consultation_reschedule', { preferred_time: '15:30' }],
])('accepts strict partial fields: %s', (operation, changes) => {
  expect(validate(command(operation, changes))).toEqual(command(operation, changes));
});
test.each([
  ['class_schedule_update', { class_date: '2026-02-29' }],
  ['class_schedule_update', { class_date: '0000-01-01' }],
  ['class_schedule_update', { time_slot: 'night' }],
  ['class_schedule_update', { academy_id: 2 }],
  ['class_schedule_update', {}],
  ['instructor_schedule_update', { scheduled_start_time: '24:00' }],
  ['instructor_schedule_update', { instructor_id: 2 }],
  ['academy_event_update', { title: '  ' }],
  ['academy_event_update', { is_all_day: 'false' }],
  ['academy_event_update', { block_consultation: 1 }],
  ['consultation_reschedule', { status: 'confirmed' }],
  ['consultation_reschedule', { preferred_date: null }],
])('rejects malformed or unrelated fields: %s %j', (operation, changes) => {
  expect(() => validate(command(operation, changes))).toThrow();
});
test('partial time change validates against the existing other endpoint', () => {
  const before = { record: { work_date: '2026-10-01', time_slot: 'morning', scheduled_start_time: '09:00:00', scheduled_end_time: '12:00:00' }, attendance: [], duplicates: [] };
  expect(() => schedules.display(command('instructor_schedule_update', { scheduled_start_time: '13:00' }), before)).toThrow(/종료 시간/);
  expect(() => schedules.display(command('instructor_schedule_update', { scheduled_end_time: null }), before)).toThrow();
  expect(schedules.display(command('instructor_schedule_update', { scheduled_end_time: '13:00' }), before).after.scheduled_start_time).toBe('09:00:00');
});
test('manual time blocks, whole days and slot boundary use the public calendar semantics', () => {
  expect(blocksTime({ time_slot: 'morning' }, '12:00')).toBe(false);
  expect(blocksTime({ time_slot: 'afternoon' }, '12:00')).toBe(true);
  expect(blocksTime({ time_slot: 'afternoon' }, '18:00')).toBe(false);
  expect(blocksTime({ is_all_day: 1 }, '19:00')).toBe(true);
  expect(blocksTime({ start_time: '14:00:00', end_time: '15:00:00' }, '14:30')).toBe(true);
  expect(blocksTime({ start_time: '14:00:00', end_time: '15:00:00' }, '15:00')).toBe(false);
});
test('event preview includes the exact linked closure and consultation block changes', () => {
  const record = { id: 1, title: '행사', event_date: '2026-10-01', is_all_day: 1, is_holiday: 1, block_consultation: true };
  const state = { record, holidays: [], reservations: [{ id: 5, preferred_date: '2026-10-02', preferred_time: '13:00:00' }],
    blocks: [{ academy_event_id: 1, blocked_date: record.event_date, time_slot: 'morning' }],
    classes: [{ id: 2, class_date: record.event_date, is_closed: 1, academy_event_id: 1 },
      { id: 3, class_date: '2026-10-02', is_closed: 0, academy_event_id: null }] };
  const result = schedules.display(command('academy_event_update', { event_date: '2026-10-02' }), state);
  expect(result.after.related.classes.map(row => [row.id, row.is_closed, row.academy_event_id])).toEqual([[2, 0, null], [3, 1, 1]]);
  expect(result.after.related.consultation_blocks).toHaveLength(3);
  expect(result.after.related.unchanged_reservations_in_blocked_slots).toEqual(state.reservations);
  expect(record.event_date).toBe('2026-10-01');
});
