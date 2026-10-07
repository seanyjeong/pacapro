const { fail } = require('../models/maxEngineError');

async function withdrawalPayments(conn, { academyId, studentId }) {
  const [rows] = await conn.execute(`SELECT * FROM student_payments
    WHERE academy_id = ? AND student_id = ? AND (payment_status IS NULL OR payment_status NOT IN ('paid','cancelled'))
    ORDER BY id FOR UPDATE`, [academyId, studentId]);
  return rows;
}

async function pausePayments(conn, { academyId, studentId, date }) {
  const [rows] = await conn.execute(`SELECT * FROM student_payments
    WHERE academy_id = ? AND student_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'
    AND payment_status IN ('pending','partial','overdue') ORDER BY id FOR UPDATE`,
  [academyId, studentId, date.slice(0, 7)]);
  return rows;
}

async function persist(conn, context, change) {
  const { academyId, studentId, userId, date } = context;
  const proration = change.details ? ', is_prorated = 1, proration_details = ?' : '';
  const params = [change.afterFinal, change.paymentStatus,
    ...(change.details ? [JSON.stringify(change.details)] : []), change.paymentId, studentId, academyId];
  const [result] = await conn.execute(`UPDATE student_payments SET final_amount = ?, payment_status = ?${proration},
    updated_at = NOW() WHERE id = ? AND student_id = ? AND academy_id = ?`, params);
  if (result.affectedRows !== 1) fail(409, 'SOURCE_CHANGED', '선택한 학생 청구가 변경되었습니다. 청구 내역을 다시 확인해 주세요.');
  await conn.execute(`INSERT INTO max_engine_payment_settlements
    (academy_id, student_id, payment_id, action, settlement_date, before_final_amount, before_paid_amount,
     after_final_amount, after_paid_amount, waived_amount, refund_amount, expense_id, reason, recorded_by)
    VALUES (?,?,?,?,?,?,?,?,?,?,0,NULL,?,?)`,
  [academyId, studentId, change.paymentId, change.action, date, change.beforeFinal, change.beforePaid,
    change.afterFinal, change.afterPaid, change.waivedAmount, change.reason, userId]);
}

async function endSeasons(conn, { academyId, studentId, date }) {
  const [rows] = await conn.execute(`SELECT ss.id, ss.season_id, ss.season_fee, ss.payment_status, s.season_name
    FROM student_seasons ss JOIN seasons s ON s.id = ss.season_id
    WHERE ss.student_id = ? AND s.academy_id = ? AND COALESCE(ss.is_cancelled,0) = 0
    ORDER BY ss.id FOR UPDATE`, [studentId, academyId]);
  if (rows.length) await conn.execute(`UPDATE student_seasons ss JOIN seasons s ON s.id = ss.season_id
    SET ss.is_cancelled = 1, ss.cancellation_date = ?, ss.after_season_action = 'terminate', ss.updated_at = NOW()
    WHERE ss.student_id = ? AND s.academy_id = ? AND ss.id IN (${rows.map(() => '?').join(',')})`,
  [date, studentId, academyId, ...rows.map(row => row.id)]);
  return rows;
}

module.exports = { withdrawalPayments, pausePayments, persist, endSeasons };
