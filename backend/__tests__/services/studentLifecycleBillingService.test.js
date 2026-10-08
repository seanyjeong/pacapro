jest.mock('../../config/database', () => ({ execute: jest.fn() }));
const repository = require('../../repositories/studentLifecycleBillingRepository');
const { withdraw, pause, preview } = require('../../services/studentLifecycleBillingService');
const { pauseAdjustment } = require('../../models/studentLifecycleBilling');
const context = { academyId: 2, studentId: 14, userId: 7, date: '2026-10-07', reason: '퇴원' };
const invoice = (id, overrides = {}) => ({ id, student_id: 14, academy_id: 2, payment_type: 'monthly',
  year_month: '2026-10', base_amount: '310000.00', discount_amount: '0.00', additional_amount: '0.00',
  final_amount: '310000.00', paid_amount: '0.00', payment_status: 'pending', ...overrides });
const connection = (bills, seasons = [], audits = [], credits = []) => ({ execute: jest.fn(async sql => {
  if (sql.includes('SELECT * FROM student_payments')) return [bills];
  if (sql.includes('SELECT ss.id')) return [seasons];
  if (sql.includes('SELECT a.* FROM max_engine_payment_settlements')) return [audits];
  if (sql.includes('FROM rest_credits')) return [credits];
  return [{ affectedRows: 1, insertId: 1 }];
}) });

test('withdrawal updates bills in place and records before/after with the actual actor without financial deletion', async () => {
  const conn = connection([invoice(21), invoice(22, { paid_amount: '120000.00', payment_status: 'partial' }),
    invoice(23, { paid_amount: '310000.00', payment_status: 'paid' })],
  [{ id: 3, season_id: 8, season_name: '합성 시즌', season_fee: '900000.00', payment_status: 'paid' }]);
  const result = await withdraw(conn, context);
  expect(result).toMatchObject({ cancelledPayments: 0, adjustedPayments: 2, waivedAmount: 440000,
    paymentIds: [21, 22], cancelledSeasons: [{ id: 3 }] });
  const audits = conn.execute.mock.calls.filter(([sql]) => sql.includes('INSERT INTO max_engine_payment_settlements'));
  expect(audits).toHaveLength(2);
  expect(audits[1][1]).toEqual([2, 14, 22, 'adjust', '2026-10-07', '310000.00', '120000.00',
    '120000.00', '120000.00', '190000.00', '퇴원', 7]);
  const seasonSql = conn.execute.mock.calls.find(([sql]) => sql.includes('UPDATE student_seasons'))[0];
  expect(seasonSql).toMatch(/s\.academy_id = \?/); expect(seasonSql).toMatch(/is_cancelled = 1/);
  expect(seasonSql).not.toMatch(/paid_amount\s*=|refund_amount\s*=|ss\.status/);
  for (const [sql] of conn.execute.mock.calls) expect(sql).not.toMatch(/DELETE|INSERT INTO (expenses|incomes|rest_credits)/);
});
test('same-month correction reopens a pause-cancelled bill with matched audit and preserves paid amount', async () => {
  const oldDate = '2026-10-01';
  const first = pauseAdjustment(invoice(21), oldDate);
  const prior = invoice(21, { final_amount: first.afterFinal, payment_status: first.paymentStatus,
    is_prorated: 1, proration_details: first.details });
  const audit = { payment_id: 21, action: first.action, settlement_date: oldDate, reason: first.reason,
    after_final_amount: first.afterFinal, after_paid_amount: first.afterPaid };
  const conn = connection([prior], [], [audit]);
  expect(await pause(conn, { ...context, previousDate: oldDate })).toMatchObject({ action: 'adjusted', adjustedAmount: 60000 });
  expect(conn.execute.mock.calls.filter(([sql]) => sql.includes('UPDATE student_payments'))[0][1])
    .toEqual(['60000.00', 'pending', expect.any(String), 21, 14, 2]);
  expect(conn.execute.mock.calls.filter(([sql]) => sql.includes('INSERT INTO max_engine_payment_settlements'))[0][1])
    .toEqual([2, 14, 21, 'adjust', context.date, '0.00', '0.00', '60000.00', '0.00', '0.00', expect.any(String), 7]);
});
test.each(['pending', 'partial', 'applied', 'refunded'])('a linked %s rest credit blocks date-only correction before any billing update', async status => {
  const conn = connection([], [], [], [{ id: 1, status, credit_amount: '250000.00', remaining_amount: '100000.00' }]);
  await expect(pause(conn, { ...context, previousDate: '2026-10-01' }))
    .rejects.toMatchObject({ status: 409, code: 'PAUSE_BILLING_CONFLICT' });
  expect(conn.execute.mock.calls.some(([sql]) => sql.includes('UPDATE student_payments'))).toBe(false);
});
test('cross-month correction with missing original amount produces no writes', async () => {
  const conn = connection([invoice(21, { is_prorated: 1 })]);
  await expect(pause(conn, { ...context, previousDate: '2026-09-01' })).rejects.toMatchObject({ status: 409 });
  expect(conn.execute.mock.calls.some(([sql]) => /^UPDATE|^INSERT|^DELETE/.test(sql))).toBe(false);
  await expect(pause(conn, { ...context, previousDate: context.date })).rejects.toMatchObject({ status: 409 });
  expect(conn.execute.mock.calls.some(([sql]) => /^UPDATE|^INSERT|^DELETE/.test(sql))).toBe(false);
});
test('a manual waiver after pause prevents committing a new date with unchanged billing', async () => {
  const first = pauseAdjustment(invoice(21), context.date);
  const prior = invoice(21, { final_amount: '30000.00', is_prorated: 1, proration_details: first.details });
  const audit = { payment_id: 21, action: first.action, settlement_date: context.date, reason: first.reason,
    after_final_amount: first.afterFinal, after_paid_amount: first.afterPaid };
  const conn = connection([prior], [], [audit]);
  await expect(pause(conn, { ...context, date: '2026-10-15', previousDate: context.date }))
    .rejects.toMatchObject({ status: 409, code: 'PAUSE_BILLING_CONFLICT' });
  expect(conn.execute.mock.calls.some(([sql]) => /^UPDATE|^INSERT|^DELETE/.test(sql))).toBe(false);
});
test('pause adjusts every selected monthly bill and persists proration metadata and audit atomically on caller connection', async () => {
  const conn = connection([invoice(21), invoice(22, { paid_amount: '90000.00', payment_status: 'partial' })]);
  const result = await pause(conn, context);
  expect(result).toMatchObject({ action: 'adjusted', originalAmount: 620000, adjustedAmount: 150000, paymentIds: [21, 22] });
  const selects = conn.execute.mock.calls[0];
  expect(selects[0]).toMatch(/payment_type = 'monthly'/); expect(selects[0]).toMatch(/FOR UPDATE/);
  expect(selects[0]).toContain('`year_month` = ?');
  expect(selects[1]).toEqual([2, 14, '2026-10']);
  const updates = conn.execute.mock.calls.filter(([sql]) => sql.includes('UPDATE student_payments'));
  expect(updates).toHaveLength(2);
  expect(updates[0][0]).toMatch(/is_prorated = 1/); expect(updates[0][0]).toMatch(/student_id = \? AND academy_id = \?/);
  expect(JSON.parse(updates[0][1][2])).toMatchObject({ type: 'student_pause', rest_start_date: '2026-10-07' });
  expect(updates[1][1]).toEqual(['90000.00', 'paid', expect.any(String), 22, 14, 2]);
  expect(conn.execute.mock.calls.filter(([sql]) => sql.includes('INSERT INTO max_engine_payment_settlements'))).toHaveLength(2);
});
test('first-day pause returns cancellation and an empty selection remains unchanged', async () => {
  expect(await pause(connection([invoice(21)]), { ...context, date: '2026-10-01' }))
    .toMatchObject({ action: 'cancelled', originalAmount: 310000, adjustedAmount: 0, paymentIds: [21] });
  expect(await pause(connection([]), context)).toMatchObject({ action: 'unchanged', paymentIds: [] });
});
test('invalid dates and actor ids fail before any query', async () => {
  const conn = connection([]);
  await expect(pause(conn, { ...context, date: '2026-02-30' })).rejects.toMatchObject({ status: 422 });
  await expect(withdraw(conn, { ...context, userId: 0 })).rejects.toMatchObject({ status: 422 });
  expect(conn.execute).not.toHaveBeenCalled();
});
test('audit and update failures propagate to the caller transaction without reporting success', async () => {
  const conn = connection([invoice(21)]);
  conn.execute.mockImplementation(async sql => {
    if (sql.includes('SELECT * FROM student_payments')) return [[invoice(21)]];
    if (sql.includes('INSERT INTO max_engine_payment_settlements')) throw new Error('synthetic audit failure');
    return [{ affectedRows: 1 }];
  });
  await expect(withdraw(conn, context)).rejects.toThrow('synthetic audit failure');
  conn.execute.mockImplementation(async sql => sql.includes('SELECT * FROM student_payments')
    ? [[invoice(21)]] : [{ affectedRows: 0 }]);
  await expect(pause(conn, context)).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
});
test('repository queries scope season locks and bill selection to the supplied academy and student', async () => {
  const conn = connection([]);
  await repository.withdrawalPayments(conn, context); await repository.endSeasons(conn, context);
  expect(conn.execute.mock.calls[0][1]).toEqual([2, 14]);
  expect(conn.execute.mock.calls[1][1]).toEqual([14, 2]);
  expect(conn.execute.mock.calls[1][0]).toMatch(/COALESCE\(ss\.is_cancelled,0\) = 0/);
});
test('preview selects without update locks or writes and confirmation uses exactly the quoted plan', async () => {
  const conn = connection([invoice(21)]);
  const quote = await preview(conn, { ...context, action: 'pause' });
  expect(quote).toMatchObject({ readonly: true, summary: { before_final_amount: 310000, adjusted_amount: 60000 } });
  expect(conn.execute.mock.calls.every(([sql]) => /^SELECT/.test(sql) && !sql.includes('FOR UPDATE'))).toBe(true);
  const result = await pause(conn, { ...context, expectedPreviewHash: quote.preview_hash });
  expect(result.summary).toEqual(quote.summary);
});
test('changed paid amount rejects the old preview before any financial write', async () => {
  const conn = connection([invoice(21)]);
  const quote = await preview(conn, { ...context, action: 'pause' });
  conn.execute.mockImplementation(async sql => sql.includes('SELECT * FROM student_payments')
    ? [[invoice(21, { paid_amount: '50000.00', payment_status: 'partial' })]] : [{ affectedRows: 1 }]);
  await expect(pause(conn, { ...context, expectedPreviewHash: quote.preview_hash })).rejects.toMatchObject({ code: 'SOURCE_CHANGED' });
  expect(conn.execute.mock.calls.some(([sql]) => /^UPDATE|^INSERT|^DELETE/.test(sql))).toBe(false);
});
test('a paused student withdrawal cuts billing at the earlier pause date and preserves past and nonmonthly fees', async () => {
  const conn = connection([invoice(21, { year_month: '2026-09', paid_amount: '0.00' }),
    invoice(22, { paid_amount: '0.00' }), invoice(23, { payment_type: 'product', paid_amount: '0.00' })]);
  const quote = await preview(conn, { ...context, action: 'withdraw', date: '2026-10-15',
    student: { status: 'paused', rest_start_date: context.date } });
  expect(quote.billing_cutoff_date).toBe('2026-10-07');
  expect(quote.rows.find(row => row.payment_id === 21)).toMatchObject({ adjusted_amount: 310000, changed: false });
  expect(quote.rows.find(row => row.payment_id === 22)).toMatchObject({ adjusted_amount: 60000, changed: true });
  expect(quote.rows.find(row => row.payment_id === 23)).toMatchObject({ adjusted_amount: 310000, changed: false });
});
test('graduation explicitly retains the existing unpaid waiver policy', async () => {
  expect(await withdraw(connection([invoice(21)]), { ...context, legacyGraduation: true }))
    .toMatchObject({ cancelledPayments: 1, adjustedPayments: 0, waivedAmount: 310000 });
});
