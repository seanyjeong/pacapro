const { fail } = require('./maxEngineError');
const list = value => typeof value === 'string' ? JSON.parse(value) : value || [];
function studentReason(row, date, slot) {
  if (!['active', 'trial'].includes(row.paca_status) && !(row.paca_status === 'pending' && row.is_trial === 1)) return '현재 재원·체험 배정 대상이 아닙니다.';
  if (row.paca_attendance_id && (!row.attendance_id || row.class_date !== date || row.attendance_slot !== slot)) return '연결된 PACA 출결의 날짜·시간대가 다릅니다.';
  if (row.is_closed) return '연결된 수업이 휴강입니다.';
  if (row.attendance_status === 'absent') return 'PACA에서 결석 처리된 학생입니다.';
  if (row.class_id != null) return '이미 반에 배치된 학생입니다.';
  return null;
}
function timeRange(state, slot) { return state.settings[0]?.[slot + '_class_time'] || null; }
function calendarBlocked(state, slot) {
  const range = timeRange(state, slot), parts = range?.split('-');
  return state.classes.length > 0 && state.classes.every(row => row.is_closed) || state.holidays.some(row => {
    if (row.is_all_day || !row.start_time || !row.end_time || !parts || parts.length !== 2) return true;
    return String(row.start_time).slice(0, 5) < parts[1] && String(row.end_time).slice(0, 5) > parts[0];
  });
}
function instructorReason(state, id) {
  const found = id < 0 ? state.owners.some(row => row.id === -id) : state.instructors.some(row => row.id === id);
  if (!found) return '현재 교육원의 재직 강사·원장이 아닙니다.';
  if (id > 0 && !state.schedules.some(row => row.instructor_id === id)) return '해당 날짜·시간대의 PACA 근무 일정이 없습니다.';
  if (state.teachers.some(row => row.instructor_id === id)) return '해당 시간대에 이미 반을 맡고 있습니다.';
  return null;
}
function planValues(changes, originals) {
  const exercises = (changes.exercises || []).map(request => {
    const source = originals.find(row => row.id === request.exercise_id);
    if (!source) fail(404, 'NOT_FOUND', '공유 또는 내 교육원 운동 id를 선택해 주세요.');
    return { ...request, name: source.name,
      ...(request.sets === undefined && source.default_sets != null ? { sets: source.default_sets } : {}),
      ...(request.reps === undefined && source.default_reps != null ? { reps: source.default_reps } : {}) };
  });
  return { tags: changes.tags || [], exercises, description: changes.description ?? null };
}
function validateSetup(changes, state) {
  if (calendarBlocked(state, changes.time_slot)) fail(409, 'PEAK_CLASS_CLOSED', '해당 날짜·시간대가 휴강·휴일입니다. 원본 수업 일정을 먼저 확인해 주세요.');
  const ids = [changes.instructor_id, ...(changes.assistant_instructor_ids || [])];
  if (new Set(ids).size !== ids.length) fail(422, 'PEAK_TEACHER_CONFLICT', '주강사와 보조강사는 서로 다른 id여야 합니다.');
  for (const id of ids) {
    const reason = instructorReason(state, id);
    if (reason) fail(409, 'PEAK_TEACHER_CONFLICT', reason);
  }
  if (state.teachers.some(row => row.class_num === changes.class_num) || state.assignments.some(row => row.class_id === changes.class_num)) {
    fail(409, 'PEAK_CLASS_EXISTS', '해당 반 번호에 이미 선생님 또는 학생이 있습니다. 빈 반 번호를 선택해 주세요.');
  }
  if (state.plans.some(row => ids.includes(row.instructor_id))) fail(409, 'PEAK_DUPLICATE', '선택한 선생님에게 이미 수업계획이 있습니다. 기존 계획을 조회해 주세요.');
  for (const id of changes.assignment_ids || []) {
    const row = state.assignments.find(item => item.id === id);
    if (!row) fail(404, 'NOT_FOUND', '내 교육원의 해당 날짜·시간대 학생 배정 id를 확인해 주세요.');
    const reason = studentReason(row, changes.date, changes.time_slot);
    if (reason) fail(409, 'PEAK_STUDENT_CONFLICT', reason);
  }
}
module.exports = { list, studentReason, timeRange, calendarBlocked, instructorReason, planValues, validateSetup };
