const { fail } = require('./maxEngineFullSecurity');
const list = value => typeof value === 'string' ? JSON.parse(value) : value || [];
const key = exercise => Number(exercise.exercise_id || exercise.id);
function values(command, before, at = new Date()) {
  const { operation, changes } = command, id = changes.exercise_id;
  const exercises = [...list(before.record.exercises)], completed = [...list(before.record.completed_exercises)];
  const rawTimes = before.record.exercise_times;
  const times = { ...(typeof rawTimes === 'string' ? JSON.parse(rawTimes) : rawTimes || {}) };
  const index = exercises.findIndex(e => key(e) === id);
  if (operation === 'peak_plan_exercise_add') {
    if (index >= 0) fail(409, 'PEAK_EXERCISE_CONFLICT', '이미 계획에 있는 운동입니다.');
    exercises.push({ ...changes, name: before.exercise.name });
  } else {
    if (index < 0) fail(409, 'PEAK_EXERCISE_CONFLICT', '계획에 없는 운동입니다. 먼저 운동을 추가해 주세요.');
    if (operation === 'peak_plan_exercise_remove') exercises.splice(index, 1);
    const complete = operation === 'peak_plan_exercise_complete' && changes.completed;
    if (complete && !completed.includes(id)) { completed.push(id); times[id] = at.toISOString(); }
    if (!complete) { const i = completed.indexOf(id); if (i >= 0) completed.splice(i, 1); delete times[id]; }
  }
  return { exercises, completed_exercises: completed, exercise_times: times };
}
module.exports = { values };
