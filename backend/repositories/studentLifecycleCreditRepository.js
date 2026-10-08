async function existing(conn, context, id) {
  const [rows] = await conn.execute(`SELECT * FROM rest_credits
    WHERE id=? AND student_id=? AND academy_id=? FOR UPDATE`, [id, context.studentId, context.academyId]);
  return rows[0];
}

async function insert(conn, context, credit) {
  const [result] = await conn.execute(`INSERT INTO rest_credits
    (student_id,academy_id,source_payment_id,rest_start_date,rest_end_date,rest_days,
     credit_amount,remaining_amount,credit_type,status,notes)
    VALUES (?,?,?,?,?,?,?,?,?,'pending',?)`,
  [context.studentId, context.academyId, credit.source_payment_id, credit.rest_start_date,
    credit.rest_end_date, credit.rest_days, credit.credit_amount, credit.remaining_amount,
    credit.credit_type, `휴원 정산 ${credit.rest_start_date} ~ ${credit.rest_end_date}`]);
  return existing(conn, context, result.insertId);
}

module.exports = { existing, insert };
