const { ACADEMY_ID } = require('../constants/ilsanAdmission');
const { FIELDS } = require('../constants/ilsanAdmissionExisting');
const columns = ['id','name','student_number','status',...Object.keys(FIELDS)].map(k=>`\`${k}\``).join(',');
async function students(conn, id, lock = false) {
  return (await conn.execute(`SELECT ${columns} FROM students WHERE academy_id=? AND deleted_at IS NULL
    ${id ? 'AND id=?' : ''} ORDER BY id${lock ? ' FOR UPDATE' : ''}`, [ACADEMY_ID,...(id ? [id] : [])]))[0];
}
async function fill(conn, id, values) {
  const keys=Object.keys(values);
  if (!keys.length) return;
  if (keys.some(k=>!Object.hasOwn(FIELDS,k))) throw new Error('Unexpected admission enrichment field');
  await conn.execute(`UPDATE students SET ${keys.map(k=>`\`${k}\`=?`).join(',')} WHERE id=? AND academy_id=? AND deleted_at IS NULL`,
    [...Object.values(values),id,ACADEMY_ID]);
}
async function complete(conn, applicationId, actorId, metadata) {
  // Existing-student completions live in terms_json: the unique student_id column
  // remains reserved for newly created students, so later intake can fill new gaps.
  await conn.execute(`UPDATE ilsan_admission_applications SET status='enrolled',terms_json=?,quote_json=NULL,
    student_id=NULL,payment_id=NULL,enrollment_date=NULL,approved_by=?,approved_at=NOW(),review_code=NULL,
    revision=revision+1 WHERE id=? AND academy_id=?`, [JSON.stringify(metadata),actorId,applicationId,ACADEMY_ID]);
}
module.exports = { students, fill, complete };
