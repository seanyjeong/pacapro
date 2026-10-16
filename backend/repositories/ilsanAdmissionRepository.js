const { ACADEMY_ID } = require('../constants/ilsanAdmission');
async function transaction(pool, work) {
  const conn = await pool.getConnection();
  try { await conn.beginTransaction(); const result = await work(conn); await conn.commit(); return result; }
  catch (error) { await conn.rollback(); throw error; }
  finally { conn.release(); }
}
async function academy(conn, lock = false) {
  return (await conn.execute(`SELECT id,name FROM academies WHERE id=?${lock ? ' FOR UPDATE' : ''}`, [ACADEMY_ID]))[0][0];
}
async function bySubmission(conn, key) {
  return (await conn.execute('SELECT * FROM ilsan_admission_applications WHERE academy_id=? AND submission_key=?', [ACADEMY_ID, key]))[0][0];
}
async function ready(conn) {
  await conn.execute('SELECT id FROM ilsan_admission_applications WHERE academy_id=? LIMIT 0', [ACADEMY_ID]);
}
async function insert(conn, key, hash, profile) {
  const [result] = await conn.execute(`INSERT INTO ilsan_admission_applications
    (academy_id,submission_key,payload_hash,profile_encrypted) VALUES (?,?,?,?)`, [ACADEMY_ID, key, hash, profile]);
  return result.insertId;
}
async function get(conn, id, lock = false) {
  return (await conn.execute(`SELECT * FROM ilsan_admission_applications WHERE academy_id=? AND id=?${lock ? ' FOR UPDATE' : ''}`, [ACADEMY_ID, id]))[0][0];
}
async function list(conn, before = null) {
  return (await conn.execute(`SELECT * FROM ilsan_admission_applications WHERE academy_id=?
    ${before ? 'AND id < ?' : ''} ORDER BY id DESC LIMIT 50`, [ACADEMY_ID, ...(before ? [before] : [])]))[0];
}
async function approve(conn, id, userId, terms, quote) {
  await conn.execute(`UPDATE ilsan_admission_applications SET status='scheduled',terms_json=?,quote_json=?,
    enrollment_date=?,approved_by=?,approved_at=NOW(),review_code=NULL,revision=revision+1 WHERE id=? AND academy_id=?`,
  [JSON.stringify(terms), JSON.stringify(quote), terms.enrollment_date, userId, id, ACADEMY_ID]);
}
async function enrolled(conn, id, studentId, paymentId) {
  await conn.execute(`UPDATE ilsan_admission_applications SET status='enrolled',student_id=?,payment_id=?,
    revision=revision+1,review_code=NULL WHERE id=? AND academy_id=?`, [studentId, paymentId, id, ACADEMY_ID]);
}
async function cancel(conn, id) {
  await conn.execute(`UPDATE ilsan_admission_applications SET status='cancelled',revision=revision+1 WHERE id=? AND academy_id=?`, [id, ACADEMY_ID]);
}
async function due(conn, today) {
  return (await conn.execute(`SELECT id FROM ilsan_admission_applications WHERE academy_id=? AND status='scheduled'
    AND enrollment_date<=? ORDER BY enrollment_date,id LIMIT 100`, [ACADEMY_ID, today]))[0];
}
async function review(conn, id, revision, code) {
  const [result] = await conn.execute(`UPDATE ilsan_admission_applications SET status='review',review_code=?,revision=revision+1
    WHERE id=? AND academy_id=? AND status='scheduled' AND revision=?`, [code, id, ACADEMY_ID, revision]);
  return result.affectedRows;
}
module.exports = { transaction, academy, ready, bySubmission, insert, get, list, approve, enrolled, cancel, due, review };
