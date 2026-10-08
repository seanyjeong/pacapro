jest.mock('../../config/database', () => ({ execute: jest.fn() }));
const { validateContext, withdrawalAdjustment, pauseAdjustment } = require('../../models/studentLifecycleBilling');
const context = { academyId: 2, studentId: 14, userId: 7, date: '2026-10-07' };
const bill = overrides => ({ id: 21, academy_id: 2, student_id: 14, payment_type: 'monthly',
  year_month: '2026-10', final_amount: '310000.00', paid_amount: '0.00', payment_status: 'pending', ...overrides });
const auditOf = (change, date) => ({ payment_id: change.paymentId, action: change.action,
  reason: change.reason, settlement_date: date, after_final_amount: change.afterFinal, after_paid_amount: change.afterPaid });

test.each(['2026-02-29', '2026-10-32', '2026-13-01', '2026-10-07T00:00:00+09:00', '', null])('rejects invalid calendar date %s', date => {
  expect(() => validateContext({ ...context, date })).toThrow();
});
test('validates a real leap day and actual actor ids', () => {
  expect(validateContext({ ...context, date: '2028-02-29' }).date).toBe('2028-02-29');
  for (const input of [{ ...context, academyId: 0 }, { ...context, studentId: 1.5 },
    { ...context, userId: -7 }, { ...context, userId: Number.MAX_SAFE_INTEGER + 1 },
    { ...context, reason: 'x'.repeat(256) }]) expect(() => validateContext(input)).toThrow();
});
test('withdrawal cancels unpaid bills and waives only the unpaid part of partial bills', () => {
  expect(withdrawalAdjustment(bill(), '퇴원')).toMatchObject({ action: 'cancel', beforeFinal: '310000.00',
    beforePaid: '0.00', afterFinal: '0.00', afterPaid: '0.00', paymentStatus: 'cancelled', waivedAmount: '310000.00' });
  expect(withdrawalAdjustment(bill({ paid_amount: '120000.25', payment_status: 'partial' }), '퇴원'))
    .toMatchObject({ action: 'adjust', afterFinal: '120000.25', afterPaid: '120000.25',
      paymentStatus: 'paid', waivedAmount: '189999.75' });
});
test('fully paid, cancelled and overpaid bills preserve financial amounts', () => {
  for (const invoice of [bill({ payment_status: 'paid' }), bill({ payment_status: 'cancelled' }),
    bill({ paid_amount: '310000.00', payment_status: 'partial' }),
    bill({ paid_amount: '350000.00', payment_status: null })]) {
    expect(withdrawalAdjustment(invoice, '퇴원')).toBeNull();
    expect(pauseAdjustment(invoice, '2026-10-07')).toBeNull();
  }
});
test('pause prorates calendar days before the start and rounds down to 1,000 won', () => {
  expect(pauseAdjustment(bill(), '2026-10-07')).toMatchObject({ afterFinal: '60000.00',
    waivedAmount: '250000.00', paymentStatus: 'pending', details: { attended_days: 6, days_in_month: 31,
      original_final_amount: '310000.00', calculation: 'calendar_days_before_pause' } });
  expect(pauseAdjustment(bill({ year_month: '2028-02', final_amount: '100000.00' }), '2028-02-09'))
    .toMatchObject({ afterFinal: '27000.00', details: { attended_days: 8, days_in_month: 29 } });
});
test('first-day pause retains partial paid money and cancels unpaid bills without refund', () => {
  expect(pauseAdjustment(bill(), '2026-10-01')).toMatchObject({ action: 'cancel', afterFinal: '0.00',
    afterPaid: '0.00', paymentStatus: 'cancelled' });
  expect(pauseAdjustment(bill({ paid_amount: '90000.50', payment_status: 'partial' }), '2026-10-01'))
    .toMatchObject({ action: 'adjust', afterFinal: '90000.50', afterPaid: '90000.50', paymentStatus: 'paid' });
});
test('only the selected month monthly unpaid bills can be changed', () => {
  for (const overrides of [{ year_month: '2026-09' }, { payment_type: 'season' },
    { payment_type: 'product' }, { payment_status: 'paid' }, { payment_status: 'cancelled' }]) {
    expect(pauseAdjustment(bill(overrides), context.date)).toBeNull();
  }
  expect(pauseAdjustment(bill({ paid_amount: '90000.00', payment_status: 'overdue' }), context.date))
    .toMatchObject({ afterFinal: '90000.00', paymentStatus: 'paid' });
});
test('repeating a pause uses original basis and avoids a second proration or audit', () => {
  const first = pauseAdjustment(bill(), context.date);
  const persisted = bill({ final_amount: first.afterFinal, is_prorated: 1, proration_details: JSON.stringify(first.details) });
  expect(pauseAdjustment(persisted, context.date, context.date)).toBeNull();
  expect(pauseAdjustment(persisted, '2026-10-08', context.date, auditOf(first, context.date))).toMatchObject({ afterFinal: '70000.00',
    details: { original_final_amount: '310000.00' } });
});
test.each([
  ['2026-10-01', '2026-10-07', '0.00', '60000.00', 'pending'],
  ['2026-10-07', '2026-10-15', '90000.00', '140000.00', 'partial'],
  ['2026-10-15', '2026-10-07', '90000.00', '90000.00', 'paid'],
])('pause-owned closed bills reopen from the original basis %s -> %s', (oldDate, date, paid, final, status) => {
  const first = pauseAdjustment(bill({ paid_amount: paid, payment_status: paid === '0.00' ? 'pending' : 'partial' }), oldDate);
  const persisted = bill({ final_amount: first.afterFinal, paid_amount: first.afterPaid,
    payment_status: first.paymentStatus, is_prorated: 1, proration_details: first.details });
  expect(pauseAdjustment(persisted, date, oldDate, auditOf(first, oldDate)))
    .toMatchObject({ afterFinal: final, afterPaid: paid, paymentStatus: status,
      details: { original_final_amount: '310000.00' } });
});
test('manual cancellation, waiver, withdrawal and later full payment reject date-only correction', () => {
  const first = pauseAdjustment(bill(), context.date);
  const persisted = bill({ final_amount: first.afterFinal, is_prorated: 1, proration_details: first.details });
  for (const overrides of [{ final_amount: '30000.00' }, { payment_status: 'cancelled' },
    { paid_amount: '310000.00', payment_status: 'paid' }]) {
    expect(() => pauseAdjustment({ ...persisted, ...overrides }, '2026-10-15', context.date, auditOf(first, context.date)))
      .toThrow(/날짜만 자동 변경/);
  }
  expect(() => pauseAdjustment(persisted, '2026-10-15', context.date,
    { ...auditOf(first, context.date), reason: '퇴원 미납 정산' })).toThrow(/날짜만 자동 변경/);
  expect(pauseAdjustment({ ...persisted, final_amount: '30000.00' }, context.date, context.date,
    auditOf(first, context.date))).toBeNull();
});
test('correction fails closed for missing original amount, absent pause audit or legacy proration', () => {
  const first = pauseAdjustment(bill(), context.date);
  const persisted = bill({ final_amount: first.afterFinal, is_prorated: 1, proration_details: first.details });
  expect(() => pauseAdjustment(persisted, '2026-10-15', context.date)).toThrow(/정산 이력/);
  expect(() => pauseAdjustment({ ...persisted, proration_details: { ...first.details, original_final_amount: undefined } },
    '2026-10-15', context.date, auditOf(first, context.date))).toThrow(/원금/);
  expect(() => pauseAdjustment(bill({ is_prorated: 1 }), '2026-10-15', context.date)).toThrow(/원금/);
});
test.each(['2026-09-01', '2026-11-01'])('cross-month date correction %s validates real dates for atomic billing planning', date => {
  expect(validateContext({ ...context, date, previousDate: context.date }).date).toBe(date);
});
test('MySQL JSON key normalization does not turn the same pause into another adjustment', () => {
  const first = pauseAdjustment(bill(), context.date);
  const reversed = Object.fromEntries(Object.entries(first.details).reverse());
  expect(Object.keys(reversed)).not.toEqual(Object.keys(first.details));
  expect(pauseAdjustment(bill({ final_amount: first.afterFinal, is_prorated: 1,
    proration_details: JSON.stringify(reversed) }), context.date, context.date)).toBeNull();
  expect(pauseAdjustment(bill({ final_amount: first.afterFinal, is_prorated: 1,
    proration_details: reversed }), context.date, context.date)).toBeNull();
});
