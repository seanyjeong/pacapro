const Joi = require('joi');
const { TIME_SLOTS, DEFAULT_COLORS } = require('./academyEvents');
const date = Joi.string().pattern(/^\d{4}-\d{2}-\d{2}$/).custom((value, helper) =>
  !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value && value >= '1000-01-01'
    ? value : helper.error('any.invalid'));
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const text = max => Joi.string().max(max).allow('', null);
const schema = fields => Joi.object(fields).min(1).unknown(false);
const commands = {
  class_schedule_update: { resource: 'class_schedules', provider: 'paca', label: '수업 일정 한 건 수정',
    schema: schema({ class_date: date, time_slot: Joi.string().valid(...TIME_SLOTS),
      instructor_id: Joi.number().integer().positive().allow(null), title: text(200), content: text(10000), notes: text(4000) }),
    notice: '선택한 수업만 수정합니다. 출결·체험 예약·휴강과 연결된 수업의 날짜/시간 이동은 먼저 연결 기록을 정리해야 합니다. 문자 발송은 하지 않습니다.' },
  instructor_schedule_update: { resource: 'instructor_schedules', provider: 'paca', label: '강사 근무 일정 한 건 수정',
    schema: schema({ work_date: date, time_slot: Joi.string().valid(...TIME_SLOTS),
      scheduled_start_time: time.allow(null), scheduled_end_time: time.allow(null) }),
    notice: '선택한 근무 예정만 수정합니다. 실제 출퇴근·급여 기록과 다른 근무 일정은 변경하지 않습니다.' },
  academy_event_update: { resource: 'academy_events', provider: 'paca', label: '학원 행사·휴일 한 건 수정',
    schema: schema({ title: Joi.string().max(190).pattern(/\S/), description: text(10000),
      event_type: Joi.string().valid(...Object.keys(DEFAULT_COLORS)), event_date: date,
      start_time: time.allow(null), end_time: time.allow(null), is_all_day: Joi.boolean(),
      is_holiday: Joi.boolean(), block_consultation: Joi.boolean(), color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/) }),
    notice: '행사에 연결된 휴강·상담 차단도 같은 트랜잭션에서 갱신합니다. related에 표시된 변경을 함께 확인해 주세요. 상담 예약 자체는 이동하지 않으며 문자 발송은 하지 않습니다.' },
  academy_event_create: { resource: 'academy_events', provider: 'paca', label: '학원 일정·휴일 새로 등록',
    schema: Joi.object({ title: Joi.string().max(190).pattern(/\S/).required(), description: text(10000),
      event_type: Joi.string().valid(...Object.keys(DEFAULT_COLORS)), event_date: date.required(),
      start_time: time.allow(null), end_time: time.allow(null), is_all_day: Joi.boolean(),
      is_holiday: Joi.boolean(), block_consultation: Joi.boolean(), color: Joi.string().pattern(/^#[0-9a-fA-F]{6}$/) }).unknown(false),
    notice: '일정 화면의 등록과 같습니다. 휴일이면 그날 수업을 휴강 처리하고, 상담 차단을 켜면 포함된 오전·오후·저녁 상담을 막습니다(related 확인). 상담 예약 자체는 이동하지 않으며 문자 발송은 하지 않습니다.' },
  consultation_reschedule: { resource: 'consultations', provider: 'paca', label: '상담 예약 날짜·시간 수정',
    schema: schema({ preferred_date: date, preferred_time: time }),
    notice: '대기·확정 상담 예약의 날짜/시간만 수정합니다. 상담 기록의 작성일·상태·메모·알림 발송 상태는 보존하며 문자 발송은 하지 않습니다.' },
  consultation_block_create: { resource: 'consultation_blocked_slots', provider: 'paca', label: '상담 예약 시간 차단',
    schema: Joi.object({ blocked_date: date.required(), is_all_day: Joi.boolean(), start_time: time, end_time: time,
      reason: Joi.string().max(200).pattern(/\S/).required() }).unknown(false),
    notice: '공개 상담 예약에서 해당 날짜·시간을 새로 예약할 수 없게 합니다. 이미 잡힌 예약은 이동·취소하지 않으며(related에 표시) 문자 발송은 하지 않습니다.' },
  consultation_block_delete: { resource: 'consultation_blocked_slots', provider: 'paca', label: '상담 예약 차단 해제',
    schema: Joi.object({}).unknown(false),
    notice: '직접 등록한 상담 차단 한 건만 해제합니다. 학원 행사에 연결된 차단은 해당 행사의 상담 차단(academy_event_update block_consultation)을 꺼 주세요. 문자 발송은 하지 않습니다.' },
};
module.exports = { commands };
