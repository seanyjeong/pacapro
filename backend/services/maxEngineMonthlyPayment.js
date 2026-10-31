// 학생 한 명 월회비 청구(monthly_payment_create) — 매월 1일 자동 청구(scheduler/paymentScheduler.js)와 같은 계산.
// 스케줄러는 간이 핫픽스로 바꿀 수 없어 계산을 옮겨 왔고, 통합 시험이 스케줄러 결과와 그대로 대조한다.
const repo = require('../repositories/maxEngineMonthlyPaymentRepository');
const nonSeason = require('./nonSeasonProratedBilling');
const { calculateDueDate } = require('../utils/dueDateCalculator');
const { commands } = require('../constants/maxEngineCommands');
const { fail, decrypt } = require('./maxEngineFullSecurity');

const supports = operation => operation === 'monthly_payment_create';
const truncateToThousands = amount => Math.floor(amount / 1000) * 1000;
const conflict = message => fail(409, 'STUDENT_STATUS_CONFLICT', message);
function classDaysOf(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  try { return JSON.parse(value); } catch { return String(value).split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)); }
}

async function state(conn, actor, { changes }, lock) {
  const before = await repo.monthlyState(conn, actor, changes.student_id, changes.year_month, lock);
  // 시즌으로 월회비가 빠지는 달이면 비시즌 종강 일할 청구 대상인지 본다 (자동 청구와 같은 규칙)
  if (before.student && !before.allowed) {
    before.nonSeason = (await nonSeason.nonSeasonProratedCandidates(conn, actor.academy_id, changes.year_month, before.student.id))[0] || null;
  }
  return before;
}
function plan({ changes }, { student, allowed, existing, credit, nonSeason: candidate }) {
  const yearMonth = changes.year_month;
  if (!student) conflict('내 교육원에서 학생을 찾지 못했습니다.');
  if (student.status !== 'active') conflict(`재원 학생만 월회비 청구를 만듭니다(지금 상태: ${student.status}). 휴원 복귀는 student_reactivate 로 합니다.`);
  if (existing.length) fail(409, 'PAYMENT_EXISTS', `${yearMonth} 월회비 청구가 이미 있습니다(청구 id ${existing.map(p => p.id).join(', ')}). 금액은 청구 금액 수정(payment_update)으로 고쳐 주세요.`);
  if (!allowed) {
    if (candidate) return { candidate, ...nonSeason.planNonSeasonProrated(candidate, yearMonth) };
    fail(409, 'SEASON_CONFLICT', '시즌비가 월회비를 대신하는 달이거나 시즌 무료 수업·자동 졸업 기간이라 월회비 청구를 만들 수 없습니다(비시즌 종강 일할 대상도 아님).');
  }
  if (!(parseFloat(student.monthly_tuition) > 0)) conflict('학생 월회비가 0원이라 청구를 만들지 않습니다. 파카 학생 정보에서 월회비를 먼저 정해 주세요.');
  if (student.enrollment_month && student.enrollment_month > yearMonth) fail(422, 'STUDENT_DATE_RANGE', `등록월(${student.enrollment_month}) 이전 달에는 청구를 만들지 않습니다.`);
  const [year, month] = yearMonth.split('-').map(Number);
  const baseAmount = parseFloat(student.monthly_tuition);
  const discountRate = parseFloat(student.discount_rate) || 0;
  const discountAmount = truncateToThousands(baseAmount * discountRate / 100);
  // 휴원 이월·공결·수동 크레딧 중 가장 오래된 한 건을 차감 (스케줄러와 같음)
  let carryoverAmount = 0, notes = null, creditAfter = null;
  if (credit) {
    carryoverAmount = Math.min(credit.remaining_amount, baseAmount - discountAmount);
    const remaining = credit.remaining_amount - carryoverAmount;
    creditAfter = { id: credit.id, remaining_amount: remaining, status: remaining <= 0 ? 'applied' : 'partial' };
    notes = `[크레딧 차감] ${credit.credit_type === 'excused' ? '공결' : '휴식'} 크레딧 ${carryoverAmount.toLocaleString()}원 차감`;
  }
  return { yearMonth, baseAmount, discountAmount, carryoverAmount, restCreditId: credit?.id ?? null,
    finalAmount: truncateToThousands(baseAmount - discountAmount - carryoverAmount),
    dueDate: calculateDueDate(year, month, student.due_day, classDaysOf(student.class_days)),
    description: carryoverAmount > 0 ? `${month}월 학원비 (이월 차감 적용)` : `${month}월 학원비`, notes, creditAfter };
}
function display(command, before) {
  const p = plan(command, before), { student, credit } = before;
  if (p.candidate) return { before: null, after: { student_id: student.id, name: decrypt(student.name), year_month: p.yearMonth, payment_type: 'monthly',
    base_amount: p.amount, discount_amount: 0, carryover_amount: 0, final_amount: p.amount, due_date: p.dueDate, payment_status: 'pending',
    description: p.description, notes: p.notes, related: { non_season_prorated: { enrollment_id: p.candidate.enrollment_id,
      season_name: p.candidate.season_name, non_season_end_date: p.candidate.non_season_end_date } } }, notice: commands[command.operation].notice };
  return { before: null, after: { student_id: student.id, name: decrypt(student.name), year_month: p.yearMonth, payment_type: 'monthly',
    base_amount: p.baseAmount, discount_rate: student.discount_rate, discount_amount: p.discountAmount, carryover_amount: p.carryoverAmount,
    final_amount: p.finalAmount, due_date: p.dueDate, payment_status: 'pending', description: p.description, notes: p.notes,
    related: { rest_credit_before: credit, rest_credit_after: p.creditAfter } }, notice: commands[command.operation].notice };
}
async function apply(conn, actor, command, before) {
  const p = plan(command, before);
  if (p.candidate) return Number(await nonSeason.insertNonSeasonProrated(conn, actor.academy_id, p.candidate, p, actor.user_id));
  return Number(await repo.create(conn, actor, before.student.id, p));
}
module.exports = { supports, state, display, apply };
