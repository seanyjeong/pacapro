const { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams } = require('./seasonMonthlyExclusion');

async function academy(conn, academyId) {
  const [rows] = await conn.execute('SELECT id,name,owner_user_id FROM academies WHERE id=?', [academyId]);
  return rows[0];
}

async function actor(conn, academyId, userId) {
  const [rows] = await conn.execute(`SELECT u.id FROM users u JOIN academies a ON a.id=?
    WHERE u.id=? AND (u.academy_id=? OR a.owner_user_id=u.id)
    AND u.role IN ('owner','admin') AND u.is_active=1 AND u.approval_status='approved'`,
  [academyId, userId, academyId]);
  return rows[0];
}

async function students(conn, academyId, lock = false) {
  const [rows] = await conn.execute(`SELECT id,academy_id,name,status,rest_start_date,rest_end_date,
    monthly_tuition,discount_rate FROM students WHERE academy_id=? AND status='paused'
    AND deleted_at IS NULL ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [academyId]);
  return rows;
}

async function monthlyPayments(conn, academyId, studentId, month) {
  const [rows] = await conn.execute(`SELECT * FROM student_payments WHERE academy_id=? AND student_id=?
    AND \`year_month\`=? AND payment_type='monthly' ORDER BY id`, [academyId, studentId, month]);
  return rows;
}

async function monthlyAllowed(conn, academyId, studentId, month) {
  const [rows] = await conn.execute(`SELECT s.id FROM students s WHERE s.id=? AND s.academy_id=?
    AND ${seasonMonthlyExclusionSql('s')}`, [studentId, academyId, ...seasonMonthlyExclusionParams(month)]);
  return rows.length > 0;
}

module.exports = { academy, actor, students, monthlyPayments, monthlyAllowed };
