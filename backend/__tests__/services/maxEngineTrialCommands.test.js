jest.mock('../../config/database', () => ({}));
const { commands } = require('../../constants/maxEngineTrialCommands');
const { plan, display } = require('../../services/maxEngineTrialCommands');
const state = () => ({ student: { id: 11, name: '합성학생', status: 'pending', is_trial: 0, trial_remaining: 0, trial_dates: [] }, attendance: [], schedules: [], holidays: [], settings: [{ afternoon_class_time: '15:00-17:30' }] });
const command = (operation = 'trial_register', changes = { trial_dates: [{ date: '2099-01-01', time_slot: 'afternoon' }] }) => ({ operation, resource_id: 11, changes });
test('register derives trial count, same identity, academy times and explicit attendance effects', () => {
  const view = display(command(), state());
  expect(view.before.student_id).toBe(11);
  expect(view.after).toMatchObject({ student_id: 11, status: 'trial', is_trial: 1, trial_remaining: 1,
    class_times: { afternoon_class_time: '15:00-17:30' }, related: { billing_changed: false, assign_schedules: [{ date: '2099-01-01', time_slot: 'afternoon' }] } });
});
test('reactivation preserves history and replaces only unmarked upcoming reservation', () => {
  const s = state();
  s.student.trial_dates = [{ date: '2020-01-01', time_slot: 'morning', attended: true }, { date: '2099-01-02', time_slot: 'morning', attended: false }];
  s.attendance = [{ id: 1, class_date: '2020-01-01', time_slot: 'morning', attendance_status: 'present' }, { id: 2, class_date: '2099-01-02', time_slot: 'morning', attendance_status: null }];
  const result = plan(command(), s);
  expect(result.trial_dates).toHaveLength(2);
  expect(result.trial_dates[0].attended).toBe(true);
  expect(result.related.remove_attendance.map(a => a.id)).toEqual([2]);
});
test('invalid, duplicate, past, closed, foreign-status and checked schedules fail', () => {
  for (const trial_dates of [[], [{ date: '2026-02-30', time_slot: 'morning' }], [{ date: '2099-01-01', time_slot: 'midnight' }], [{ date: '2099-01-01', time_slot: 'morning', attended: true }]]) {
    expect(commands.trial_register.schema.validate({ trial_dates }).error).toBeDefined();
  }
  expect(() => plan(command('trial_register', { trial_dates: [{ date: '2020-01-01', time_slot: 'morning' }] }), state())).toThrow();
  for (const status of ['active', 'paused', 'withdrawn', 'graduated', 'trial']) {
    const s = state(); s.student.status = status; expect(() => plan(command(), s)).toThrow();
  }
  const s = state(); s.schedules = [{ class_date: '2099-01-01', time_slot: 'afternoon', is_closed: 1 }];
  expect(() => plan(command(), s)).toThrow();
  s.schedules = []; s.holidays = [{ event_date: '2099-01-01' }]; expect(() => plan(command(), s)).toThrow();
  s.holidays = []; s.student.trial_dates = [{ date: '2099-01-01', time_slot: 'afternoon', attended: true }];
  expect(() => plan(command('trial_schedule_add', { date: '2099-01-01', time_slot: 'afternoon' }), s)).toThrow();
  expect(() => plan(command('trial_schedule_update', { previous_date: '2099-01-01', previous_time_slot: 'afternoon', date: '2099-01-02', time_slot: 'morning' }), s)).toThrow();
});

test('malformed stored schedules cannot be silently discarded', () => {
  const s = state(); s.student.trial_dates = '[{"date":"2099-01-01"}]';
  expect(() => plan(command(), s)).toThrow(/불완전/);
});
