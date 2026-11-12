const repo = require('../repositories/maxEngineFullCommandRepository');
const { fail } = require('./maxEngineFullSecurity');

function cents(value) {
  const text = String(value ?? '0');
  if (!/^-?\d+(\.\d{1,2})?$/.test(text)) fail(409, 'INVALID_AMOUNT', '원본 금액 형식을 먼저 확인해 주세요.');
  const [whole, decimal = ''] = text.replace(/^-/, '').split('.');
  return (text.startsWith('-') ? -1 : 1) * (Number(whole) * 100 + Number(decimal.padEnd(2, '0')));
}
const money = value => (value / 100).toFixed(2);
function result(changes, before) {
  if (['paid', 'cancelled'].includes(before.payment_status)) fail(409, 'PAYMENT_CLOSED', '완납 또는 취소된 청구입니다.');
  const amount = cents(changes.paid_amount), total = cents(before.final_amount), paid = cents(before.paid_amount) + amount;
  if (!amount && total > 0) fail(422, 'INVALID_AMOUNT', '납부 금액은 0보다 커야 합니다.');
  if (!Number.isSafeInteger(paid) || paid >= 1e12) fail(422, 'INVALID_AMOUNT', '납부 금액 범위를 확인해 주세요.');
  return { paid_amount: money(paid), payment_status: paid >= total ? 'paid' : 'partial',
    payment_method: changes.payment_method, paid_date: changes.payment_date,
    notes: [before.notes, changes.notes || `납부: ${changes.paid_amount}원`].filter(Boolean).join('\n') };
}
const AMOUNT_FIELDS = ['base_amount', 'discount_amount', 'additional_amount', 'carryover_amount', 'final_amount', 'paid_amount', 'payment_status'];
function updated(changes, before) {
  if (['paid', 'cancelled'].includes(before.payment_status)) fail(409, 'PAYMENT_CLOSED', '완납 또는 취소된 청구는 청구액을 바꿀 수 없습니다.');
  if (['withdrawn', 'graduated'].includes(before.student_status)) fail(409, 'STUDENT_STATUS_CONFLICT', '퇴원·졸업 학생의 청구는 학생 정산 미리보기(preview_student_settlement)에서 조정해 주세요.');
  const base = cents(changes.base_amount ?? before.base_amount), discount = cents(changes.discount_amount ?? before.discount_amount),
    additional = cents(changes.additional_amount ?? before.additional_amount), paid = cents(before.paid_amount);
  // 화면의 청구서 수정(PUT /paca/payments/:id)과 같은 계산: 천원 단위 버림 → 이월액 차감 → 0 미만은 0
  const total = Math.max(Math.floor((base - discount + additional) / 100000) * 100000 - cents(before.carryover_amount), 0);
  if (total >= 1e10) fail(422, 'INVALID_AMOUNT', '청구 금액 범위를 확인해 주세요.');
  if (total < paid) fail(422, 'PAYMENT_BELOW_PAID', `이미 낸 금액(${money(paid)})보다 낮출 수 없습니다. 환불은 퇴원 정산에서 처리합니다.`);
  return { base_amount: money(base), discount_amount: money(discount), additional_amount: money(additional), final_amount: money(total),
    payment_status: total === paid ? 'paid' : paid > 0 ? 'partial' : before.payment_status,
    notes: [before.notes, `청구액 수정: ${money(cents(before.final_amount))} → ${money(total)} (${changes.notes})`].filter(Boolean).join('\n') };
}
function updateView(changes, before) {
  return { before: Object.fromEntries(AMOUNT_FIELDS.map(k => [k, before[k] ?? null])), after: updated(changes, before) };
}
async function update(conn, id, changes, before) {
  await repo.update(conn, 'student_payments', id, updated(changes, before));
  return id;
}
async function apply(conn, actor, id, changes, before) {
  const values = result(changes, before);
  await repo.update(conn, 'student_payments', id, values);
  await repo.insert(conn, 'revenues', { academy_id: actor.academy_id,
    category: before.payment_type === 'season' ? 'season' : 'tuition', amount: changes.paid_amount,
    revenue_date: changes.payment_date, payment_id: id, student_id: before.student_id,
    description: '연동 API 납부', recorded_by: actor.user_id });
  return id;
}
module.exports = { result, apply, updated, updateView, update };
