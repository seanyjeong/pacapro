const commands = require('./maxEngineFullCommandRepository');
const { SEASON_PAYMENT_SUMMARY_JOIN, applySeasonPaymentSummary } = require('../services/seasonPaymentSummary');
const { DEFAULT_SEASON_MONTHLY_POLICY } = require('../utils/seasonMonthlyPolicy');
const { fail } = require('../models/maxEngineError');
async function rows(conn, sql, params, lock) {
  const [result] = await conn.execute(sql + (lock ? ' FOR UPDATE' : ''), params);
  return result;
}
// 시즌 등록 화면(POST /paca/seasons/:id/enroll)이 읽는 것 + 확인 때 지워질 월회비·정규 출결
async function enrollState(conn, actor, studentId, seasonId, lock) {
  const student = await commands.row(conn, 'students', studentId, actor.academy_id, lock);
  const [season] = await rows(conn, 'SELECT * FROM seasons WHERE id = ? AND academy_id = ?', [seasonId, actor.academy_id], lock);
  if (!season) fail(404, 'NOT_FOUND', '내 교육원에서 시즌을 찾을 수 없습니다.');
  const startMonth = String(season.season_start_date).slice(0, 7), endMonth = String(season.season_end_date).slice(0, 7);
  return { student, season,
    enrollments: await rows(conn, `SELECT ss.id, ss.season_id, ss.payment_status, se.season_start_date FROM student_seasons ss
      JOIN seasons se ON se.id = ss.season_id WHERE ss.student_id = ? AND se.academy_id = ? ORDER BY ss.id`, [student.id, actor.academy_id], lock),
    seasonPayments: await rows(conn, `SELECT id, \`year_month\`, final_amount, paid_amount, payment_status FROM student_payments
      WHERE student_id = ? AND academy_id = ? AND payment_type = 'season' ORDER BY id`, [student.id, actor.academy_id], lock),
    monthlyToDelete: (season.season_monthly_policy || DEFAULT_SEASON_MONTHLY_POLICY) !== DEFAULT_SEASON_MONTHLY_POLICY ? []
      : await rows(conn, `SELECT id, \`year_month\`, final_amount, payment_status FROM student_payments
      WHERE student_id = ? AND academy_id = ? AND payment_type = 'monthly' AND \`year_month\` BETWEEN ? AND ?
      AND payment_status IN ('pending', 'overdue', 'unpaid') AND COALESCE(paid_amount, 0) = 0 ORDER BY id`,
      [student.id, actor.academy_id, startMonth, endMonth], lock),
    regularToRemove: await rows(conn, `SELECT a.id, cs.class_date, cs.time_slot FROM attendance a
      JOIN class_schedules cs ON cs.id = a.class_schedule_id WHERE a.student_id = ? AND cs.academy_id = ?
      AND cs.class_date >= ? AND cs.class_date <= ? AND a.attendance_status IS NULL ORDER BY a.id`,
      [student.id, actor.academy_id, season.season_start_date, season.season_end_date], lock) };
}
// 시즌 취소 화면(POST /paca/seasons/enrollments/:id/cancel)과 같은 조회 + 확인 때 지워질 시즌비 청구
async function enrollmentState(conn, actor, enrollmentId, lock) {
  const [enrollment] = await rows(conn, `SELECT ss.*, s.academy_id, s.name AS student_name, s.class_days,
      se.season_name, se.season_start_date, se.season_end_date, se.operating_days,
      sp.payment_paid_amount, sp.payment_final_amount, sp.payment_record_status
    FROM student_seasons ss JOIN students s ON ss.student_id = s.id JOIN seasons se ON ss.season_id = se.id
    ${SEASON_PAYMENT_SUMMARY_JOIN}
    WHERE ss.id = ? AND s.academy_id = ? AND se.academy_id = s.academy_id AND s.deleted_at IS NULL`, [enrollmentId, actor.academy_id], false);
  if (!enrollment) fail(404, 'NOT_FOUND', '내 교육원에서 시즌 등록을 찾을 수 없습니다.');
  if (lock) await rows(conn, 'SELECT id FROM student_seasons WHERE id = ?', [enrollmentId], true);
  applySeasonPaymentSummary(enrollment);
  return { enrollment,
    seasonPayments: await rows(conn, `SELECT id, \`year_month\`, final_amount, paid_amount, payment_status, description FROM student_payments
      WHERE student_id = ? AND academy_id = ? AND payment_type = 'season' AND description LIKE ? ORDER BY id`,
      [enrollment.student_id, actor.academy_id, `%${enrollment.season_name}%`], lock) };
}
module.exports = { enrollState, enrollmentState };
