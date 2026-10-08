const { fail } = require('../models/maxEngineError');

async function withdrawalPayments(conn, { academyId, studentId }, { lock = true } = {}) {
  const [rows] = await conn.execute(`SELECT * FROM student_payments
    WHERE academy_id = ? AND student_id = ? ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [academyId, studentId]);
  return rows;
}

async function pausePayments(conn, { academyId, studentId, date, previousDate }, { lock = true } = {}) {
  const target = date.slice(0, 7), prior = previousDate?.slice(0, 7) || target;
  const crossMonth = target !== prior;
  const months = crossMonth ? [target < prior ? target : prior, target > prior ? target : prior] : [target];
  const [rows] = await conn.execute(`SELECT * FROM student_payments
    WHERE academy_id = ? AND student_id = ? AND \`year_month\` ${crossMonth ? 'BETWEEN ? AND ?' : '= ?'} AND payment_type = 'monthly'
    ORDER BY \`year_month\`, id${lock ? ' FOR UPDATE' : ''}`,
  [academyId, studentId, ...months]);
  return rows;
}

async function pauseAudits(conn, { academyId, studentId }, paymentIds, { lock = true, history = false } = {}) {
  if (!paymentIds.length) return [];
  const [rows] = await conn.execute(`SELECT a.* FROM max_engine_payment_settlements a
    WHERE a.academy_id = ? AND a.student_id = ? AND a.payment_id IN (${paymentIds.map(() => '?').join(',')})
    ${history ? '' : `AND NOT EXISTS (SELECT 1 FROM max_engine_payment_settlements newer
      WHERE newer.academy_id = a.academy_id AND newer.student_id = a.student_id
      AND newer.payment_id = a.payment_id AND newer.id > a.id)`} ORDER BY a.id${lock ? ' FOR UPDATE' : ''}`,
  [academyId, studentId, ...paymentIds]);
  return rows;
}

async function pauseCredits(conn, { academyId, studentId, previousDate }, { lock = true } = {}) {
  const [rows] = await conn.execute(`SELECT id, credit_amount, remaining_amount, status FROM rest_credits
    WHERE academy_id = ? AND student_id = ? AND rest_start_date = ?
    AND credit_type IN ('carryover','refund') AND COALESCE(status,'pending') <> 'cancelled'
    AND (COALESCE(credit_amount,0) > 0 OR COALESCE(remaining_amount,0) > 0
      OR status IN ('applied','partial','used','refunded')) ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
  [academyId, studentId, previousDate]);
  return rows;
}

async function creditRows(conn, { academyId, studentId, date }, { lock = true } = {}) {
  const [rows] = await conn.execute(`SELECT * FROM rest_credits WHERE academy_id = ? AND student_id = ?
    AND rest_start_date = ? AND credit_type IN ('carryover','refund')
    AND COALESCE(status,'pending') <> 'cancelled' ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
  [academyId, studentId, date]);
  return rows;
}

async function creditAllocations(conn, { academyId, studentId, date }, ids, { lock = true } = {}) {
  const monthStart = `${date.slice(0, 7)}-01`;
  const monthEnd = new Date(`${monthStart}T00:00:00.000Z`); monthEnd.setUTCMonth(monthEnd.getUTCMonth() + 1, 0);
  const [rows] = await conn.execute(`SELECT id,credit_amount,source_payment_id,status FROM rest_credits
    WHERE academy_id = ? AND student_id = ? AND COALESCE(status,'pending') <> 'cancelled'
    AND (${ids.length ? `source_payment_id IN (${ids.map(() => '?').join(',')}) OR ` : ''}
      (source_payment_id IS NULL AND rest_start_date BETWEEN ? AND ?)) ORDER BY id${lock ? ' FOR UPDATE' : ''}`,
  [academyId, studentId, ...ids, monthStart, monthEnd.toISOString().slice(0, 10)]);
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

async function seasonRows(conn, { academyId, studentId }, { lock = true } = {}) {
  const [rows] = await conn.execute(`SELECT ss.id, ss.season_id, ss.season_fee, ss.payment_status, s.season_name
    FROM student_seasons ss JOIN seasons s ON s.id = ss.season_id
    WHERE ss.student_id = ? AND s.academy_id = ? AND COALESCE(ss.is_cancelled,0) = 0
    ORDER BY ss.id${lock ? ' FOR UPDATE' : ''}`, [studentId, academyId]);
  return rows;
}

async function endSeasons(conn, { academyId, studentId, date }) {
  const rows = await seasonRows(conn, { academyId, studentId });
  if (rows.length) await conn.execute(`UPDATE student_seasons ss JOIN seasons s ON s.id = ss.season_id
    SET ss.is_cancelled = 1, ss.cancellation_date = ?, ss.after_season_action = 'terminate', ss.updated_at = NOW()
    WHERE ss.student_id = ? AND s.academy_id = ? AND ss.id IN (${rows.map(() => '?').join(',')})`,
  [date, studentId, academyId, ...rows.map(row => row.id)]);
  return rows;
}

module.exports = { withdrawalPayments, pausePayments, pauseAudits, pauseCredits, creditRows, creditAllocations, seasonRows, persist, endSeasons };
