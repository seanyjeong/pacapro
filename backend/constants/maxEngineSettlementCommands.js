const { Joi, date, id } = require('./maxEngineInput');
const amount = Joi.string().pattern(/^(0|[1-9]\d{0,7})(\.\d{1,2})?$/);
const settlement = Joi.object({
  payment_id: id.required(), action: Joi.string().valid('cancel', 'adjust', 'refund').required(),
  final_amount: amount.when('action', { is: 'cancel', then: Joi.forbidden(), otherwise: Joi.required() }),
  reason: Joi.string().trim().min(1).max(255).required(),
  refund_amount: amount.when('action', { is: 'refund', then: Joi.required(), otherwise: Joi.forbidden() }),
  refund_completed: Joi.boolean().valid(true).when('action', { is: 'refund', then: Joi.required(), otherwise: Joi.forbidden() }),
  refund_method: Joi.string().valid('account', 'card', 'cash', 'other')
    .when('action', { is: 'refund', then: Joi.required(), otherwise: Joi.forbidden() }),
}).unknown(false);
const settlements = Joi.array().items(settlement).min(1).max(100).unique('payment_id');
const notice = '청구를 삭제하지 않고 선택한 청구만 취소·감액·환불 정산합니다. 납부·정산 이력을 보존합니다. 환불은 실제 카드 취소·송금 완료를 확인한 뒤 지출 장부에 기록하며 이 도구가 송금하거나 카드 취소하지 않습니다. 금액은 원장이 확인한 금액이며 자동 법정 환불 계산이 아닙니다.';
const commands = {
  student_settle: { resource: 'students', provider: 'paca', label: '퇴원·졸업 학생 남은 학원비 정산',
    schema: Joi.object({ settlement_date: date.required(), settlements: settlements.required() }).unknown(false), notice },
};
module.exports = { commands, settlements, notice };
