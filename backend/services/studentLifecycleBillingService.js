const repository = require('../repositories/studentLifecycleBillingRepository');
const { validateContext, withdrawalAdjustment, pauseAdjustment } = require('../models/studentLifecycleBilling');
const { cents, money } = require('../models/maxEngineSettlement');

async function withdraw(conn, input) {
  const context = validateContext(input);
  const payments = await repository.withdrawalPayments(conn, context);
  const changes = payments.map(row => withdrawalAdjustment(row, context.reason)).filter(Boolean);
  for (const change of changes) await repository.persist(conn, context, change);
  const cancelledSeasons = await repository.endSeasons(conn, context);
  const cancelledPayments = changes.filter(change => change.action === 'cancel').length;
  const adjustedPayments = changes.length - cancelledPayments;
  const waived = changes.reduce((sum, change) => sum + BigInt(cents(change.waivedAmount)), 0n);
  return { cancelledPayments, adjustedPayments, waivedAmount: Number(waived) / 100,
    paymentIds: changes.map(change => change.paymentId), cancelledSeasons,
    message: `미납 청구 ${cancelledPayments}건 취소·부분납 ${adjustedPayments}건 잔액 정산 (납부 이력 보존)`,
    seasonMessage: `시즌 등록 ${cancelledSeasons.length}건 종료` };
}

async function pause(conn, input) {
  const context = validateContext(input);
  const payments = await repository.pausePayments(conn, context);
  const changes = payments.map(row => pauseAdjustment(row, context.date)).filter(Boolean);
  for (const change of changes) await repository.persist(conn, context, change);
  const after = new Map(changes.map(change => [change.paymentId, change]));
  const beforeTotal = payments.reduce((sum, row) => sum + BigInt(cents(row.final_amount)), 0n);
  const afterTotal = payments.reduce((sum, row) => sum + BigInt(cents(after.get(row.id)?.afterFinal ?? row.final_amount)), 0n);
  const action = !changes.length ? 'unchanged' : changes.every(change => change.action === 'cancel') ? 'cancelled' : 'adjusted';
  return { action, originalAmount: Number(beforeTotal) / 100, adjustedAmount: Number(afterTotal) / 100,
    paymentIds: changes.map(change => change.paymentId),
    message: changes.length ? `${context.date.slice(0, 7)} 휴원 학원비 ${changes.length}건 정산 (${money(Number(beforeTotal))}원 → ${money(Number(afterTotal))}원, 납부 이력 보존)`
      : `${context.date.slice(0, 7)} 변경할 미납 월 학원비가 없습니다.` };
}

module.exports = { withdraw, pause, validateContext };
