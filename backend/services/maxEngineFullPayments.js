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
async function apply(conn, actor, id, changes, before) {
  const values = result(changes, before);
  await repo.update(conn, 'student_payments', id, values);
  await repo.insert(conn, 'revenues', { academy_id: actor.academy_id,
    category: before.payment_type === 'season' ? 'season' : 'tuition', amount: changes.paid_amount,
    revenue_date: changes.payment_date, payment_id: id, student_id: before.student_id,
    description: '연동 API 납부', recorded_by: actor.user_id });
  return id;
}
module.exports = { result, apply };
