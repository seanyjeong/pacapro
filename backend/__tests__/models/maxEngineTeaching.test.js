jest.mock('../../config/database', () => ({}));
const { applySteps } = require('../../models/maxEnginePlanExerciseEdits');
const { planValues, validateSetup, calendarBlocked, studentReason } = require('../../models/maxEngineTeaching');
const { commands } = require('../../constants/maxEngineTeachingCommands');
const record = { description: '긴 설명만 있는 기존 계획', tags: '["유지"]', exercises: '[]', completed_exercises: '[]', exercise_times: '{}', extra_exercises: '[{"id":99}]' };
const library = [{ id: 1, name: '준비운동', default_sets: 1, default_reps: 10 }, { id: 2, name: '점프', default_sets: 3, default_reps: 5 }];
test('description-only plan becomes ordered real exercises, with defaults from the actual library', () => {
  const result = applySteps(record, [{ action: 'add', exercise_id: 2 }, { action: 'add', exercise_id: 1, position: 1 },
    { action: 'update', exercise_id: 2, reps: 6, weight: '맨몸', note: '3세트' }], library);
  expect(result.exercises).toEqual([{ exercise_id: 1, name: '준비운동', sets: 1, reps: 10 }, { exercise_id: 2, name: '점프', sets: 3, reps: 6, weight:'맨몸', note:'3세트' }]);
  expect(record.exercises).toBe('[]');
  expect(planValues({ exercises: [{ exercise_id: 1 }] }, [{ id: 1, name: '운동', default_sets: null, default_reps: null }]).exercises[0]).toEqual({ exercise_id: 1, name: '운동' });
});
test('move and partial edit preserve other exercises and completion; remove only clears the selected completion', () => {
  const before = { ...record, exercises: [{ exercise_id: 1, name: '준비운동', sets: 2, note: '보존' }, { id: 2, name: '점프', sets: 3 }],
    completed_exercises: [1, 2], exercise_times: { 1: 'first', 2: 'second' } };
  const moved = applySteps(before, [{ action: 'move', exercise_id: 2, position: 1 }, { action: 'update', exercise_id: 1, reps: 10 }], []);
  expect(moved.exercises.map(e => e.exercise_id || e.id)).toEqual([2, 1]);
  expect(moved.exercises[1]).toMatchObject({ sets: 2, reps: 10, note: '보존' });
  expect(moved.completed_exercises).toEqual([1, 2]); expect(moved.exercise_times).toEqual(before.exercise_times);
  expect(applySteps(before, [{ action: 'remove', exercise_id: 1 }], []).exercise_times).toEqual({ 2: 'second' });
});
test('invalid edit fails without modifying the original and schema forbids whole-list replacement', () => {
  for (const steps of [[{ action: 'move', exercise_id: 1, position: 1 }], [{ action: 'add', exercise_id: 1, position: 2 }],
    [{ action: 'add', exercise_id: 1 }, { action: 'add', exercise_id: 1 }], [{ action: 'add', exercise_id: 90 }]]) {
    expect(() => applySteps(record, steps, library)).toThrow();
  }
  expect(commands.peak_plan_exercises_update.schema.validate({ exercises: [] }).error).toBeDefined();
  expect(commands.peak_plan_exercises_update.schema.validate({ steps: [{ action: 'update', exercise_id: 1 }] }).error).toBeDefined();
});
const state = () => ({ owners: [{ id: 1 }], instructors: [{ id: 3 }], schedules: [{ instructor_id: 3 }], teachers: [],
  assignments: [], plans: [], holidays: [], classes: [], settings: [{ afternoon_class_time: '14:00-18:00' }] });
const setup = { date: '2026-10-07', time_slot: 'afternoon', class_num: 1, instructor_id: 3, assignment_ids: [] };
test('teacher selection requires schedule and rejects double assignment, duplicate roles and a nonempty class', () => {
  expect(() => validateSetup(setup, state())).not.toThrow();
  const s = state(); s.schedules = [];
  expect(() => validateSetup(setup, s)).toThrow('근무 일정');
  expect(() => validateSetup({ ...setup, instructor_id: -1 }, s)).not.toThrow();
  expect(() => validateSetup({ ...setup, assistant_instructor_ids: [3] }, state())).toThrow('서로 다른');
  s.teachers = [{ instructor_id: -1, class_num: 1 }];
  expect(() => validateSetup(setup, s)).toThrow();
});
test('holiday time windows and completed trial snapshots follow source calendar and roster rules', () => {
  const s = state(); s.holidays = [{ is_all_day: 0, start_time: '09:00:00', end_time: '12:00:00' }];
  expect(calendarBlocked(s, 'afternoon')).toBe(false);
  s.holidays[0].end_time = '15:00:00'; expect(calendarBlocked(s, 'afternoon')).toBe(true);
  expect(studentReason({ paca_status: 'pending', is_trial: 1 }, setup.date, setup.time_slot)).toBeNull();
  expect(studentReason({ paca_status: 'pending', is_trial: 0 }, setup.date, setup.time_slot)).toMatch('대상');
  expect(studentReason({ paca_status: 'active', attendance_status: 'absent' }, setup.date, setup.time_slot)).toMatch('결석');
});
test('new work schedule rejects reversed, duplicate and overlapping shifts', () => {
  const { display }=require('../../services/maxEngineInstructorScheduleCreate');
  const c={instructor_id:1,work_date:'2026-10-07',time_slot:'afternoon',scheduled_start_time:'14:00',scheduled_end_time:'18:00'};
  const before={instructor:{name:'합성'},schedules:[]};
  expect(display({changes:c},before).after.instructor_name).toBe('합성');
  expect(()=>display({changes:{...c,scheduled_end_time:'13:00'}},before)).toThrow('종료');
  expect(()=>display({changes:c},{...before,schedules:[{time_slot:'afternoon'}]})).toThrow('이미');
  expect(()=>display({changes:c},{...before,schedules:[{time_slot:'morning',scheduled_start_time:'12:00:00',scheduled_end_time:'15:00:00'}]})).toThrow('겹칩니다');
});
