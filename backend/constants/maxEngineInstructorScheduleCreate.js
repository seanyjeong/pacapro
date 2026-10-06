const { Joi, date, id } = require('./maxEngineInput');
const time = Joi.string().pattern(/^([01]\d|2[0-3]):[0-5]\d$/);
const commands = {
  instructor_schedule_create: { provider: 'paca', resource: 'instructor_schedules', label: '강사 근무 일정 등록',
    schema: Joi.object({ instructor_id: id.required(), work_date: date.required(),
      time_slot: Joi.string().valid('morning','afternoon','evening').required(),
      scheduled_start_time: time.required(), scheduled_end_time: time.required() }).unknown(false),
    notice: '해당 날짜·시간대 근무 등록이 없는 재직 강사의 일정을 새로 만듭니다. 시각을 추측하지 말고 teaching_context의 교육원 시간과 원장 요청을 확인하세요. 실제 출퇴근·급여 기록은 만들지 않습니다. 적용 후 teaching_context를 다시 조회하고 PEAK 반 배정·계획을 별도로 미리봅니다.' },
};
module.exports = { commands };
