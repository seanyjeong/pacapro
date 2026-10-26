const repo = require('../repositories/ilsanEnrollmentRepository');
const apps = require('../repositories/ilsanAdmissionRepository');
const { ACADEMY_ID } = require('../constants/ilsanAdmission');
const { REGISTER_STATUSES } = require('../constants/ilsanAdmissionExisting');
const { fail, quote, fingerprint } = require('../models/ilsanAdmission');
const { seal, open, json } = require('./ilsanAdmissionCodec');
const { prepareStudentParentContacts } = require('./studentParentContactService');

function duplicates(profile, roster) {
  return roster.filter(student => !student.deleted_at && open(student.name).trim() === profile.name &&
    open(student.phone || '').replace(/\D/g, '') === profile.phone.replace(/\D/g, '')).map(student => student.id);
}
function nextStudentNumber(roster, year) {
  const numbers = roster.map(s => String(s.student_number || '')).filter(n => new RegExp(`^${year}\\d+$`).test(n));
  return year + String(Math.max(0, ...numbers.map(n => Number(n.slice(4)))) + 1).padStart(3, '0');
}
const schedule = terms => ({ enrollment_date: terms.enrollment_date, monthly_tuition: terms.monthly_tuition, discount_rate: terms.discount_rate,
  class_days: JSON.stringify(terms.class_days.map(day => ({day,timeSlot:terms.time_slot}))),
  weekly_count: terms.class_days.length, time_slot: terms.time_slot });
// The existing record keeps its id, number and history; its details were already updated at approval.
async function activateExisting(conn, row, targetId, terms, calculation) {
  const student = await repo.student(conn, targetId);
  if (!student) fail(404, 'STUDENT_NOT_FOUND', '등록할 기존 학생을 찾을 수 없습니다.');
  if (!REGISTER_STATUSES.includes(student.status)) fail(409, 'STUDENT_STATUS_CHANGED', '기존 학생의 상태가 바뀌었습니다. 학생 정보를 다시 확인해 주세요.');
  if (await repo.monthlyPayment(conn, targetId, calculation.year_month)) {
    fail(409, 'PAYMENT_EXISTS', '이 학생의 해당 월 학원비가 이미 있습니다. 학생 화면에서 확인해 주세요.');
  }
  const number = student.student_number ? {} : { student_number: nextStudentNumber(await repo.roster(conn, true), row.enrollment_date.slice(0, 4)) };
  await repo.updateStudent(conn, targetId, { ...number, status: 'active', is_trial: 0, ...(student.status === 'trial' && { trial_remaining: 0 }),
    ...schedule(terms), class_days_next: null, class_days_effective_from: null, rest_start_date: null, rest_end_date: null, rest_reason: null });
  const paymentId = await repo.createPayment(conn, targetId, row.approved_by, calculation);
  await repo.assignClasses(conn, targetId, calculation);
  // The unique student_id column stays reserved for newly created students.
  await apps.enrolled(conn, row.id, null, paymentId);
  return { student_id: targetId, payment_id: paymentId };
}
async function activate(conn, row, today) {
  if (row.status === 'enrolled') return null;
  if (row.status !== 'scheduled' || row.enrollment_date > today) return null;
  // An outage across month-end needs a new fee/date review, not a backdated enrollment.
  if (row.enrollment_date.slice(0, 7) !== today.slice(0, 7)) fail(409, 'ENROLLMENT_OVERDUE', '등록 예정월이 지났습니다. 등록일과 학원비를 다시 확인해 주세요.');
  const profile = JSON.parse(open(row.profile_encrypted)), { target_student_id: targetId, ...terms } = json(row.terms_json), calculation = quote(terms);
  if (fingerprint(calculation) !== fingerprint(json(row.quote_json))) fail(409, 'QUOTE_CHANGED', '확정한 학원비 계산을 다시 확인해 주세요.');
  if (targetId) return activateExisting(conn, row, targetId, terms, calculation);
  const roster = await repo.roster(conn, true);
  if (duplicates(profile, roster).length) fail(409, 'DUPLICATE_STUDENT', '같은 이름과 전화번호의 학생이 이미 있습니다. 기존 학생을 확인해 주세요.');
  const contacts = prepareStudentParentContacts(profile);
  const id = await repo.createStudent(conn, { academy_id: ACADEMY_ID, student_number: nextStudentNumber(roster, row.enrollment_date.slice(0, 4)),
    name: seal(profile.name), phone: seal(profile.phone), gender: profile.gender, school: profile.school, grade: profile.grade,
    student_type: 'exam', admission_type: 'regular', status: 'active', is_trial: 0,
    parent_phone: seal(profile[`${profile.primary_parent}_phone`]), ...contacts.encrypted, ...schedule(terms) });
  const paymentId = await repo.createPayment(conn, id, row.approved_by, calculation);
  await repo.assignClasses(conn, id, calculation);
  await apps.enrolled(conn, row.id, id, paymentId);
  return { student_id: id, payment_id: paymentId };
}
module.exports = { activate, duplicates };
