const credits = require('./restCreditRepository');
const payments = require('./resumePaymentRepository');
const { seasonGapRanges } = require('./seasonGapSchedule');

async function state(connection, student, resumeDate, lock) {
  const suffix = lock ? ' FOR UPDATE' : '';
  const yearMonth = resumeDate.slice(0, 7);
  const [schedules] = await connection.execute(`SELECT id, class_date, time_slot FROM class_schedules
    WHERE academy_id = ? AND class_date >= ? AND DATE_FORMAT(class_date, '%Y-%m') = ?
    ORDER BY id${suffix}`, [student.academy_id, resumeDate, yearMonth]);
  const [attendance] = await connection.execute(`SELECT a.id, a.class_schedule_id, a.attendance_status
    FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
    WHERE a.student_id = ? AND cs.academy_id = ? AND cs.class_date >= ?
    AND DATE_FORMAT(cs.class_date, '%Y-%m') = ? ORDER BY a.id${suffix}`,
  [student.id, student.academy_id, resumeDate, yearMonth]);
  const [seasons] = await connection.execute(`SELECT ss.id AS enrollment_id, ss.payment_status AS enrollment_payment_status,
    ss.is_cancelled, ss.aftercare_applied_at, se.* FROM student_seasons ss JOIN seasons se ON se.id = ss.season_id
    WHERE ss.student_id = ? AND se.academy_id = ? ORDER BY ss.id${suffix}`, [student.id, student.academy_id]);
  return {
    seasons, canCreateMonthlyPayment: await payments.canCreateMonthlyPayment(connection, student, yearMonth),
    credits: await credits.findCurrentRestCreditsForUpdate(connection, {
      studentId: student.id, academyId: student.academy_id, restStartDate: student.rest_start_date, lock,
    }),
    payments: await payments.findMonthlyPayments(connection, student, yearMonth, lock),
    schedules, attendance, seasonGaps: await seasonGapRanges(connection, student.id, student.academy_id),
  };
}
module.exports = { state };
