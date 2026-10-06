const { Joi, text, date, id } = require('./maxEngineInput');
const { planFields } = require('./maxEngineTeachingCommands');
const value = Joi.string().pattern(/^-?(0|[1-9]\d{0,7})(\.\d{1,2})?$/);
const environment = { temperature: Joi.number().min(-50).max(80).precision(1).allow(null),
  humidity: Joi.number().integer().min(0).max(100).allow(null) };
const log = { condition_score: Joi.number().integer().min(1).max(5).allow(null), notes: text(4000), ...environment };
const plan = { description: text(10000) };
const spec = (resource, label, fields, notice) => ({ resource, provider: 'peak', label,
  schema: Joi.object(fields).min(1).unknown(false), notice });
const commands = {
  peak_record_create: spec('student_records', 'PEAK 실기 기록 등록', {
    student_id: id.required(), record_type_id: id.required(), measured_at: date.required(),
    value: value.required(), notes: text(4000) }, 'PEAK 학생 id를 사용합니다. 같은 학생·종목·날짜 기록이 있으면 기존 id의 수정 미리보기를 사용하세요.'),
  peak_record_update: spec('student_records', 'PEAK 실기 기록 부분 수정', { value, notes: text(4000) },
    '한 기록만 수정합니다. 생략된 기록값·메모는 보존하며 종목별 허용 범위를 검사합니다.'),
  peak_record_delete: spec('student_records', 'PEAK 실기 기록 한 건 삭제', { reason: Joi.string().min(1).max(255).required() },
    '미리보기에서 학생·종목·날짜·기록값을 확인하세요. 확인하면 이 기록 한 건을 삭제합니다.'),
  peak_training_create: spec('training_logs', 'PEAK 훈련 일지 등록', {
    date: date.required(), student_id: id.required(), trainer_id: Joi.number().integer().invalid(0).required(),
    plan_id: id.allow(null), ...log }, 'trainer_id는 PACA 강사 id, 원장은 음수 PACA 사용자 id입니다. 학생·강사·계획의 교육원을 검사합니다.'),
  peak_training_update: spec('training_logs', 'PEAK 훈련 일지 부분 수정', log,
    '한 일지의 컨디션·메모·온습도만 수정합니다.'),
  peak_plan_create: spec('daily_plans', 'PEAK 훈련 계획 등록', {
    date: date.required(), time_slot: Joi.string().valid('morning', 'afternoon', 'evening').required(),
    instructor_id: Joi.number().integer().invalid(0).required(), ...plan, ...planFields }, '같은 날짜·시간대·강사 계획이 있으면 기존 id를 사용하세요. exercises를 보내면 실제 운동 항목·세트·횟수·순서까지 저장하며 생략하면 빈 계획을 만듭니다.'),
  peak_plan_exercise_add: spec('daily_plans', 'PEAK 계획에 운동 한 건 추가', {
    exercise_id: id.required(), sets: Joi.number().integer().min(1).max(100),
    reps: Joi.number().integer().min(1).max(10000), note: text(4000) }, '공유 또는 내 교육원 운동만 추가할 수 있습니다. 운동 이름은 원본 운동에서 가져옵니다.'),
  peak_plan_exercise_remove: spec('daily_plans', 'PEAK 계획의 운동 한 건 제거', { exercise_id: id.required() },
    '선택한 운동과 그 운동의 완료 표시만 제거하며 나머지 운동은 보존합니다.'),
  peak_plan_exercise_complete: spec('daily_plans', 'PEAK 계획 운동 완료 상태 설정', { exercise_id: id.required(), completed: Joi.boolean().required() },
    '토글 대신 완료 여부를 명시합니다. 같은 확인을 재시도해도 완료 상태가 뒤집히지 않습니다.'),
  peak_plan_update: spec('daily_plans', 'PEAK 훈련 계획 부분 수정', plan,
    '설명만 부분 수정하며 운동 목록·완료 기록은 보존합니다.'),
};
const TABLES = new Set(['students', 'record_types', 'student_records', 'training_logs', 'daily_plans', 'exercises']);
module.exports = { commands, TABLES };
