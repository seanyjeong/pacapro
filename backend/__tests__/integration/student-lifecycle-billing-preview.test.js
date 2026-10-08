/** Real native auth, Express JSON, controller and financial plan; no sockets or external DB. */
jest.mock('../../config/database', () => ({
  getConnection: (...args) => global.__billingPreview.pool.getConnection(...args),
  execute: (...args) => global.__billingPreview.pool.execute(...args),
  query: (...args) => global.__billingPreview.pool.query(...args),
}));
jest.mock('../../config/peak-database', () => ({}));
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../utils/auditLogger', () => ({ logAudit: jest.fn(), getAuditInfoFromReq: jest.fn(() => ({})) }));
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const express = require('express');
const { fixture } = require('./lifecycle-billing-memory-fixture');
const { sendJson } = require('../helpers/requestWithoutSocket');

describe('authoritative lifecycle quote and confirmation through the native HTTP stack', () => {
  let f, app, token;
  const original = { ...process.env };
  beforeAll(() => {
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    token = jwt.sign({ userId: 100 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });
  beforeEach(() => {
    f = fixture(); global.__billingPreview = f;
    app = express(); app.use(express.json());
    const router = express.Router();
    require('../../routes/students/lifecycleBillingPreview')(router);
    require('../../routes/students/crud/update')(router);
    require('../../routes/students/enrollment/withdraw')(router);
    require('../../routes/students/rest')(router);
    app.use('/paca/students', router);
  });
  afterAll(() => { process.env = original; });
  const call = (method, path, body, authenticated = true) => sendJson(app, method, '/paca/students' + path, body,
    authenticated ? { authorization: `Bearer ${token}` } : {});
  const preview = (action = 'pause', date = '2026-05-15') => call('POST', '/101/lifecycle-billing-preview', { action, date });
  const confirmPause = hash => call('PUT', '/101', { rest_start_date: '2026-05-15', billing_preview_hash: hash });
  const writes = () => f.conn.execute.mock.calls.filter(([sql]) => /^\s*(INSERT|UPDATE|DELETE)\b/i.test(sql));
  test('quote reads actual bill sources, performs no writes and returns numeric server amounts with paid floors', async () => {
    const before = f.snapshot(); const response = await preview(); expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ action: 'pause', date: '2026-05-15', year_month: '2026-05',
      student_id: 101, days_before: 14, days_month: 31, readonly: true, requires_confirmation: true, external_refund_executed: false });
    expect(response.body.preview_hash).toMatch(/^[a-f0-9]{64}$/);
    expect(response.body.rows.find(row => row.payment_id === 701)).toMatchObject({ original_amount: 300000,
      prorated_amount: 135000, adjusted_amount: 135000, paid_amount: 0, outstanding_amount: 135000 });
    expect(response.body.rows.find(row => row.payment_id === 702)).toMatchObject({ original_amount: 300000,
      prorated_amount: 135000, adjusted_amount: 200000, paid_amount: 200000, outstanding_amount: 0 });
    for (const value of Object.values(response.body.summary)) expect(typeof value).toBe('number');
    expect(writes()).toEqual([]); expect(f.snapshot()).toEqual(before);
    expect(f.conn.execute.mock.calls.some(([sql]) => /FOR UPDATE/.test(sql))).toBe(false);
    expect(f.conn.release).toHaveBeenCalledTimes(1);
  });
  test('confirm persists exactly the quoted amounts and keeps existing receipts, paid bills and manual cancellations', async () => {
    const before = f.snapshot(); const proposal = await preview(); expect(proposal.status).toBe(200);
    const response = await confirmPause(proposal.body.preview_hash); expect(response.status).toBe(200);
    for (const row of proposal.body.rows) {
      const bill = f.data.bills.find(item => item.id === row.payment_id);
      expect(Number(bill.final_amount)).toBe(row.adjusted_amount); expect(Number(bill.paid_amount)).toBe(row.paid_amount);
    }
    expect(f.data.bills.find(row => row.id === 701).final_amount).toBe('135000.00');
    expect(f.data.bills.find(row => row.id === 702)).toMatchObject({ final_amount: '200000.00', paid_amount: '200000.00', payment_status: 'paid' });
    for (const id of [703, 704]) expect(f.data.bills.find(row => row.id === id)).toEqual(before.bills.find(row => row.id === id));
    expect(f.data.revenues).toEqual(before.revenues); expect(f.data.expenses).toEqual(before.expenses);
    expect(f.data.audits).toHaveLength(2); expect(f.data.audits.every(row => row.refund_amount === '0.00' && row.expense_id === null)).toBe(true);
    expect(writes().some(([sql]) => /INSERT INTO (expenses|revenues|toss)/i.test(sql))).toBe(false);
  });
  test('a payment source change invalidates the approved quote and rolls back the edited pause date', async () => {
    const proposal = await preview(); expect(proposal.status).toBe(200);
    f.data.bills[0].paid_amount = '10000.00'; f.data.bills[0].payment_status = 'partial';
    const before = f.snapshot(); const response = await confirmPause(proposal.body.preview_hash);
    expect(response.status).toBe(409); expect(response.body.error).toBe('SOURCE_CHANGED');
    expect(f.snapshot()).toEqual(before); expect(f.data.audits).toEqual([]);
  });
  test('date corrections reuse the original quoted basis and a newly quoted same-date retry adds no financial audit', async () => {
    const first = await preview(); expect(first.status).toBe(200); expect((await confirmPause(first.body.preview_hash)).status).toBe(200);
    const next = await preview('pause', '2026-05-20'); expect(next.status).toBe(200);
    expect(next.body.rows.find(row => row.payment_id === 701)).toMatchObject({ original_amount: 300000, adjusted_amount: 183000 });
    expect((await call('PUT', '/101', { rest_start_date: '2026-05-20', billing_preview_hash: next.body.preview_hash })).status).toBe(200);
    const bills = f.snapshot().bills, audits = f.snapshot().audits;
    const retry = await preview('pause', '2026-05-20'); expect(retry.status).toBe(200);
    expect((await call('PUT', '/101', { rest_start_date: '2026-05-20', billing_preview_hash: retry.body.preview_hash })).status).toBe(200);
    expect(f.data.bills).toEqual(bills); expect(f.data.audits).toEqual(audits);
  });
  test('quote enforces native authentication and academy-scoped student reads', async () => {
    expect((await call('POST', '/101/lifecycle-billing-preview', { action: 'pause', date: '2026-05-15' }, false)).status).toBe(401);
    expect((await call('POST', '/999/lifecycle-billing-preview', { action: 'pause', date: '2026-05-15' })).status).toBe(404);
    expect(writes()).toEqual([]);
  });
  test('withdrawal quote and confirmation use the earlier pause cutoff and preserve past, paid and nonmonthly financial history', async () => {
    f.data.student.rest_start_date = '2026-05-15';
    const base = f.data.bills[0];
    f.data.bills.push({ ...base, id: 705, year_month: '2026-06', notes: '미래 월 청구' },
      { ...base, id: 706, year_month: '2026-04', notes: '과거 월 청구' },
      { ...base, id: 707, payment_type: 'season', season_id: 401, final_amount: '900000.00', paid_amount: '300000.00', payment_status: 'partial' });
    f.data.seasons.push({ id: 301, season_id: 401, season_name: '합성 시즌', season_fee: '900000.00',
      paid_amount: '300000.00', payment_status: 'partial', is_cancelled: 0 });
    const before = f.snapshot(); const quote = await preview('withdraw', '2026-06-15'); expect(quote.status).toBe(200);
    expect(quote.body.billing_cutoff_date).toBe('2026-05-15');
    expect(quote.body.rows.find(row => row.payment_id === 701).adjusted_amount).toBe(135000);
    expect(quote.body.rows.find(row => row.payment_id === 705).adjusted_amount).toBe(0);
    expect(quote.body.rows.find(row => row.payment_id === 706).adjusted_amount).toBe(300000);
    expect(quote.body.rows.find(row => row.payment_id === 707).adjusted_amount).toBe(900000);
    expect(f.snapshot()).toEqual(before); expect(writes()).toEqual([]);
    const result = await call('POST', '/101/withdraw', { withdrawal_date: '2026-06-15', reason: '합성 퇴원', billing_preview_hash: quote.body.preview_hash });
    expect(result.status).toBe(200); expect(result.body.billing.summary).toEqual(quote.body.summary);
    for (const row of quote.body.rows) expect(Number(f.data.bills.find(bill => bill.id === row.payment_id).final_amount)).toBe(row.adjusted_amount);
    for (const id of [703, 704, 706, 707]) expect(f.data.bills.find(row => row.id === id)).toEqual(before.bills.find(row => row.id === id));
    expect(f.data.seasons[0]).toMatchObject({ is_cancelled: 1, paid_amount: '300000.00', payment_status: 'partial' });
    expect(f.data.revenues).toEqual(before.revenues); expect(f.data.expenses).toEqual(before.expenses);
  });
  test('the dedicated rest route stores exactly the authoritative credit quote and reuses it on a same-date retry', async () => {
    f.data.student.status = 'active'; f.data.student.rest_start_date = null;
    const body = { rest_start_date: '2026-05-15', rest_end_date: '2026-05-31', credit_type: 'carryover', source_payment_id: 703 };
    const getQuote = () => call('POST', '/101/lifecycle-billing-preview', { action: 'pause', date: body.rest_start_date,
      rest_end_date: body.rest_end_date, credit_type: body.credit_type, source_payment_id: body.source_payment_id });
    const proposal = await getQuote(); expect(proposal.status).toBe(200);
    expect(proposal.body.credit).toMatchObject({ existing: false, credit_amount: 165000, remaining_amount: 165000, source_payment_id: 703 });
    const result = await call('POST', '/101/process-rest', { ...body, billing_preview_hash: proposal.body.preview_hash });
    expect(result.status).toBe(200); expect(result.body.unpaidAdjustment.summary).toEqual(proposal.body.summary);
    expect(result.body.restCredit).toMatchObject({ credit_amount: proposal.body.credit.credit_amount, remaining_amount: proposal.body.credit.remaining_amount, source_payment_id: 703 });
    expect(f.data.credits).toHaveLength(1); const credits = f.snapshot().credits, audits = f.snapshot().audits;
    const retryQuote = await getQuote(); expect(retryQuote.status).toBe(200); expect(retryQuote.body.credit.existing).toBe(true);
    expect((await call('POST', '/101/process-rest', { ...body, billing_preview_hash: retryQuote.body.preview_hash })).status).toBe(200);
    expect(f.data.credits).toEqual(credits); expect(f.data.audits).toEqual(audits);
  });
  test('the dedicated route rejects stale credit sources before storing any new credit or bill changes', async () => {
    f.data.student.status = 'active'; f.data.student.rest_start_date = null;
    const proposal = await call('POST', '/101/lifecycle-billing-preview', { action: 'pause', date: '2026-05-15',
      rest_end_date: '2026-05-31', credit_type: 'carryover', source_payment_id: 703 });
    expect(proposal.status).toBe(200);
    f.data.bills.find(row => row.id === 703).paid_amount = '100000.00';
    const before = f.snapshot();
    const result = await call('POST', '/101/process-rest', { rest_start_date: '2026-05-15', rest_end_date: '2026-05-31',
      credit_type: 'carryover', source_payment_id: 703, billing_preview_hash: proposal.body.preview_hash });
    expect(result.status).toBe(409); expect(result.body.error).toBe('SOURCE_CHANGED'); expect(f.snapshot()).toEqual(before);
  });
  test('legacy paid status with a recorded zero payment requires review and cannot manufacture a positive credit', async () => {
    f.data.student.status = 'active'; f.data.student.rest_start_date = null;
    f.data.bills.find(row => row.id === 703).paid_amount = '0.00';
    const quote = await call('POST', '/101/lifecycle-billing-preview', { action: 'pause', date: '2026-05-15',
      rest_end_date: '2026-05-31', credit_type: 'carryover', source_payment_id: 703 });
    expect(quote.status).toBe(200); expect(quote.body.requires_payment_review).toBe(true);
    expect(quote.body.rows.find(row => row.payment_id === 703)).toMatchObject({ paid_amount: 0, outstanding_amount: 0, requires_payment_review: true });
    expect(quote.body.credit).toBeNull();
    const result = await call('POST', '/101/process-rest', { rest_start_date: '2026-05-15', rest_end_date: '2026-05-31',
      credit_type: 'carryover', source_payment_id: 703, billing_preview_hash: quote.body.preview_hash });
    expect(result.status).toBe(200); expect(result.body.restCredit).toBeNull(); expect(f.data.credits).toEqual([]);
    expect(f.data.bills.find(row => row.id === 703)).toMatchObject({ paid_amount: '0.00', final_amount: '300000.00', payment_status: 'paid' });
  });
  test('legacy audit provenance preserves one original amount through repeated month changes and a same-date retry', async () => {
    f.data.student.status = 'active'; f.data.student.rest_start_date = null;
    f.data.bills.push({ ...f.data.bills[0], id: 705, year_month: '2026-06', notes: '합성 6월 청구' });
    const first = await preview('pause', '2026-05-10'); expect(first.status).toBe(200);
    expect((await call('PUT', '/101', { status: 'paused', rest_start_date: '2026-05-10', billing_preview_hash: first.body.preview_hash })).status).toBe(200);
    for (const row of f.data.bills.filter(row => row.proration_details)) delete row.proration_details.session_origin_date;
    for (const [date, may, june] of [['2026-05-20', 183000, 300000], ['2026-06-05', 300000, 40000],
      ['2026-06-08', 300000, 70000], ['2026-05-25', 232000, 0]]) {
      const quote = await preview('pause', date); expect(quote.status).toBe(200);
      expect((await call('PUT', '/101', { rest_start_date: date, billing_preview_hash: quote.body.preview_hash })).status).toBe(200);
      expect(Number(f.data.bills.find(row => row.id === 701).final_amount)).toBe(may);
      expect(Number(f.data.bills.find(row => row.id === 705).final_amount)).toBe(june);
    }
    const before = f.snapshot(); const sameDate = await preview('pause', '2026-05-25'); expect(sameDate.status).toBe(200);
    expect((await call('PUT', '/101', { rest_start_date: '2026-05-25', billing_preview_hash: sameDate.body.preview_hash })).status).toBe(200);
    expect(f.data.bills).toEqual(before.bills); expect(f.data.audits).toEqual(before.audits);
  });
  test('a missing target-month bill rejects the real financial plan and restores the saved pause date', async () => {
    const proposal = await preview(); expect(proposal.status).toBe(200); expect((await confirmPause(proposal.body.preview_hash)).status).toBe(200);
    const before = f.snapshot(); const result = await call('PUT', '/101', { rest_start_date: '2026-07-15' });
    expect(result.status).toBe(409); expect(result.body.error).toBe('BILLING_MONTH_MISSING');
    expect(f.snapshot()).toEqual(before);
  });
});
