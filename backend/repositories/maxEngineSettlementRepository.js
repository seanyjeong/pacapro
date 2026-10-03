const { scanLimit } = require('../constants/maxEngineReadOptions');
const { fail } = require('../models/maxEngineError');
const repo = require('./maxEngineFullCommandRepository');
async function invoices(conn, actor, studentId, lock) {
  const [rows] = await conn.execute(`SELECT p.*, EXISTS(SELECT 1 FROM toss_payment_history h
    WHERE h.payment_id = p.id AND h.academy_id = p.academy_id) AS has_gateway_payment
    FROM student_payments p WHERE p.academy_id = ? AND p.student_id = ?
    ORDER BY p.id LIMIT ${scanLimit + 1} ${lock ? 'FOR UPDATE' : ''}`,
  [actor.academy_id, studentId]);
  if (rows.length > scanLimit) fail(422, 'QUERY_TOO_BROAD', '학생 청구가 10,000건을 넘습니다. 원본 청구를 먼저 확인해 주세요.');
  return rows;
}
async function seasons(conn, actor, studentId, lock) {
  const [rows] = await conn.execute(`SELECT ss.* FROM student_seasons ss
    JOIN seasons s ON s.id = ss.season_id AND s.academy_id = ?
    WHERE ss.student_id = ? ORDER BY ss.id LIMIT ${scanLimit + 1} ${lock ? 'FOR UPDATE' : ''}`,
  [actor.academy_id, studentId]);
  if (rows.length > scanLimit) fail(422, 'QUERY_TOO_BROAD', '학생 시즌 등록이 10,000건을 넘습니다.');
  return rows;
}
async function persist(conn, actor, studentId, date, invoice, item, enrollment) {
  let expenseId = null;
  if (item.refund_amount !== '0.00') expenseId = await repo.insert(conn, 'expenses', {
    academy_id: actor.academy_id, category: 'refund', amount: item.refund_amount, expense_date: date,
    payment_method: item.refund_method, recorded_by: actor.user_id,
    description: `MCP 퇴원 정산 환불 (청구 #${invoice.id})`, notes: item.reason });
  await repo.update(conn, 'student_payments', invoice.id, {
    final_amount: item.after.final_amount, paid_amount: item.after.paid_amount, payment_status: item.after.payment_status,
    notes: [invoice.notes, `[MCP 퇴원 정산 ${date}] ${item.action}: ${item.reason}`].filter(Boolean).join('\n') });
  if (enrollment) await repo.update(conn, 'student_seasons', enrollment.id, {
    paid_amount: item.after.paid_amount, payment_status: item.after.payment_status,
    ...(item.after.payment_status === 'cancelled' ? { is_cancelled: 1, cancellation_date: date, after_season_action: 'terminate' } : {}),
    refund_amount: (Number(enrollment.refund_amount || 0) + Number(item.refund_amount)).toFixed(2) });
  await repo.insert(conn, 'max_engine_payment_settlements', {
    academy_id: actor.academy_id, student_id: studentId, payment_id: invoice.id, action: item.action,
    settlement_date: date, before_final_amount: item.before.final_amount, before_paid_amount: item.before.paid_amount,
    after_final_amount: item.after.final_amount, after_paid_amount: item.after.paid_amount,
    waived_amount: item.waived_amount, refund_amount: item.refund_amount, expense_id: expenseId,
    reason: item.reason, recorded_by: actor.user_id });
  return { ...item, expense_id: expenseId };
}
module.exports = { invoices, seasons, persist };
