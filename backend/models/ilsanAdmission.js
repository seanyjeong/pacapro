const crypto = require('crypto');
const { GRADES, TIME_SLOTS, MAX_MONTHLY_TUITION } = require('../constants/ilsanAdmission');

class AdmissionError extends Error {
  constructor(status, code, message) { super(message); Object.assign(this, { status, code }); }
}
function fail(status, code, message) { throw new AdmissionError(status, code, message); }
function dateText(value, label = '등록일') {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) ||
      !Number.isFinite(Date.parse(value)) || new Date(value).toISOString().slice(0, 10) !== value) {
    fail(422, 'INVALID_DATE', `${label}을 올바르게 입력해 주세요.`);
  }
  return value;
}
function text(value, label, max, required = true) {
  if (value == null && !required) return '';
  if (typeof value !== 'string' || /^ENC:/i.test(value.trim()) || /[\u0000-\u001f\u007f]/.test(value) || value.trim().length > max ||
      (required && !value.trim())) fail(422, 'INVALID_INPUT', `${label}을 확인해 주세요.`);
  return value.trim();
}
function phone(value, label, required = false) {
  const input = text(value, label, 20, required);
  if (!input && !required) return '';
  const digits = input.replace(/[- ]/g, '');
  if (!/^01[016789]\d{7,8}$/.test(digits)) fail(422, 'INVALID_PHONE', `${label}를 확인해 주세요.`);
  return digits.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
}
function application(input, today) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(422, 'INVALID_INPUT', '입학원서를 확인해 주세요.');
  const birth = text(input.birth_six, '생년월일 앞 6자리', 6);
  if (!/^\d{6}$/.test(birth)) fail(422, 'INVALID_BIRTH', '생년월일 앞 6자리만 입력해 주세요.');
  dateText(`20${birth.slice(0, 2)}-${birth.slice(2, 4)}-${birth.slice(4)}`, '생년월일');
  if (!GRADES.includes(input.grade) || !['male', 'female'].includes(input.gender)) {
    fail(422, 'INVALID_INPUT', '학년과 성별을 선택해 주세요.');
  }
  const desiredDate = dateText(input.enrollment_date);
  if (desiredDate < today) fail(422, 'PAST_DATE', '등록 희망일은 오늘 이후로 선택해 주세요.');
  if (input.consent !== true) fail(422, 'CONSENT_REQUIRED', '입학원서 정보 제공에 동의해 주세요.');
  const result = { name: text(input.name, '학생 이름', 50), school: text(input.school, '학교', 100),
    grade: input.grade, gender: input.gender, birth_six: birth, phone: phone(input.phone, '학생 전화번호', true),
    father_name: text(input.father_name, '아버님 성함', 50, false), mother_name: text(input.mother_name, '어머님 성함', 50, false),
    father_phone: phone(input.father_phone, '아버님 전화번호'), mother_phone: phone(input.mother_phone, '어머님 전화번호'),
    enrollment_date: desiredDate, consent: true };
  if (!result.father_phone && !result.mother_phone) fail(422, 'PARENT_REQUIRED', '보호자 전화번호를 한 분 이상 입력해 주세요.');
  if (!['father', 'mother'].includes(input.primary_parent) || !result[`${input.primary_parent}_phone`]) {
    fail(422, 'PARENT_REQUIRED', '안내를 받을 보호자 번호를 선택해 주세요.');
  }
  return { ...result, primary_parent: input.primary_parent };
}
function terms(input, today) {
  if (!input || typeof input !== 'object' || Array.isArray(input)) fail(422, 'INVALID_INPUT', '등록 조건을 확인해 주세요.');
  const date = dateText(input.enrollment_date);
  if (date < today) fail(422, 'PAST_DATE', '등록일이 지났습니다. 등록일을 다시 확인해 주세요.');
  const amount = Number(input.monthly_tuition), discount = Number(input.discount_rate ?? 0);
  if (!['number', 'string'].includes(typeof input.monthly_tuition) || String(input.monthly_tuition).trim() === '' ||
      !Number.isSafeInteger(amount) || amount < 0 || amount > MAX_MONTHLY_TUITION ||
      !Number.isInteger(discount) || discount < 0 || discount > 100) fail(422, 'INVALID_FEE', '월 학원비와 할인율을 확인해 주세요.');
  if (!Array.isArray(input.class_days) || !input.class_days.length || input.class_days.length > 7 ||
      input.class_days.some(day => !Number.isInteger(day) || day < 0 || day > 6) ||
      new Set(input.class_days).size !== input.class_days.length || !TIME_SLOTS.includes(input.time_slot)) {
    fail(422, 'INVALID_CLASSES', '수업 요일과 시간대를 선택해 주세요.');
  }
  return { enrollment_date: date, monthly_tuition: amount, discount_rate: discount,
    class_days: [...input.class_days].sort(), time_slot: input.time_slot };
}
function quote(value) {
  const date = dateText(value.enrollment_date), month = date.slice(0, 7);
  const last = new Date(`${month}-01T00:00:00Z`); last.setUTCMonth(last.getUTCMonth() + 1, 0);
  const days = [];
  for (let day = 1; day <= last.getUTCDate(); day++) {
    const dayText = `${month}-${String(day).padStart(2, '0')}`;
    if (value.class_days.includes(new Date(`${dayText}T00:00:00Z`).getUTCDay())) days.push(dayText);
  }
  const remaining = days.filter(day => day >= date);
  // A configured timetable with no remaining lessons is zero, never a calendar-day fallback.
  const prorated = days.length ? Number(BigInt(value.monthly_tuition) * BigInt(remaining.length) / BigInt(days.length) / 1000n * 1000n) : 0;
  const discount = Number(BigInt(prorated) * BigInt(value.discount_rate) / 100n / 1000n * 1000n);
  return { ...value, year_month: month, total_classes: days.length, remaining_classes: remaining.length,
    class_dates: remaining, prorated_amount: prorated, discount_amount: discount, final_amount: prorated - discount };
}
// MySQL JSON normalizes object key order; a stored quote must retain its fingerprint.
function canonical(value) {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === 'object') return Object.fromEntries(Object.keys(value).sort().map(key => [key, canonical(value[key])]));
  return value;
}
const fingerprint = value => crypto.createHash('sha256').update(JSON.stringify(canonical(value))).digest('hex');
module.exports = { AdmissionError, fail, dateText, application, terms, quote, fingerprint };
