import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { loadTypeScript } from './helpers/load-typescript.mjs';

const { formatLifecycleMoney, needsPauseBillingPreview, omitUnchangedPauseStartDate,
  describePauseBillingResult, describeWithdrawalBillingResult, describeRestCreditResult } = loadTypeScript('src/lib/utils/lifecycle-billing.ts');
test('billing amount display retains zero and cents and never substitutes unknown amounts with zero', () => {
  assert.equal(formatLifecycleMoney(0), '0원');
  assert.equal(formatLifecycleMoney(135000), '135,000원');
  assert.equal(formatLifecycleMoney('100000.25'), '100,000.25원');
  assert.equal(formatLifecycleMoney('0.01'), '0.01원');
  for (const value of [null, undefined, '', '   ', Number.NaN, Infinity, 'not a number']) {
    assert.equal(formatLifecycleMoney(value), '금액 확인 필요');
  }
});
test('only entering pause or changing an already paused date requests an authoritative quote', () => {
  const paused = { status: 'paused', rest_start_date: '2026-05-01' };
  assert.equal(needsPauseBillingPreview(paused, { rest_start_date: '2026-05-15' }), true);
  assert.equal(needsPauseBillingPreview(paused, { status: 'paused', rest_start_date: '2026-05-15' }), true);
  assert.equal(needsPauseBillingPreview(paused, { rest_start_date: '2026-05-01' }), false);
  assert.equal(needsPauseBillingPreview(paused, { status: 'paused' }), false);
  assert.equal(needsPauseBillingPreview(paused, { status: 'active' }), false);
  assert.equal(needsPauseBillingPreview({ status: 'active', rest_start_date: null }, { status: 'paused' }), true);
  assert.equal(needsPauseBillingPreview(undefined, { status: 'paused' }), false);
});
test('unchanged paused dates are omitted without mutating the input or removing a requested correction', () => {
  const initial = { status: 'paused', rest_start_date: '2026-05-01' };
  const input = { status: 'paused', rest_start_date: '2026-05-01', name: '수정' };
  assert.deepEqual(omitUnchangedPauseStartDate(initial, input), { status: 'paused', name: '수정' });
  assert.equal(input.rest_start_date, '2026-05-01');
  const correction = { rest_start_date: '2026-05-15' };
  assert.deepEqual(omitUnchangedPauseStartDate(initial, correction), correction);
});
test('confirmation results show server amounts, bill counts and preserved payment history', () => {
  const pause = describePauseBillingResult({ action: 'adjusted', originalAmount: 600000,
    adjustedAmount: 335000, paymentIds: [701, 702], message: '정산 완료' });
  assert.match(pause, /2건/); assert.match(pause, /600,000원/); assert.match(pause, /335,000원/); assert.match(pause, /납부 이력/);
  assert.equal(describePauseBillingResult({ action: 'unchanged', originalAmount: 0,
    adjustedAmount: 0, paymentIds: [], message: '변경 없음' }), '변경 없음');
  const withdrawal = describeWithdrawalBillingResult({ cancelledPayments: 1, adjustedPayments: 2,
    waivedAmount: 265000.25, paymentIds: [701, 702, 705], message: '정산 완료' });
  assert.match(withdrawal, /1건/); assert.match(withdrawal, /2건/); assert.match(withdrawal, /265,000\.25원/);
  assert.match(withdrawal, /납부 이력/);
});
test('existing credit results retain their actual status and original credited amount', () => {
  const credit = { id: 77, credit_type: 'carryover', credit_amount: 164000, remaining_amount: 64000, status: 'partial' };
  const partial = describeRestCreditResult(credit);
  assert.match(partial, /164,000원/); assert.match(partial, /일부 사용/);
  const refunded = describeRestCreditResult({ ...credit, credit_type: 'refund', remaining_amount: 0, status: 'refunded' });
  assert.match(refunded, /환불 완료/); assert.match(refunded, /164,000원/); assert.doesNotMatch(refunded, /대기/);
});
test('preview panel renders authoritative amounts and distinguishes its loading and error states', () => {
  const { LifecycleBillingPreviewPanel } = loadTypeScript('src/components/students/lifecycle-billing-preview.tsx');
  const summary = { original_amount: 600000, before_final_amount: 600000, prorated_amount: 270000,
    adjusted_amount: 335000, paid_amount: 200000, outstanding_amount: 135000, waived_amount: 265000, refundable_amount: 65000 };
  const data = { action: 'pause', date: '2026-05-15', year_month: '2026-05', student_id: 101, days_before: 14,
    days_month: 31, summary, rows: [{ payment_id: 701, year_month: '2026-05', payment_type: 'monthly',
      before_status: 'pending', after_status: 'pending', ...summary, changed: true, days_before: 14, days_month: 31 }],
    requires_confirmation: true, readonly: true, external_refund_executed: false, preview_hash: 'synthetic-preview-hash' };
  const render = preview => renderToStaticMarkup(React.createElement(LifecycleBillingPreviewPanel,
    { preview: { ready: true, retry() {}, error: null, loading: false, data: null, ...preview } }));
  const html = render({ data });
  for (const amount of ['600,000원', '335,000원', '200,000원', '135,000원']) assert.ok(html.includes(amount), amount);
  assert.match(html, /14/); assert.match(html, /31/);
  const loading = render({ loading: true, ready: false }); assert.match(loading, /계산|확인|불러/);
  const error = render({ ready: false, error: '원금 확인이 필요합니다.' }); assert.match(error, /원금 확인이 필요합니다/);
});
test('the result panel renders the confirmed server amounts instead of retaining a prior preview amount', () => {
  const { LifecycleBillingResultPanel } = loadTypeScript('src/components/students/lifecycle-billing-preview.tsx');
  const summary = { original_amount: 600000, before_final_amount: 600000, prorated_amount: 270000,
    adjusted_amount: 340000, paid_amount: 200000, outstanding_amount: 140000, waived_amount: 260000, refundable_amount: 65000 };
  const result = { summary, rows: [], message: '서버 처리 완료' };
  const html = renderToStaticMarkup(React.createElement(LifecycleBillingResultPanel, { title: '실제 처리 결과', result }));
  assert.ok(html.includes('340,000원')); assert.ok(html.includes('140,000원'));
  assert.ok(!html.includes('335,000원')); assert.match(html, /실제 처리 결과/);
});
test('review flags remain visible in preview and actual results and a zero unused payment is displayed explicitly', () => {
  const { LifecycleBillingPreviewPanel, LifecycleBillingResultPanel } = loadTypeScript('src/components/students/lifecycle-billing-preview.tsx');
  const summary = { original_amount: 300000, before_final_amount: 300000, prorated_amount: 135000,
    adjusted_amount: 300000, paid_amount: 0, outstanding_amount: 0, waived_amount: 0, refundable_amount: 0 };
  const rows = [{ payment_id: 701, year_month: '2026-05', payment_type: 'monthly', before_status: 'paid', after_status: 'paid',
    days_before: 14, days_month: 31, changed: false, requires_payment_review: true, ...summary }];
  const data = { action: 'pause', date: '2026-05-15', student_id: 101, days_before: 14, days_month: 31, summary, rows,
    preview_hash: 'synthetic', readonly: true, requires_confirmation: true, external_refund_executed: false };
  const html = [
    renderToStaticMarkup(React.createElement(LifecycleBillingPreviewPanel,
      { preview: { data, ready: true, loading: false, error: null, retry() {} } })),
    renderToStaticMarkup(React.createElement(LifecycleBillingResultPanel,
      { title: '실제 처리 결과', result: { summary, rows, message: '처리 완료' } })),
  ];
  for (const markup of html) {
    const text = markup.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ');
    assert.match(text, /납부 상태와 기록된 납부액이 달라 확인이 필요합니다/);
    assert.match(text, /자동 환불·이월액은 산정하지 않습니다/);
    assert.match(text, /미사용 납부액 \(참고\) 0원/);
  }
});
