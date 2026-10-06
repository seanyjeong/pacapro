const repository = require('../repositories/maxEngineTeachingRepository');
const common = require('../repositories/maxEngineFullCommandRepository');
const { fail, decrypt } = require('./maxEngineFullSecurity');
const model = require('../models/maxEngineTeaching');
const supports = operation => ['peak_class_setup_create','peak_instructor_assignment_create'].includes(operation);
async function state(conn, actor, command, lock) {
  const c = command.changes;
  const before = await repository.state(conn, actor.academy_id, c.date, c.time_slot, lock);
  before.exercises = await repository.exercises(conn, actor.academy_id, (c.exercises || []).map(row => row.exercise_id), lock);
  return before;
}
function teacher(state, id) {
  const source = (id < 0 ? state.owners : state.instructors).find(row => row.id === Math.abs(id));
  return { instructor_id: id, name: decrypt(source?.name ?? null), is_owner: id < 0 };
}
function display(command, before) {
  const c = command.changes;
  if (command.operation === 'peak_class_setup_create') {
    model.validateSetup(c, before);
    return { before: { class_num: c.class_num, instructors: [], selected_students: (c.assignment_ids || []).map(id => {
      const row = before.assignments.find(item => item.id === id);
      return { assignment_id: row.id, peak_student_id: row.student_id, name: decrypt(row.name), class_num: row.class_id };
    }), plan: null }, after: {
      date: c.date, time_slot: c.time_slot, class_num: c.class_num,
      main_instructor: teacher(before, c.instructor_id),
      assistants: (c.assistant_instructor_ids || []).map(id => teacher(before, id)),
      student_count: (c.assignment_ids || []).length,
      plan: model.planValues(c, before.exercises),
      warnings: (c.assignment_ids || []).length ? [] : ['학생은 선택하지 않아 선생님 배정과 수업계획만 만듭니다.'],
    } };
  }
  if (model.calendarBlocked(before, c.time_slot)) fail(409, 'PEAK_CLASS_CLOSED', '휴강·휴일에는 선생님을 배정할 수 없습니다.');
  const reason = model.instructorReason(before, c.instructor_id);
  if (reason) fail(409, 'PEAK_TEACHER_CONFLICT', reason);
  const current = before.teachers.filter(row => row.class_num === c.class_num);
  if (!current.length && !c.is_main) fail(409, 'PEAK_TEACHER_CONFLICT', '빈 반에는 먼저 주강사를 배정해 주세요.');
  return { before: { date: c.date, time_slot: c.time_slot, class_num: c.class_num,
    instructors: current.map(row => ({ ...teacher(before, row.instructor_id), is_main: Boolean(row.is_main) })) },
  after: { ...c, instructor: teacher(before, c.instructor_id),
    previous_main_becomes_assistant: c.is_main ? current.filter(row => row.is_main).map(row => row.instructor_id) : [] } };
}
async function apply(conn, actor, command, before) {
  const c = command.changes, academy = actor.academy_id;
  if (command.operation === 'peak_instructor_assignment_create') {
    const current = before.teachers.filter(row => row.class_num === c.class_num);
    if (c.is_main) await repository.demoteMain(conn, academy, c);
    return repository.addInstructor(conn, academy, c, c.is_main, c.is_main ? 0 : Math.max(-1, ...current.map(row => row.order_num)) + 1);
  }
  await repository.addInstructor(conn, academy, c, true, 0);
  for (const [index, id] of (c.assistant_instructor_ids || []).entries()) {
    await repository.addInstructor(conn, academy, { ...c, instructor_id: id }, false, index + 1);
  }
  await repository.assignStudents(conn, academy, c);
  const values = model.planValues(c, before.exercises);
  return common.insert(conn, 'daily_plans', { academy_id: academy, date: c.date, time_slot: c.time_slot,
    instructor_id: c.instructor_id, trainer_id: c.instructor_id, description: values.description,
    tags: JSON.stringify(values.tags), exercises: JSON.stringify(values.exercises),
    completed_exercises: '[]', extra_exercises: '[]', exercise_times: '{}' });
}
module.exports = { supports, state, display, apply };
