// One-off operator normalization: same verified amount, explicit source hash, no refund or date changes.
const assert = require('node:assert/strict');
const { fingerprint } = require('../../../backend/models/studentLifecycleBillingQuote');
const { pauseAdjustment } = require('../../../backend/models/studentLifecycleBilling');
const repository = require('../../../backend/repositories/studentLifecycleBillingRepository');

async function normalize(conn, context, expectedHash) {
  const lock = expectedHash ? ' FOR UPDATE' : '';
  const [students] = await conn.execute(`SELECT * FROM students WHERE academy_id=? AND id=?${lock}`,
    [context.academyId, context.studentId]);
  const student = students[0];
  assert(student && student.status === 'paused' && !student.deleted_at);
  assert.equal(student.rest_start_date, context.date);
  assert.equal(Number(student.monthly_tuition), context.originalAmount);
  assert.equal(Number(student.discount_rate), 0);
  const [payments] = await conn.execute(`SELECT * FROM student_payments WHERE academy_id=? AND student_id=? AND id=?${lock}`,
    [context.academyId, context.studentId, context.paymentId]);
  const payment = payments[0];
  assert(payment && payment.payment_type === 'monthly' && payment.year_month === context.date.slice(0, 7));
  assert.equal(payment.payment_status, 'pending');
  assert.equal(Number(payment.paid_amount), 0);
  assert.equal(Number(payment.base_amount), context.originalAmount);
  assert.equal(Number(payment.discount_amount), 0);
  assert.equal(Number(payment.additional_amount), 0);
  assert.equal(Number(payment.final_amount), context.currentAmount);
  assert(!payment.is_prorated && !payment.proration_details && !payment.rest_credit_id && !payment.prepaid_group_id && !payment.notes);
  const [credits] = await conn.execute(`SELECT * FROM rest_credits WHERE academy_id=? AND student_id=?${lock}`,
    [context.academyId, context.studentId]);
  const [audits] = await conn.execute(`SELECT * FROM max_engine_payment_settlements WHERE academy_id=? AND student_id=?${lock}`,
    [context.academyId, context.studentId]);
  const [seasons] = await conn.execute(`SELECT * FROM student_seasons WHERE student_id=?${lock}`, [context.studentId]);
  assert.equal(credits.length + audits.length + seasons.length, 0);
  const change = pauseAdjustment({...payment, final_amount: context.originalAmount}, context.date, null);
  assert.equal(Number(change.afterFinal), context.currentAmount);
  change.beforeFinal = context.currentAmount;
  change.waivedAmount = 0;
  const hash = fingerprint({context, student, payment, credits, audits, seasons, change});
  if (expectedHash) {
    assert.equal(hash, expectedHash, 'Source changed since operator preview');
    await repository.persist(conn, context, change);
  }
  return {source_hash: hash, payment_id: payment.id, original_amount: context.originalAmount,
    before: context.currentAmount, after: Number(change.afterFinal), paid: 0, metadata_only: true,
    external_refunds: 0, source: 'Stored invoice base, zero adjustments, student tuition and exact calendar proration agree'};
}
module.exports = {normalize};
