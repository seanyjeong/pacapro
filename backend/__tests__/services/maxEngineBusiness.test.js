jest.mock('../../config/database', () => ({ execute: jest.fn() }));
jest.mock('../../config/peak-database', () => ({ execute: jest.fn() }));
const { validate, catalog } = require('../../services/maxEngineFullCommands');
const lifecycle = require('../../services/maxEngineLifecycleCommands');
const peak = require('../../services/maxEnginePeakCommands');
const plan = require('../../services/maxEnginePeakPlanExercises');
const student = { id: 1, name: '합성학생', status: 'active', class_days: '[]', monthly_tuition: '100.00' };
test('withdrawal preview shows concrete attendance removals and preserved billing', () => {
  const command = validate({ operation: 'student_withdraw', resource_id: 1, changes: { withdrawal_date: '2026-10-03', reason: '이사' } });
  const view = lifecycle.display(command, { student, today: '2026-10-03', invoices: [], seasons: [], reservations: [{ id: 8, class_date: '2026-10-03', attendance_status: 'present' }] });
  expect(view.after.status).toBe('withdrawn');
  expect(view.after.related).toMatchObject({ attendance_to_remove: [{ id: 8 }], payment_changes: [], future_monthly_billing: false });
});
test('future withdrawal, repeat withdrawal and pause credit bypass fail closed', () => {
  const withdraw = day => ({ operation: 'student_withdraw', changes: { withdrawal_date: day } });
  expect(() => lifecycle.display(withdraw('2026-10-04'), { student, today: '2026-10-03' })).toThrow('퇴원 예약');
  expect(() => lifecycle.display(withdraw('2026-10-03'), { student: { ...student, status: 'withdrawn' } })).toThrow('이미 퇴원');
  for (const status of ['paused', 'pending', 'trial', 'prospect', 'active']) expect(() => lifecycle.display(
    { operation: 'student_reactivate', changes: {} }, { student: { ...student, status } })).toThrow();
  for (const status of ['withdrawn', 'graduated']) expect(lifecycle.display(
    { operation: 'student_reactivate', changes: {} }, { student: { ...student, status }, reservations: [] }).after.status).toBe('active');
});
test('command schema rejects impossible dates, scope changes, raw status changes and numeric coercion', () => {
  for (const command of [
    { operation: 'student_withdraw', resource_id: 1, changes: { withdrawal_date: '2026-02-30' } },
    { operation: 'student_reactivate', resource_id: 1, changes: { academy_id: 2 } },
    { operation: 'student_update', resource_id: 1, changes: { status: 'withdrawn' } },
    { operation: 'peak_record_create', changes: { student_id: 1, record_type_id: 1, measured_at: '2026-10-03', value: 250 } },
    { operation: 'peak_record_delete', resource_id: 1, changes: {} },
    { operation: 'peak_training_update', resource_id: 1, changes: { condition_score: 6 } },
    { operation: 'peak_plan_update', resource_id: 1, changes: { exercises: [] } },
  ]) expect(() => validate(command)).toThrow();
  expect(validate({ operation: 'student_reactivate', resource_id: 1, changes: {} }).changes).toEqual({});
});
test('record range and inactive type are checked before confirmation', () => {
  const state = { record: { value: '250', notes: 'keep' }, type: { is_active: 1, min_value: '1', max_value: '300', name: '제멀', unit: 'cm' } };
  const command = { operation: 'peak_record_update', changes: { value: '300.01' } };
  expect(() => peak.display(command, state)).toThrow('범위');
  expect(() => peak.display({ ...command, changes: { value: '250' } }, { ...state, type: { ...state.type, is_active: 0 } })).toThrow('비활성');
  expect(peak.display({ ...command, changes: { notes: null } }, state).after).toMatchObject({ value: '250', notes: null });
});
test('exercise completion is explicit and preserves other exercise history', () => {
  const before = { record: { exercises: [{ exercise_id: 3, name: '운동' }, { exercise_id: 4 }], completed_exercises: [4], exercise_times: { 4: 'old' } } };
  const complete = { operation: 'peak_plan_exercise_complete', changes: { exercise_id: 3, completed: true } };
  const first = plan.values(complete, before, new Date('2026-10-03T03:00:00Z'));
  const again = plan.values(complete, { record: first }, new Date('2026-10-03T04:00:00Z'));
  expect(again).toEqual(first);
  const removed = plan.values({ operation: 'peak_plan_exercise_remove', changes: { exercise_id: 3 } }, { record: first });
  expect(removed).toMatchObject({ exercises: [{ exercise_id: 4 }], completed_exercises: [4], exercise_times: { 4: 'old' } });
  expect(() => plan.values({ ...complete, changes: { exercise_id: 9, completed: true } }, before)).toThrow('계획에 없는');
});
test('both providers advertise both source families and lifecycle commands', () => {
  for (const provider of ['paca', 'peak']) {
    expect(catalog(provider).map(c => c.operation)).toEqual(expect.arrayContaining(['student_withdraw', 'student_reactivate', 'peak_record_create', 'peak_plan_exercise_complete']));
    const record = catalog(provider).find(c => c.operation === 'peak_record_create');
    expect(record).toMatchObject({ source: 'peak', resource: provider === 'paca' ? 'peak_student_records' : 'student_records' });
  }
});

test('withdrawal uses the KST calendar date across the UTC midnight boundary', async () => {
  jest.useFakeTimers().setSystemTime(new Date('2026-10-02T15:05:00Z'));
  try {
    const conn = { execute: jest.fn().mockResolvedValue([[]]).mockResolvedValueOnce([[student]]) };
    const state = await lifecycle.state(conn, {academy_id:1}, {operation:'student_withdraw',resource_id:1,changes:{withdrawal_date:'2026-10-03'}}, false);
    expect(state.today).toBe('2026-10-03');
    expect(conn.execute.mock.calls[1][1]).toEqual([1,1,'2026-10-03','2026-10-03']);
  } finally { jest.useRealTimers(); }
});
test('returning a withdrawn trial clears trial flags like the existing student update flow', () => {
  const after = lifecycle.display({operation:'student_reactivate',changes:{}}, {
    student:{...student,status:'withdrawn',is_trial:1,trial_remaining:2},reservations:[]}).after;
  expect(after).toMatchObject({status:'active',is_trial:0,trial_remaining:0});
});
