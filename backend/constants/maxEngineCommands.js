const Joi = require('joi');
const text = max => Joi.string().max(max).allow('', null);
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((v, h) =>
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : h.error('any.invalid'));
const profile = {
  name: Joi.string().min(1).max(60), phone: Joi.string().pattern(/^[0-9+() -]{3,30}$/),
  gender: Joi.string().valid('male', 'female').allow(null), parent_phone: text(30),
  school: text(200), grade: text(20), address: text(400), father_name: text(60), mother_name: text(60),
  memo: text(4000), notes: text(4000),
};
const record = {
  consultation_date: date, consultation_type: Joi.string().valid('regular', 'admission', 'parent', 'counseling'),
  admission_type: Joi.string().valid('early', 'regular', 'both').allow(null),
  school_grade_avg: Joi.number().min(0).max(9.99).allow(null),
  mock_test_scores: Joi.object().max(50).allow(null), physical_records: Joi.object().max(60).allow(null),
  academic_memo: text(10000), physical_record_type: Joi.string().valid('latest', 'average').allow(null),
  physical_memo: text(10000), target_university_1: text(100), target_university_2: text(100),
  target_memo: text(10000), general_memo: text(10000),
};
const commands = {
  ...require('./maxEngineScheduleCommands').commands,
  student_create: { resource: 'students', provider: 'paca', label: '학생 기본정보 등록',
    schema: Joi.object({ ...profile, name: profile.name.required(), phone: profile.phone.required(),
      enrollment_date: date.required(), registration_source: Joi.string().valid('max_engine') }).unknown(false),
    notice: 'registration_source=max_engine이면 예비생으로 등록하고 메모에 엔진등록을 남깁니다. 수업 요일·수강료는 0으로 시작합니다.' },
  student_update: { resource: 'students', provider: 'paca', label: '학생 기본정보 부분 수정',
    schema: Joi.object(profile).min(1).unknown(false) },
  consultation_create: { resource: 'consultations', provider: 'paca', label: '재원생 상담 기록 등록',
    schema: Joi.object({ student_id: Joi.number().integer().positive().required(),
      preferred_date: date.required(), preferred_time: Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/).required(),
      learning_type: Joi.string().valid('regular', 'admission', 'parent', 'counseling').required(),
      admin_notes: text(10000), consultation_memo: text(10000) }).unknown(false) },
  consultation_update: { resource: 'consultations', provider: 'paca', label: '상담 메모 부분 수정',
    schema: Joi.object({ admin_notes: text(10000), consultation_memo: text(10000) }).min(1).unknown(false) },
  consultation_record_create: { resource: 'student_consultations', provider: 'paca', label: '성적·실기·목표 대학 상담 기록 등록',
    schema: Joi.object({ ...record, student_id: Joi.number().integer().positive().required(),
      consultation_id: Joi.number().integer().positive(), consultation_date: date.required(),
      consultation_type: record.consultation_type.required() }).unknown(false) },
  consultation_record_update: { resource: 'student_consultations', provider: 'paca', label: '상담 기록 부분 수정',
    schema: Joi.object(record).min(1).unknown(false) },
  attendance_set: { resource: 'attendance', provider: 'paca', label: '학생 출결 정정',
    schema: Joi.object({ attendance_status: Joi.string().valid('present', 'absent', 'late', 'excused').allow(null).required(),
      notes: text(4000) }).unknown(false), notice: 'PACA 원본 출결과 체험 잔여 횟수를 함께 갱신합니다. 문자 발송은 하지 않습니다.' },
  payment_pay: { resource: 'student_payments', provider: 'paca', label: '수강료 납부 처리',
    schema: Joi.object({ paid_amount: Joi.string().pattern(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/).required(),
      payment_date: date.required(), payment_method: Joi.string().valid('account', 'card', 'cash', 'other').required(),
      notes: text(4000) }).unknown(false), notice: '납부금액을 기존 수납액에 더하고 같은 트랜잭션에서 수입 장부를 기록합니다.' },
};
const encryptedFields = ['name', 'phone', 'parent_phone', 'address', 'father_name', 'mother_name'];
module.exports = { commands, encryptedFields };
