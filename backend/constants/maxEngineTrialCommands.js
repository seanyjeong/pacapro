const Joi = require('joi');
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((v, h) =>
  !Number.isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v ? v : h.error('any.invalid'));
const slot = Joi.string().valid('morning', 'afternoon', 'evening');
const schedule = { date: date.required(), time_slot: slot.required() };
const notice = '기존 학생 ID와 상담 연결을 유지합니다. 체험 상태·잔여 횟수·미체크 출결 배정을 함께 변경하며 출결 완료 기록과 수납·청구는 보존합니다. 원장 확인 후 반영합니다.';
const commands = {
  trial_register: { resource: 'students', provider: 'paca', label: '미등록 학생 새 체험 등록', notice,
    schema: Joi.object({ trial_dates: Joi.array().items(Joi.object(schedule).unknown(false)).min(1).max(50).required() }).unknown(false) },
  trial_schedule_add: { resource: 'students', provider: 'paca', label: '체험 일정 추가', notice,
    schema: Joi.object(schedule).unknown(false) },
  trial_schedule_update: { resource: 'students', provider: 'paca', label: '체험 일정 날짜·시간대 수정', notice,
    schema: Joi.object({ previous_date: date.required(), previous_time_slot: slot.required(), ...schedule }).unknown(false) },
};
module.exports = { commands };
