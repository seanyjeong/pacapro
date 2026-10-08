const crypto = require('crypto');
const repository = require('../repositories/studentPausedBillingRepairRepository');
const billing = require('./studentLifecycleBillingService');
const { cents } = require('../models/maxEngineSettlement');
const { fail } = require('../models/maxEngineError');

function paymentIssue(row) {
  if (row.rest_credit_id || row.prepaid_group_id) return 'linked_credit_or_prepaid';
  const details = typeof row.proration_details === 'string' ? JSON.parse(row.proration_details) : row.proration_details;
  if (details?.type === 'student_pause') return null;
  if (['paid', 'cancelled'].includes(row.payment_status)) return null;
  if (row.is_prorated === 1 || row.base_amount == null || row.discount_amount == null || row.additional_amount == null) {
    return 'original_amount_unverified';
  }
  const original = cents(row.base_amount) - cents(row.discount_amount) + cents(row.additional_amount);
  return original < 0 || cents(row.final_amount) !== original ? 'original_amount_unverified' : null;
}

async function target(conn, options) {
  const { academyId, userId, academyName } = options;
  if (![academyId, userId].every(value => Number.isSafeInteger(value) && value > 0) || !academyName?.trim()) {
    fail(422, 'INVALID_INPUT', '조회한 교육원 id·정확한 교육원 이름·처리자 id가 필요합니다.');
  }
  const academy = await repository.academy(conn, academyId);
  if (!academy || academy.name !== academyName) fail(409, 'ACADEMY_CHANGED', '교육원 이름과 id가 일치하지 않습니다.');
  if (!await repository.actor(conn, academyId, userId)) fail(403, 'REPAIR_ACTOR', '해당 교육원의 활성 원장·관리자만 보정할 수 있습니다.');
  return academy;
}

async function plan(conn, options) {
  const academy = await target(conn, options);
  const rows = await repository.students(conn, options.academyId);
  const corrections = [], review = [], unchanged = [];
  for (const student of rows) {
    try {
      const context = { ...options, studentId: student.id, student, action: 'pause',
        date: student.rest_start_date, previousDate: student.rest_start_date, creditType: 'none', restEndDate: null };
      billing.validateContext(context);
      if (!await repository.monthlyAllowed(conn, options.academyId, student.id, context.date.slice(0, 7))) {
        review.push({ student_id: student.id, issue: 'season_monthly_policy_requires_review' }); continue;
      }
      const payments = await repository.monthlyPayments(conn, options.academyId, student.id, context.date.slice(0, 7));
      const issues = payments.map(row => ({ payment_id: row.id, issue: paymentIssue(row) })).filter(row => row.issue);
      if (issues.length) { review.push({ student_id: student.id, date: context.date, issues }); continue; }
      const quote = await billing.preview(conn, context);
      if (!quote.rows.some(row => row.changed)) { unchanged.push(student.id); continue; }
      corrections.push({ student_id: student.id, date: context.date, preview_hash: quote.preview_hash, quote });
    } catch (error) {
      review.push({ student_id: student.id, issue: error.code || 'SOURCE_REVIEW', message: error.message });
    }
  }
  const result = { academy_id: academy.id, academy_name: academy.name, actor_id: options.userId,
    corrections, review, unchanged, readonly: true, external_refunds: 0 };
  return { ...result, plan_hash: crypto.createHash('sha256').update(JSON.stringify(result)).digest('hex') };
}

async function apply(conn, options, expectedPlan) {
    await target(conn, options);
  const { plan_hash: planHash, ...snapshot } = expectedPlan;
  if (!planHash || crypto.createHash('sha256').update(JSON.stringify(snapshot)).digest('hex') !== planHash ||
      expectedPlan.readonly !== true || !Array.isArray(expectedPlan.corrections)) {
    fail(409, 'SOURCE_CHANGED', '보정 계획 내용이 변경되어 전체 보정을 중단합니다.');
  }
  if (expectedPlan.academy_id !== options.academyId || expectedPlan.academy_name !== options.academyName ||
      expectedPlan.actor_id !== options.userId) fail(409, 'SOURCE_CHANGED', '보정 계획의 교육원·처리자가 다릅니다.');
  const students = await repository.students(conn, options.academyId, true);
  const byId = new Map(students.map(student => [student.id, student]));
  const results = [];
  for (const entry of expectedPlan.corrections) {
    const student = byId.get(entry.student_id);
    if (!student || student.rest_start_date !== entry.date) fail(409, 'SOURCE_CHANGED', '휴원 상태·날짜가 변경되어 전체 보정을 중단합니다.');
    if (!await repository.monthlyAllowed(conn, options.academyId, student.id, entry.date.slice(0, 7))) {
      fail(409, 'SOURCE_CHANGED', '시즌 청구 정책이 변경되어 전체 보정을 중단합니다.');
    }
    const payments = await repository.monthlyPayments(conn, options.academyId, student.id, entry.date.slice(0, 7));
    if (payments.some(paymentIssue)) fail(409, 'SOURCE_CHANGED', '청구 원금이 변경되어 전체 보정을 중단합니다.');
    const result = await billing.pause(conn, { ...options, studentId: student.id, student, date: entry.date,
      previousDate: entry.date, creditType: 'none', restEndDate: null, expectedPreviewHash: entry.preview_hash });
    results.push({ student_id: student.id, result });
  }
  return { academy_id: options.academyId, results, review: expectedPlan.review, external_refunds: 0 };
}

module.exports = { plan, apply, paymentIssue };
