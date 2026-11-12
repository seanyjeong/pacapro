const { Joi, text, date, id } = require('./maxEngineInput');
const money = Joi.string().pattern(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/);
const slot = Joi.string().valid('morning', 'afternoon', 'evening');
const slots = Joi.array().items(slot).min(1).max(3).unique();
const seasonType = Joi.string().valid('early', 'regular');
const commands = {
  season_create: { resource: 'seasons', provider: 'paca', label: '시즌 만들기',
    schema: Joi.object({ season_name: Joi.string().min(1).max(100).required(), season_type: seasonType.required(),
      non_season_end_date: date.required(), season_start_date: date.required(), season_end_date: date.required(),
      operating_days: Joi.array().items(Joi.number().integer().min(0).max(6)).min(1).max(7).unique().required(),
      free_lesson_end_date: date.required(), post_free_action: Joi.string().valid('graduate', 'regular').required(),
      default_season_fee: money.required(), payment_due_date: date.allow(null),
      season_monthly_policy: Joi.string().valid('season_replaces_monthly', 'season_plus_monthly'),
      grade_time_slots: Joi.object().pattern(Joi.string().max(20), Joi.alternatives(slot, slots)).max(30).allow(null),
      allows_continuous: Joi.boolean(), continuous_to_season_type: seasonType.allow(null),
      continuous_discount_type: Joi.string().valid('none', 'rate', 'free'),
      continuous_discount_rate: Joi.number().min(0).max(100) }).unknown(false),
    notice: '파카 시즌 화면의 새 시즌과 같은 행을 시작 전(upcoming) 상태로 만듭니다. operating_days는 0=일~6=토, season_monthly_policy 기본은 시즌비가 월회비를 대신(season_replaces_monthly). 시즌 시작(활성화)·수정·삭제는 파카 시즌 화면에서 합니다.' },
  season_enroll: { resource: 'students', provider: 'paca', label: '학생 시즌 등록',
    schema: Joi.object({ season_id: id.required(), registration_date: date, season_fee: money, is_continuous: Joi.boolean(),
      discount_amount: money, discount_reason: text(255), time_slots: slots }).unknown(false),
    notice: '파카 화면 시즌 등록과 같은 계산으로 시즌비 청구를 만듭니다(이 학생 시즌비 → 시즌 도중 합류 일할 → 연속 등록 할인 → 직접 할인, 납부 마감일). season_fee는 일할·할인 전 이 학생 시즌비이고 생략하면 시즌 기본 시즌비입니다. 시즌비가 월회비를 대신하는 시즌이면 시즌 기간의 미납 월회비를 지웁니다. 비시즌 종강 다음 날부터 시즌 끝까지 미체크 정규 출결을 지우고(시작 전 시즌도, 종강~시즌 시작 사이는 수업 없음) 진행 중 시즌이면 시즌 수업에 배정하며, 휴원생은 복귀 때 합니다. registration_date 생략 시 한국 날짜 오늘.' },
  season_enrollment_update: { resource: 'student_seasons', provider: 'paca', label: '학생 시즌 등록 정보 수정',
    schema: Joi.object({ registration_date: date, season_fee: money, discount_amount: money, discount_reason: text(255).allow(''),
      time_slots: slots }).min(1).unknown(false),
    notice: '파카 화면 시즌 등록 수정과 같이 등록일·이 학생 시즌비(일할·할인 전)·직접 할인이 바뀌면 등록 때와 같은 계산(시즌 도중 합류 일할 → 연속 등록 할인 → 직접 할인)으로 다시 계산하고, 낸 돈이 없는 시즌비 청구도 같은 금액으로 고칩니다. 낸 돈이 있는 청구는 금액이 달라지면 확인되지 않으니 청구 금액 수정(payment_update)으로 고칩니다. 넘기지 않은 값은 그대로 둡니다.' },
  season_enrollment_cancel: { resource: 'student_seasons', provider: 'paca', label: '학생 시즌 등록 취소',
    schema: Joi.object({ cancellation_date: date, include_vat: Joi.boolean(), refund_amount: money }).unknown(false),
    notice: '파카 화면 시즌 취소와 같이 등록을 지우고 그 시즌의 완납 아닌 시즌비 청구를 지웁니다(일부 납부 청구 포함). 이미 배정된 시즌 출결은 남습니다. 낸 금액이 있으면 미리보기의 계산 환불액을 원장에게 보여 주고 원장이 정한 refund_amount(환불 없음은 "0")로 새 미리보기를 만들어야 확인됩니다. 환불액은 지출 장부에 환불로 기록하며 실제 송금은 하지 않습니다. cancellation_date 생략 시 한국 날짜 오늘.' },
};
module.exports = { commands };
