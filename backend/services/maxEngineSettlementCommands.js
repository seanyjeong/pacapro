const repo = require('../repositories/maxEngineFullCommandRepository');
const settlementRepo = require('../repositories/maxEngineSettlementRepository');
const { summary, plan, cents } = require('../models/maxEngineSettlement');
const { fail, decrypt } = require('./maxEngineFullSecurity');
const { notice } = require('../constants/maxEngineSettlementCommands');
const supports = operation => operation === 'student_settle';
async function billingState(conn, actor, studentId, lock) {
  return { invoices: await settlementRepo.invoices(conn, actor, studentId, lock),
    seasons: await settlementRepo.seasons(conn, actor, studentId, lock) };
}
async function state(conn, actor, command, lock) {
  const student = await repo.row(conn, 'students', command.resource_id, actor.academy_id, lock);
  return { student, ...await billingState(conn, actor, student.id, lock) };
}
function enrollment(invoice, before) {
  if (invoice.payment_type !== 'season') return null;
  const matches = before.seasons.filter(s => s.season_id === invoice.season_id && !s.is_cancelled);
  const bills = before.invoices.filter(p => p.payment_type === 'season' && p.season_id === invoice.season_id && p.payment_status !== 'cancelled');
  if (!invoice.season_id || matches.length !== 1 || bills.length !== 1) {
    fail(422, 'SETTLEMENT_UNSUPPORTED', '시즌 청구와 등록이 한 건씩 연결되어 있지 않습니다. 시즌 정산 화면에서 연결을 확인해 주세요.');
  }
  return matches[0];
}
function plans(command, before) {
  return (command.changes.settlements || []).map(change => {
    const invoice = before.invoices.find(p => p.id === change.payment_id);
    if (!invoice) fail(404, 'SETTLEMENT_NOT_FOUND', '이 학생·교육원에서 선택한 청구를 찾을 수 없습니다.');
    enrollment(invoice, before);
    return plan(change, invoice);
  });
}
function view(command, before) {
  const date = command.changes.settlement_date || command.changes.withdrawal_date;
  const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
  if (date > today) fail(422, 'STUDENT_DATE_RANGE', '미래 날짜로 정산 기록을 만들 수 없습니다.');
  const changes = plans(command, before), all = before.invoices.map(summary);
  const decision = command.changes.billing_decision || (changes.length ? 'settle' : null);
  const needsDecision = all.some(p => p.payment_status !== 'cancelled' && (p.final_amount !== '0.00' || p.paid_amount !== '0.00'));
  const total = all.reduce((sum, p) => sum + BigInt(cents(changes.find(c => c.payment_id === p.payment_id)?.after.outstanding ?? p.outstanding)), 0n);
  return { invoices: all, payment_changes: changes, billing_decision: decision,
    settlement_required: command.operation === 'student_withdraw' && needsDecision && !decision,
    unchanged_payment_ids: all.filter(p => !changes.some(c => c.payment_id === p.payment_id)).map(p => p.payment_id),
    total_outstanding_after: `${total / 100n}.${String(total % 100n).padStart(2, '0')}`,
    notice };
}
function display(command, before) {
  if (!['withdrawn', 'graduated'].includes(before.student.status)) fail(409, 'STUDENT_STATUS_CONFLICT', '별도 정산은 퇴원·졸업 학생만 가능합니다. 재원생은 퇴원 미리보기에서 정산을 함께 선택해 주세요.');
  return { before: { id: before.student.id, name: decrypt(before.student.name), status: before.student.status },
    after: { related: view(command, before) }, notice };
}
async function apply(conn, actor, command, before) {
  const date = command.changes.settlement_date || command.changes.withdrawal_date;
  const billing = view(command, before);
  if (billing.settlement_required) fail(422, 'SETTLEMENT_REQUIRED', '남은 청구의 취소·조정·환불 또는 청구 유지 여부를 원장에게 확인하고 새 미리보기를 만들어 주세요.');
  for (const item of billing.payment_changes) {
    const invoice = before.invoices.find(p => p.id === item.payment_id);
    await settlementRepo.persist(conn, actor, before.student.id, date, invoice, item, enrollment(invoice, before));
  }
  return command.resource_id;
}
module.exports = { supports, billingState, state, display, view, apply };
