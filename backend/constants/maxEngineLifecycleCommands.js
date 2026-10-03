const { Joi, text, date } = require('./maxEngineInput');
const commands = {
  student_withdraw: { resource: 'students', provider: 'paca', label: '학생 퇴원 처리',
    schema: Joi.object({ withdrawal_date: date.required(), reason: text(255) }).unknown(false),
    notice: '즉시 퇴원 처리합니다. 기존 청구·납부·시즌 이력은 보존합니다. 오늘 출결과 미래 미체크 예약을 정리하며 문자 발송은 하지 않습니다.' },
  student_reactivate: { resource: 'students', provider: 'paca', label: '퇴원·졸업 학생 재원 복귀',
    schema: Joi.object({}).unknown(false),
    notice: '퇴원·졸업 학생만 재원으로 복귀합니다. 퇴원 이력·수강 설정을 보존합니다. 즉시 청구 생성이나 삭제된 출결 복원은 하지 않으며 이후 정기 청구는 기존 시즌·수강 설정을 따릅니다. 휴원생은 휴원 정산을 거치는 화면 복귀를 사용하세요.' },
};
module.exports = { commands };
