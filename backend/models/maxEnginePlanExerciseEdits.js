const { fail } = require('./maxEngineError');
const { list, planValues } = require('./maxEngineTeaching');
const key = item => Number(item.exercise_id || item.id);
function applySteps(record, steps, sources) {
  const exercises = list(record.exercises).map(item => ({ ...item }));
  let completed = [...list(record.completed_exercises)];
  const times = { ...(typeof record.exercise_times === 'string' ? JSON.parse(record.exercise_times) : record.exercise_times || {}) };
  for (const step of steps) {
    const index = exercises.findIndex(item => key(item) === step.exercise_id);
    if (step.action === 'add') {
      if (index >= 0) fail(409, 'PEAK_EXERCISE_CONFLICT', '이미 계획에 있는 운동입니다. update 또는 move를 사용해 주세요.');
      const values = { ...step }, position = step.position;
      delete values.action; delete values.position;
      const item = planValues({ exercises: [values] }, sources).exercises[0];
      insert(exercises, item, position ?? exercises.length + 1);
    } else {
      if (index < 0) fail(409, 'PEAK_EXERCISE_CONFLICT', '계획에 없는 운동입니다. 먼저 add로 추가해 주세요.');
      if (step.action === 'update') {
        for (const field of ['sets','reps','weight','note']) if (Object.hasOwn(step, field)) exercises[index][field] = step[field];
      } else {
        const [item] = exercises.splice(index, 1);
        if (step.action === 'move') insert(exercises, item, step.position);
        else {
          completed = completed.filter(id => Number(id) !== step.exercise_id);
          delete times[step.exercise_id];
        }
      }
    }
  }
  if (exercises.length > 50) fail(422, 'PEAK_EXERCISE_CONFLICT', '한 계획의 운동은 최대50개입니다.');
  return { exercises, completed_exercises: completed, exercise_times: times };
}
function insert(items, item, position) {
  if (!Number.isInteger(position) || position < 1 || position > items.length + 1) {
    fail(422, 'PEAK_EXERCISE_CONFLICT', '운동 순서는 현재 목록 안의 1부터 시작하는 위치여야 합니다.');
  }
  items.splice(position - 1, 0, item);
}
module.exports = { applySteps };
