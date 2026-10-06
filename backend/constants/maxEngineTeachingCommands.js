const { Joi, text, date, id } = require('./maxEngineInput');
const instructorId = Joi.number().integer().invalid(0);
const slot = Joi.string().valid('morning', 'afternoon', 'evening');
const exerciseFields = { exercise_id: id.required(), sets: Joi.number().integer().min(1).max(100),
  reps: Joi.number().integer().min(1).max(10000), weight: text(120), note: text(4000) };
const exercise = Joi.object(exerciseFields).unknown(false);
const planFields = {
  tags: Joi.array().items(Joi.string().min(1).max(60)).unique().max(20),
  exercises: Joi.array().items(exercise).unique('exercise_id').min(1).max(50),
};
const position = Joi.number().integer().min(1).max(50);
const editSteps = Joi.array().items(Joi.alternatives().try(
  Joi.object({ action: Joi.valid('add').required(), ...exerciseFields, position }).unknown(false),
  Joi.object({ action: Joi.valid('update').required(), ...exerciseFields }).or('sets','reps','weight','note').unknown(false),
  Joi.object({ action: Joi.valid('move').required(), exercise_id: id.required(), position: position.required() }).unknown(false),
  Joi.object({ action: Joi.valid('remove').required(), exercise_id: id.required() }).unknown(false),
)).min(1).max(50);
const timing = { date: date.required(), time_slot: slot.required() };
const commands = {
  peak_exercise_create: { resource: 'exercises', provider: 'peak', label: '내 교육원 운동관리 항목 등록',
    schema: Joi.object({ name: Joi.string().min(1).max(100).required(), tags: planFields.tags,
      default_sets: Joi.number().integer().min(1).max(100), default_reps: Joi.number().integer().min(1).max(10000),
      description: text(4000), video_url: Joi.string().uri({ scheme: ['https'] }).max(500).allow(null) }).unknown(false),
    notice: '운동 설명문만 수업계획에 넣는 대신 운동관리에 실제 항목을 등록합니다. 공유 운동을 바꾸지 않으며 내 교육원의 새 운동 id를 반환합니다. 기존 운동이 있으면 그 id를 사용하세요.' },
  peak_plan_exercises_update: { resource: 'daily_plans', provider: 'peak', label: '수업계획 운동 추가·부분 수정·순서 이동·제거',
    schema: Joi.object({ steps: editSteps.required(), description: text(10000) }).unknown(false),
    notice: 'steps를 순서대로 적용합니다. position은 1부터 시작합니다. 목록 전체 교체가 아니라 지정 운동만 바꿉니다. 다른 운동·설명·태그·완료 기록은 보존하며 제거한 운동의 완료 표시만 정리합니다.' },
  peak_class_setup_create: { resource: 'daily_plans', provider: 'peak', label: '빈 반에 선생님·학생 배정 및 수업계획 함께 작성',
    schema: Joi.object({ ...timing, class_num: id.max(1000).required(), instructor_id: instructorId.required(),
      assistant_instructor_ids: Joi.array().items(instructorId).unique().max(10),
      assignment_ids: Joi.array().items(id).unique().max(200), description: text(10000),
      ...planFields, exercises: planFields.exercises.required() }).unknown(false),
    notice: '먼저 teaching_context로 근무 일정·빈 반·미배정 학생·운동을 확인하세요. 같은 시간대에 다른 반을 맡은 강사·근무 미등록 강사·결석 학생은 배정하지 않습니다. 학생 배정은 선택한 기존 배정 id만 이동합니다. 주강사 계획에 운동을 저장하고 선생님·학생 배정과 계획을 한 트랜잭션으로 적용합니다.' },
  peak_instructor_assignment_create: { resource: 'class_instructors', provider: 'peak', label: '수업 반에 선생님 배정',
    schema: Joi.object({ ...timing, class_num: id.max(1000).required(), instructor_id: instructorId.required(),
      is_main: Joi.boolean().required() }).unknown(false),
    notice: '해당 시간대 근무 등록 강사 또는 원장만 배정합니다. 기존 다른 반 배정은 이동하지 않습니다. 주강사로 배정하면 같은 반의 기존 주강사는 보조로 전환되며 학생·계획·완료 기록은 보존합니다.' },
};
module.exports = { commands, planFields };
