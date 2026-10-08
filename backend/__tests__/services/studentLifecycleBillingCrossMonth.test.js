jest.mock('../../config/database', () => ({ execute: jest.fn() }));
const { preview, pause } = require('../../services/studentLifecycleBillingService');
const { pauseAdjustment } = require('../../models/studentLifecycleBilling');
const context = { academyId: 2, studentId: 14, userId: 7, previousDate: '2026-10-07', date: '2026-12-07' };
const bill = (id, month, overrides = {}) => ({ id, academy_id: 2, student_id: 14, year_month: month,
  payment_type: 'monthly', base_amount: '310000.00', final_amount: '310000.00', paid_amount: '0.00',
  payment_status: 'pending', ...overrides });
function managed(id, month, date, paid = '0.00') {
  const change = pauseAdjustment(bill(id, month, { paid_amount: paid }), date);
  return { row: bill(id, month, { paid_amount: paid, final_amount: change.afterFinal,
    payment_status: change.paymentStatus, is_prorated: 1, proration_details: change.details }),
  audit: { id, payment_id: id, action: change.action, settlement_date: date, reason: change.reason,
    after_final_amount: change.afterFinal, after_paid_amount: change.afterPaid } };
}
const connection = (bills, audits) => ({ execute: jest.fn(async sql => {
  if (sql.includes('SELECT * FROM student_payments')) return [bills];
  if (sql.includes('SELECT a.* FROM max_engine_payment_settlements')) return [audits];
  if (sql.includes('FROM rest_credits')) return [[]];
  return [{ affectedRows: 1 }];
}) });

test('later start restores only verified old pause bills, retains full intermediate bills and prorates the new month', async () => {
  const old = managed(1, '2026-10', context.previousDate);
  const conn = connection([old.row, bill(2, '2026-11'), bill(3, '2026-12')], [old.audit]);
  const quote = await preview(conn, { ...context, action: 'pause' });
  expect(quote.rows.map(row => [row.payment_id, row.adjusted_amount, row.period_kind]))
    .toEqual([[1, 310000, 'restored'], [2, 310000, 'preserved'], [3, 60000, 'prorated']]);
  expect(quote.rows[0]).toMatchObject({ days_before: 31, days_month: 31 });
  expect(conn.execute.mock.calls.find(([sql]) => sql.includes('FROM student_payments'))[1])
    .toEqual([2, 14, '2026-10', '2026-12']);
  expect(conn.execute.mock.calls.find(([sql]) => sql.includes('FROM student_payments'))[0]).toMatch(/ORDER BY `year_month`, id/);
  const result = await pause(conn, { ...context, expectedPreviewHash: quote.preview_hash });
  expect(result.paymentIds).toEqual([1, 3]);
});
test('earlier start prorates the new month and cancels later existing monthly balances without reducing paid cash', async () => {
  const old = managed(3, '2026-12', '2026-12-07', '100000.00');
  const conn = connection([bill(1, '2026-10'), bill(2, '2026-11'), old.row], [old.audit]);
  const quote = await preview(conn, { ...context, previousDate: '2026-12-07', date: '2026-10-10', action: 'pause' });
  expect(quote.rows.map(row => [row.payment_id, row.adjusted_amount, row.period_kind]))
    .toEqual([[1, 90000, 'prorated'], [2, 0, 'pause_period'], [3, 100000, 'pause_period']]);
  expect(quote.rows[2]).toMatchObject({ paid_amount: 100000, days_before: 0, days_month: 31 });
});
test('missing month invoices are never created and a changed old-month source invalidates the whole quote', async () => {
  const old = managed(1, '2026-10', context.previousDate);
  const rows = [old.row]; const conn = connection(rows, [old.audit]);
  const options = { ...context, student: { status: 'paused', monthly_tuition: 0 }, action: 'pause' };
  const quote = await preview(conn, options);
  expect(quote.rows).toHaveLength(1);
  rows[0] = { ...old.row, paid_amount: '10000.00', payment_status: 'partial' };
  await expect(pause(conn, { ...options, expectedPreviewHash: quote.preview_hash })).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  expect(conn.execute.mock.calls.some(([sql]) => /^INSERT|^UPDATE|^DELETE/.test(sql))).toBe(false);
});
test('cross-month credit grants use only the new start month cash and reject old-month source selection', async () => {
  const old = bill(1, '2026-10', { paid_amount: '310000.00', payment_status: 'paid' });
  const conn = connection([old, bill(2, '2026-12')], []);
  const options = { ...context, action: 'pause', creditType: 'carryover', student: { monthly_tuition: 310000 } };
  expect((await preview(conn, options)).credit).toBeNull();
  await expect(preview(conn, { ...options, sourcePaymentId: 1 })).rejects.toMatchObject({ code: 'NOT_FOUND' });
});
test('a new pause after reactivation preserves old pause-closed bills and changes only fresh pending bills', async () => {
  const old = managed(1, '2026-10', '2026-10-01', '100000.00');
  const conn = connection([old.row, bill(2, '2026-10')], [old.audit]);
  const quote = await preview(conn, { ...context, previousDate: null, date: '2026-10-10', action: 'pause' });
  expect(quote.rows[0]).toMatchObject({ adjusted_amount: 100000, changed: false, period_kind: 'protected', refundable_amount: 0 });
  expect(quote.rows[1]).toMatchObject({ adjusted_amount: 90000, changed: true });
  expect(old.row.paid_amount).toBe('100000.00');
});
test('reactivated students preserve old managed pending bills and exclude their cash from a fresh pause credit', async () => {
  const old = managed(1, '2026-10', '2026-10-07', '10000.00');
  const conn = connection([old.row, bill(2, '2026-10')], [old.audit]);
  const quote = await preview(conn, { ...context, previousDate: null, date: '2026-10-01', action: 'pause',
    creditType: 'carryover', student: { status: 'active', monthly_tuition: 310000 } });
  expect(quote.rows[0]).toMatchObject({ adjusted_amount: 60000, changed: false, period_kind: 'protected', refundable_amount: 0 });
  expect(quote.rows[1]).toMatchObject({ adjusted_amount: 0, changed: true });
  expect(quote.credit).toBeNull();
});
test('missing target-month source blocks cross-month correction before restoration rather than inventing an invoice', async () => {
  const old = managed(1, '2026-10', context.previousDate);
  const conn = connection([old.row], [old.audit]);
  await expect(pause(conn, { ...context, student: { status: 'paused', monthly_tuition: 310000 } }))
    .rejects.toMatchObject({ status: 409, code: 'BILLING_MONTH_MISSING' });
  expect(conn.execute.mock.calls.some(([sql]) => /^INSERT|^UPDATE|^DELETE/.test(sql))).toBe(false);
});

test('same-month then cross-month corrections retain one verified legacy pause session across stale sibling dates', async () => {
  const rows = [bill(1, '2026-05'), bill(2, '2026-06')], audits = [];
  const apply = (row, change, date) => {
    audits.push({ id: audits.length + 1, payment_id: row.id, action: change.action, settlement_date: date,
      reason: change.reason, before_final_amount: change.beforeFinal, before_paid_amount: change.beforePaid,
      after_final_amount: change.afterFinal, after_paid_amount: change.afterPaid });
    Object.assign(row, { final_amount: change.afterFinal, payment_status: change.paymentStatus,
      is_prorated: 1, proration_details: change.details });
  };
  for (const row of rows) {
    const initial = pauseAdjustment(row, '2026-05-10', '2026-06-10');
    delete initial.details.session_origin_date;
    apply(row, initial, '2026-05-10');
  }
  const conn = { execute: jest.fn(async (sql, params) => {
    if (sql.includes('SELECT * FROM student_payments')) return [rows.filter(row =>
      row.year_month >= params[2] && row.year_month <= (params[3] || params[2]))];
    if (sql.includes('SELECT a.* FROM max_engine_payment_settlements')) return [audits.filter(row => params.slice(2).includes(row.payment_id))];
    if (sql.includes('FROM rest_credits')) return [[]];
    if (sql.startsWith('UPDATE student_payments')) {
      const row = rows.find(item => item.id === params[3]);
      Object.assign(row, { final_amount: params[0], payment_status: params[1],
        is_prorated: 1, proration_details: JSON.parse(params[2]) });
    }
    if (sql.startsWith('INSERT INTO max_engine_payment_settlements')) audits.push({ id: audits.length + 1,
      payment_id: params[2], action: params[3], settlement_date: params[4], before_final_amount: params[5],
      before_paid_amount: params[6], after_final_amount: params[7], after_paid_amount: params[8], reason: params[10] });
    return [{ affectedRows: 1 }];
  }) };
  const base = { academyId: 2, studentId: 14, userId: 7, student: { status: 'paused', monthly_tuition: 310000 } };
  let previousDate = '2026-05-10';
  for (const date of ['2026-05-20', '2026-06-05', '2026-06-08', '2026-05-25']) {
    const quote = await preview(conn, { ...base, previousDate, date, action: 'pause' });
    await pause(conn, { ...base, previousDate, date, expectedPreviewHash: quote.preview_hash });
    // A deployed legacy same-month edit has no explicit session marker; only its audits prove May 10.
    if (date === '2026-05-20') delete rows[0].proration_details.session_origin_date;
    previousDate = date;
  }
  expect(rows.map(row => [row.final_amount, row.paid_amount, row.proration_details.session_origin_date]))
    .toEqual([['240000.00', '0.00', '2026-05-10'], ['0.00', '0.00', '2026-05-10']]);
  const count = audits.length;
  await pause(conn, { ...base, previousDate, date: previousDate });
  expect(audits).toHaveLength(count);
});

test('a stale sibling from another pause session cannot be reopened during a date correction', async () => {
  const current = managed(1, '2026-05', '2026-05-20');
  const previous = pauseAdjustment(bill(2, '2026-06'), '2026-05-10', '2026-06-10');
  const stale = bill(2, '2026-06', { final_amount: previous.afterFinal, payment_status: previous.paymentStatus,
    is_prorated: 1, proration_details: previous.details });
  const conn = connection([current.row, stale], [current.audit, { id: 2, payment_id: 2,
    action: previous.action, settlement_date: '2026-05-10', reason: previous.reason,
    after_final_amount: previous.afterFinal, after_paid_amount: previous.afterPaid }]);
  await expect(pause(conn, { ...context, previousDate: '2026-05-20', date: '2026-06-05' }))
    .rejects.toMatchObject({ status: 409, code: 'PAUSE_BILLING_CONFLICT' });
  expect(conn.execute.mock.calls.some(([sql]) => /^INSERT|^UPDATE|^DELETE/.test(sql))).toBe(false);
});
