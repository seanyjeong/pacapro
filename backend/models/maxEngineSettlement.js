const { fail } = require('./maxEngineError');
function cents(value) {
  const text = String(value ?? '0');
  if (!/^\d+(\.\d{1,2})?$/.test(text)) fail(409, 'SETTLEMENT_AMOUNT', '원본 청구·납부 금액이 음수이거나 형식이 잘못되었습니다.');
  const [whole, decimal = ''] = text.split('.');
  const result = Number(whole) * 100 + Number(decimal.padEnd(2, '0'));
  if (!Number.isSafeInteger(result)) fail(409, 'SETTLEMENT_AMOUNT', '금액이 정산 처리 범위를 넘습니다.');
  return result;
}
const money = value => (value / 100).toFixed(2);
function summary(invoice) {
  const billed = cents(invoice.final_amount), paid = cents(invoice.paid_amount);
  return { payment_id: invoice.id, year_month: invoice.year_month, payment_type: invoice.payment_type,
    payment_status: invoice.payment_status, final_amount: money(billed), paid_amount: money(paid),
    outstanding: invoice.payment_status === 'cancelled' ? '0.00' : money(Math.max(0, billed - paid)),
    refundable_paid: money(paid), season_id: invoice.season_id,
    gateway_refund_requires_original_screen: Boolean(invoice.has_gateway_payment) };
}
function plan(change, invoice) {
  if (invoice.payment_status === 'cancelled') fail(409, 'SETTLEMENT_CLOSED', '이미 취소한 청구입니다.');
  if (change.action === 'refund' && invoice.has_gateway_payment) {
    fail(422, 'SETTLEMENT_UNSUPPORTED', '토스 연결 청구는 카드 취소가 납부액을 자동 갱신하므로 MCP에서 환불을 재기록할 수 없습니다. 원본 카드 취소 화면에서 처리한 뒤 남은 청구액만 조정해 주세요.');
  }
  if (!['monthly', 'season'].includes(invoice.payment_type) || invoice.rest_credit_id || invoice.prepaid_group_id) {
    fail(422, 'SETTLEMENT_UNSUPPORTED', '일반 월·시즌 학원비만 정산합니다. 상품·기타 청구 또는 휴원 크레딧·선납 묶음은 원본 정산 화면에서 확인해 주세요.');
  }
  const original = cents(invoice.final_amount), paid = cents(invoice.paid_amount);
  const final = change.action === 'cancel' ? 0 : cents(change.final_amount);
  const refund = change.action === 'refund' ? cents(change.refund_amount) : 0;
  if (change.action === 'cancel' && paid > 0) fail(422, 'SETTLEMENT_PAID', '납부한 청구는 삭제·단순 취소할 수 없습니다. 금액 조정 또는 실제 환불 완료 정산을 선택해 주세요.');
  if (final > original || refund > paid || (change.action === 'refund' && refund === 0) || final < paid - refund) {
    fail(422, 'SETTLEMENT_AMOUNT', '조정 청구액은 기존 청구액 이하, 환불액은 현재 납부액 이하여야 합니다. 조정 청구액이 환불 후 납부액보다 작으면 환불액을 함께 확인해 주세요.');
  }
  const netPaid = paid - refund;
  const status = final === 0 && netPaid === 0 ? 'cancelled' : netPaid >= final ? 'paid'
    : netPaid > 0 ? 'partial' : invoice.payment_status === 'overdue' ? 'overdue' : 'pending';
  return { payment_id: invoice.id, action: change.action, reason: change.reason,
    before: summary(invoice), after: { final_amount: money(final), paid_amount: money(netPaid),
      payment_status: status, outstanding: money(Math.max(0, final - netPaid)) },
    waived_amount: money(original - final), refund_amount: money(refund),
    refund_method: change.refund_method || null, external_refund_executed_by_tool: false };
}
module.exports = { cents, money, summary, plan };
