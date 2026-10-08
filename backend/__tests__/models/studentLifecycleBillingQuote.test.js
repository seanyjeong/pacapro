jest.mock('../../config/database', () => ({ execute: jest.fn() }));
const { creditPlan, quoteRows, paidCents } = require('../../models/studentLifecycleBillingQuote');
const { withdrawalAdjustment } = require('../../models/studentLifecycleBilling');
const context = { date: '2026-10-07', creditType: 'carryover', student: { monthly_tuition: '310000.00' } };
const invoice = overrides => ({ id: 1, year_month: '2026-10', payment_type: 'monthly', final_amount: '310000.00',
  base_amount: '310000.00', paid_amount: '120000.00', payment_status: 'partial', ...overrides });

test('credit grants only actual paid money left after earned calendar tuition', () => {
  expect(creditPlan(context, [invoice()], [])).toMatchObject({ credit_amount: 60000, remaining_amount: 60000,
    rest_days: 25, rest_start_date: '2026-10-07', rest_end_date: '2026-10-31' });
  expect(creditPlan(context, [invoice({ paid_amount: '310000.00', payment_status: 'paid' })], []))
    .toMatchObject({ credit_amount: 250000 });
  expect(creditPlan(context, [invoice({ paid_amount: '0.00' })], [])).toBeNull();
});
test('full-month credit uses original minus the once-rounded earned fee rather than rounding twice', () => {
  const row = invoice({ year_month: '2026-05', final_amount: '300000.00', base_amount: '300000.00',
    paid_amount: '300000.00', payment_status: 'paid' });
  const options = { date: '2026-05-15', creditType: 'carryover', student: { monthly_tuition: '300000.00' } };
  expect(creditPlan(options, [row], [])).toMatchObject({ credit_amount: 165000, rest_days: 17 });
  expect(quoteRows([row], [], options.date, 'pause')[0]).toMatchObject({ prorated_amount: 135000, refundable_amount: 165000 });
  expect(creditPlan(options, [row], [{ id: 4, credit_amount: 164000, remaining_amount: 164000,
    credit_type: 'carryover', rest_days: 17, rest_start_date: options.date, rest_end_date: '2026-05-31' }]))
    .toMatchObject({ existing: true, credit_amount: 164000, remaining_amount: 164000 });
});
test.each([null, '0.00'])('paid status with raw cash %s cannot invent a refund or credit', paid => {
  const row = invoice({ payment_status: 'paid', paid_amount: paid });
  expect(paidCents(row)).toBe(0);
  expect(creditPlan(context, [row], [])).toBeNull();
  expect(quoteRows([row], [], context.date, 'pause')[0]).toMatchObject({ paid_amount: 0,
    refundable_amount: 0, outstanding_amount: 0, requires_payment_review: true });
});
test('already granted credits reduce available cash and credit storage truncates fractional won', () => {
  expect(creditPlan(context, [invoice()], [], [{ credit_amount: '40000', source_payment_id: 1 }]))
    .toMatchObject({ credit_amount: 20000 });
  expect(creditPlan({ ...context, date: '2026-10-01' }, [invoice({ paid_amount: '100.25' })], []))
    .toMatchObject({ credit_amount: 100, remaining_amount: 100 });
});
test('credit quote uses UTC calendar dates and honors explicit month-end boundaries', () => {
  expect(creditPlan({ ...context, restEndDate: '2026-10-08' }, [invoice({ paid_amount: '310000.00' })], []))
    .toMatchObject({ credit_amount: 20000, rest_days: 2, rest_end_date: '2026-10-08' });
  expect(() => creditPlan({ ...context, restEndDate: '2026-10-06' }, [invoice()], [])).toThrow();
});
test('foreign payment ids fail and existing credits are reused without a new amount', () => {
  expect(() => creditPlan({ ...context, sourcePaymentId: 99 }, [invoice()], [])).toThrow();
  expect(creditPlan(context, [invoice()], [{ id: 9, credit_amount: 5000, remaining_amount: 1000,
    credit_type: 'carryover', rest_days: 25, rest_start_date: context.date, rest_end_date: '2026-10-31' }]))
    .toMatchObject({ id: 9, existing: true, credit_amount: 5000, remaining_amount: 1000 });
});
test('withdrawal preserves past and product bills, prorates current month and cancels future unpaid balance', () => {
  expect(withdrawalAdjustment(invoice({ year_month: '2026-09' }), '퇴원', context.date)).toBeNull();
  expect(withdrawalAdjustment(invoice({ payment_type: 'product' }), '퇴원', context.date)).toBeNull();
  expect(withdrawalAdjustment(invoice({ paid_amount: '0.00' }), '퇴원', context.date))
    .toMatchObject({ afterFinal: '60000.00', paymentStatus: 'pending' });
  expect(withdrawalAdjustment(invoice({ year_month: '2026-11' }), '퇴원', context.date))
    .toMatchObject({ afterFinal: '120000.00', afterPaid: '120000.00', paymentStatus: 'paid' });
});
test('a legacy reduced bill cannot be divided again without verified original history', () => {
  expect(() => withdrawalAdjustment(invoice({ final_amount: '77000.00', base_amount: '300000.00',
    paid_amount: '0.00', is_prorated: 0, proration_details: null }), '퇴원', context.date))
    .toThrow(/퇴원 전 원금/);
});
