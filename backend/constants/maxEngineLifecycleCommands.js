const { Joi, text, date } = require('./maxEngineInput');
const { settlements, notice } = require('./maxEngineSettlementCommands');
const commands = {
  student_withdraw: { resource: 'students', provider: 'paca', label: '학생 퇴원 처리',
    schema: Joi.object({ withdrawal_date: date.required(), reason: text(255),
      billing_decision: Joi.string().valid('preserve', 'settle'),
      settlements: settlements.when('billing_decision', { is: 'preserve', then: Joi.forbidden() }),
      settlement_date: date }).custom((value, helpers) =>
      value.billing_decision === 'settle' && !value.settlements ? helpers.error('any.invalid') : value).unknown(false),
    notice: '즉시 퇴원하고 오늘 출결·미래 미체크 예약을 정리합니다. 미납·납부 청구가 있으면 정산 또는 명시적 청구 유지 결정을 확인해야 합니다. ' + notice },
  student_reactivate: { resource: 'students', provider: 'paca', label: '퇴원·졸업 학생 재원 복귀',
    schema: Joi.object({}).unknown(false),
    notice: '퇴원·졸업 학생만 재원으로 복귀합니다. 퇴원 이력·수강 설정을 보존합니다. 즉시 청구 생성이나 삭제된 출결 복원은 하지 않으며 이후 정기 청구는 기존 시즌·수강 설정을 따릅니다. 휴원생은 휴원 정산을 거치는 화면 복귀를 사용하세요.' },
};
module.exports = { commands };
