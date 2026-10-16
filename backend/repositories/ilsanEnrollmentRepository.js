const { ACADEMY_ID } = require('../constants/ilsanAdmission');
async function roster(conn, lock = false) {
  return (await conn.execute(`SELECT id,name,phone,student_number,deleted_at FROM students
    WHERE academy_id=? ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [ACADEMY_ID]))[0];
}
async function createStudent(conn, fields) {
  // Field names are constructed by the internal enrollment service, never from a request object.
  const keys = Object.keys(fields);
  const [result] = await conn.execute(`INSERT INTO students (${keys.map(k => `\`${k}\``).join(',')})
    VALUES (${keys.map(() => '?').join(',')})`, Object.values(fields));
  return result.insertId;
}
async function createPayment(conn, studentId, userId, quote) {
  if (quote.final_amount === 0) return null;
  const [result] = await conn.execute(`INSERT INTO student_payments
    (academy_id,student_id,\`year_month\`,payment_type,base_amount,discount_amount,additional_amount,
     final_amount,paid_amount,payment_status,due_date,description,recorded_by,is_prorated,proration_details)
    VALUES (?,?,?,'monthly',?,?,0,?,0,'pending',?,?,?,1,?)`,
  [ACADEMY_ID, studentId, quote.year_month, quote.prorated_amount, quote.discount_amount, quote.final_amount,
    quote.enrollment_date, `${quote.enrollment_date} 입학원서 등록 · ${quote.remaining_classes}/${quote.total_classes}회 일할계산`,
    userId, JSON.stringify(quote)]);
  return result.insertId;
}
async function assignClasses(conn, studentId, quote) {
  for (const date of quote.class_dates) {
    let [rows] = await conn.execute('SELECT id FROM class_schedules WHERE academy_id=? AND class_date=? AND time_slot=? ORDER BY id LIMIT 1 FOR UPDATE',
      [ACADEMY_ID, date, quote.time_slot]);
    if (!rows.length) {
      const [result] = await conn.execute('INSERT INTO class_schedules (academy_id,class_date,time_slot) VALUES (?,?,?)',
        [ACADEMY_ID, date, quote.time_slot]);
      rows = [{id: result.insertId}];
    }
    await conn.execute(`INSERT INTO attendance (class_schedule_id,student_id,attendance_status) VALUES (?,?,NULL)
      ON DUPLICATE KEY UPDATE student_id=student_id`, [rows[0].id, studentId]);
  }
}
module.exports = { roster, createStudent, createPayment, assignClasses };
