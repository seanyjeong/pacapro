const commands = require('./maxEngineFullCommandRepository');
const { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams } = require('./seasonMonthlyExclusion');
async function rows(conn, sql, params, lock) {
  const [result] = await conn.execute(sql + (lock ? ' FOR UPDATE' : ''), params);
  return result;
}
// 매월 1일 자동 청구(scheduler/paymentScheduler.js)가 학생 한 명에게 읽는 것 — 확인 때는 학생 → 청구 → 크레딧 순서로 잠근다
// (다른 청구 경로와 같은 순서, repositories/studentBillingLock)
async function monthlyState(conn, actor, studentId, yearMonth, lock) {
  const [student] = await rows(conn, `SELECT id, name, status, monthly_tuition, discount_rate, class_days, payment_due_day,
    DATE_FORMAT(enrollment_date, '%Y-%m') AS enrollment_month FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
  [studentId, actor.academy_id], lock);
  if (!student) return { student: null };
  const [academy] = await rows(conn, `SELECT COALESCE(ast.tuition_due_day, 5) AS default_due_day FROM academies a
    LEFT JOIN academy_settings ast ON a.id = ast.academy_id WHERE a.id = ? ORDER BY ast.id LIMIT 1`, [actor.academy_id]);
  const [eligibility] = await rows(conn, `SELECT ${seasonMonthlyExclusionSql('s')} AS allowed FROM students s WHERE s.id = ? AND s.academy_id = ?`,
    [...seasonMonthlyExclusionParams(yearMonth), studentId, actor.academy_id]);
  const existing = await rows(conn, `SELECT id, payment_status FROM student_payments WHERE student_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
    [studentId, yearMonth], lock);
  const [credit] = await rows(conn, `SELECT id, remaining_amount, credit_type, status FROM rest_credits WHERE student_id = ? AND academy_id = ?
    AND credit_type IN ('carryover', 'excused', 'manual') AND status IN ('pending', 'partial') AND remaining_amount > 0
    ORDER BY created_at ASC, id ASC`, [studentId, actor.academy_id], lock);
  return { student: { ...student, due_day: student.payment_due_day || academy?.default_due_day || 5 }, allowed: Boolean(eligibility?.allowed),
    existing, credit: credit || null };
}
async function create(conn, actor, studentId, plan) {
  const id = await commands.insert(conn, 'student_payments', { student_id: studentId, academy_id: actor.academy_id, year_month: plan.yearMonth,
    payment_type: 'monthly', base_amount: plan.baseAmount, discount_amount: plan.discountAmount, additional_amount: 0,
    carryover_amount: plan.carryoverAmount, rest_credit_id: plan.restCreditId, final_amount: plan.finalAmount, due_date: plan.dueDate,
    payment_status: 'pending', description: plan.description, notes: plan.notes, recorded_by: actor.user_id });
  if (plan.creditAfter) {
    await conn.execute(`UPDATE rest_credits SET remaining_amount = ?, status = ?, applied_to_payment_id = NULL, processed_at = NOW() WHERE id = ?`,
      [plan.creditAfter.remaining_amount, plan.creditAfter.status, plan.creditAfter.id]);
  }
  return id;
}
module.exports = { monthlyState, create };
