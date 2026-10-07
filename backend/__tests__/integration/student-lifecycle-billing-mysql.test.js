/** Native student routes and actual auth against fixture-only loopback MySQL. */
jest.mock('../../config/database', () => global.__lifecycle.paca);
jest.mock('../../config/peak-database', () => global.__lifecycle.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn((...args) => {
  if (process.env.LIFECYCLE_NATIVE_DEBUG !== '1') return;
  process.stderr.write('[synthetic lifecycle fixture] ' + args.map(value => value && typeof value === 'object'
    ? JSON.stringify({ message: value.message, code: value.code, sql: value.sql, stack: value.stack }) : String(value)).join('\n') + '\n');
}) }));
const crypto = require('crypto');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('native withdrawal and both pause routes preserve financial history atomically', () => {
  let f, server, token;
  const original = { ...process.env };
  beforeAll(async () => {
    f = await fixture(); global.__lifecycle = f;
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    for (const sql of fs.readFileSync(require.resolve('../../migrations/20260929_add_student_parent_phones.mysql'), 'utf8')
      .replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await f.paca.query(sql);
    // The fixture's legacy ledger has no AUTO_INCREMENT for bigint IDs.
    await f.paca.query('DROP TABLE IF EXISTS max_engine_payment_settlements');
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20261004_max_engine_payment_settlements.sql'), 'utf8'));
    const app = express(); app.use(express.json());
    const router = express.Router();
    require('../../routes/students/enrollment')(router);
    require('../../routes/students/rest')(router);
    require('../../routes/students/crud/update')(router);
    app.use('/paca/students', router);
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    token = jwt.sign({ userId: 1 }, process.env.JWT_SECRET, { expiresIn: '1h' });
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await f?.close(); process.env = original;
  });
  const rows = async table => (await f.paca.query(`SELECT * FROM ${table} ORDER BY id`))[0];
  const getStudent = async id => (await f.paca.execute('SELECT * FROM students WHERE id=?', [id]))[0][0];
  const bill = (id, extra = {}) => f.insert('paca', 'student_payments', { id, student_id: 101, academy_id: 1,
    year_month: '2026-05', payment_type: 'monthly', base_amount: '300000', final_amount: '300000', paid_amount: '0',
    payment_status: 'pending', notes: '원본 메모', ...extra });
  const withdraw = route => route === 'withdraw'
    ? request(server).post('/paca/students/101/withdraw').auth(token, { type: 'bearer' }).send({ withdrawal_date: f.date, reason: '합성 퇴원' })
    : request(server).put('/paca/students/101').auth(token, { type: 'bearer' }).send({ status: 'withdrawn' });
  const pause = (route, date, id = 101) => route === 'update'
    ? request(server).put(`/paca/students/${id}`).auth(token, { type: 'bearer' }).send({ status: 'paused', rest_start_date: date })
    : request(server).post(`/paca/students/${id}/process-rest`).auth(token, { type: 'bearer' }).send({ rest_start_date: date, credit_type: 'none' });
  beforeEach(async () => {
    for (const table of ['student_payments', 'student_seasons', 'seasons', 'max_engine_payment_settlements', 'revenues', 'expenses', 'rest_credits']) {
      await f.paca.query(`DELETE FROM ${table}`);
    }
    await f.paca.query('DELETE FROM students WHERE id=101');
    await f.insert('paca', 'students', { id: 101, academy_id: 1, name: f.encrypt('합성 라이프사이클'),
      status: 'active', student_number: 'SYNTHETIC-101', student_type: 'exam', grade: '고3',
      monthly_tuition: '300000', class_days: '[]', weekly_count: 0, is_trial: 0 });
    await f.insert('paca', 'revenues', { id: 601, academy_id: 1, revenue_date: f.date, category: 'tuition',
      amount: '100000', student_id: 101, payment_id: 102, notes: '원본 납부 이력' });
    await f.insert('paca', 'expenses', { id: 701, academy_id: 1, expense_date: f.date, category: 'synthetic', amount: '12345' });
  });
  async function seasons() {
    for (const [id, academy_id] of [[401, 1], [402, 2]]) await f.insert('paca', 'seasons',
      { id, academy_id, season_name: `합성 시즌 ${id}`, season_start_date: '2026-05-01', season_end_date: '2026-12-31',
        non_season_end_date: '2026-04-30', status: 'active' });
    await f.insert('paca', 'student_seasons', { id: 301, student_id: 101, season_id: 401,
      season_fee: '200000', paid_amount: '50000', payment_status: 'partial', is_cancelled: 0 });
    await f.insert('paca', 'student_seasons', { id: 390, student_id: 101, season_id: 402,
      season_fee: '99999', paid_amount: '0', payment_status: 'pending', is_cancelled: 0 });
  }
  const financialHistory = async () => ({ revenues: await rows('revenues'), expenses: await rows('expenses') });
  test.each(['withdraw', 'update'])('%s withdrawal cancels unpaid bills, closes only outstanding balances and ends only owned seasons', async route => {
    await bill(101); await bill(102, { paid_amount: '100000', payment_status: 'partial' });
    await bill(103, { paid_amount: '300000', payment_status: 'paid' });
    await bill(104, { final_amount: '100000', payment_status: 'overdue' });
    await bill(105, { student_id: 90, academy_id: 2, final_amount: '99999' });
    await bill(106, { academy_id: 2, final_amount: '88888' });
    await seasons(); await bill(201, { payment_type: 'season', season_id: 401, final_amount: '200000', paid_amount: '50000', payment_status: 'partial' });
    const before = await rows('student_payments'), oldSeasons = await rows('student_seasons'), history = await financialHistory();
    const response = await withdraw(route); expect(response.status).toBe(200);
    expect((await getStudent(101)).status).toBe('withdrawn');
    const after = await rows('student_payments'); expect(after).toHaveLength(before.length);
    for (const id of [101, 104]) expect(after.find(row => row.id === id)).toMatchObject({ final_amount: '0.00', paid_amount: '0.00', payment_status: 'cancelled' });
    expect(after.find(row => row.id === 102)).toMatchObject({ final_amount: '100000.00', paid_amount: '100000.00', payment_status: 'paid' });
    expect(after.find(row => row.id === 201)).toMatchObject({ final_amount: '50000.00', paid_amount: '50000.00', payment_status: 'paid' });
    for (const id of [103, 105, 106]) expect(after.find(row => row.id === id)).toEqual(before.find(row => row.id === id));
    const ended = (await rows('student_seasons')).find(row => row.id === 301);
    expect(ended).toMatchObject({ is_cancelled: 1, cancellation_date: f.date, after_season_action: 'terminate', paid_amount: '50000.00' });
    expect((await rows('student_seasons')).find(row => row.id === 390)).toEqual(oldSeasons.find(row => row.id === 390));
    const audit = await rows('max_engine_payment_settlements'); expect(audit.map(row => row.payment_id).sort((a, b) => a - b)).toEqual([101, 102, 104, 201]);
    expect(audit.find(row => row.payment_id === 102)).toMatchObject({ academy_id: 1, student_id: 101,
      before_paid_amount: '100000.00', after_paid_amount: '100000.00', refund_amount: '0.00', recorded_by: 1 });
    expect(await financialHistory()).toEqual(history);
  });
  async function pauseBills(paid = '100000') {
    await bill(101); await bill(102, { paid_amount: paid, payment_status: 'partial' });
    await bill(103, { base_amount: '100000', final_amount: '100000', payment_status: 'overdue' });
    await bill(104, { paid_amount: '300000', payment_status: 'paid' });
    await bill(105, { payment_type: 'season', final_amount: '200000' });
    await bill(106, { payment_type: 'product', final_amount: '50000' });
    await bill(107, { year_month: '2026-06' }); await bill(108, { year_month: '2026-04' });
    await bill(109, { academy_id: 2 }); await bill(110, { student_id: 2 });
  }
  test.each(['update', 'process-rest'])('%s first-day pause cancels every unpaid monthly invoice while preserving paid balances and other scopes', async route => {
    await pauseBills();
    const before = await rows('student_payments'), history = await financialHistory();
    const response = await pause(route, '2026-05-01'); expect(response.status).toBe(200);
    expect((await getStudent(101)).status).toBe('paused');
    const after = await rows('student_payments'); expect(after).toHaveLength(before.length);
    for (const id of [101, 103]) expect(after.find(row => row.id === id)).toMatchObject({ final_amount: '0.00', paid_amount: '0.00', payment_status: 'cancelled' });
    expect(after.find(row => row.id === 102)).toMatchObject({ final_amount: '100000.00', paid_amount: '100000.00', payment_status: 'paid' });
    for (const row of before.filter(row => row.id >= 104)) expect(after.find(item => item.id === row.id)).toEqual(row);
    expect((await rows('max_engine_payment_settlements')).map(row => row.payment_id).sort((a, b) => a - b)).toEqual([101, 102, 103]);
    if (route === 'process-rest') expect(response.body.unpaidAdjustment).toMatchObject({ originalAmount: 700000, adjustedAmount: 100000, paymentIds: [101, 102, 103] });
    expect(await financialHistory()).toEqual(history);
  });
  test.each(['update', 'process-rest'])('%s midmonth pause prorates all monthly invoices and never lowers a bill below the amount already paid', async route => {
    await pauseBills('200000');
    const before = await rows('student_payments'), history = await financialHistory();
    const response = await pause(route, '2026-05-15'); expect(response.status).toBe(200);
    const after = await rows('student_payments'); expect(after).toHaveLength(before.length);
    expect(after.find(row => row.id === 101)).toMatchObject({ final_amount: '135000.00', paid_amount: '0.00', payment_status: 'pending' });
    expect(after.find(row => row.id === 102)).toMatchObject({ final_amount: '200000.00', paid_amount: '200000.00', payment_status: 'paid' });
    expect(after.find(row => row.id === 103)).toMatchObject({ final_amount: '45000.00', paid_amount: '0.00', payment_status: 'overdue' });
    for (const row of before.filter(row => row.id >= 104)) expect(after.find(item => item.id === row.id)).toEqual(row);
    expect((await rows('max_engine_payment_settlements')).map(row => row.payment_id).sort((a, b) => a - b)).toEqual([101, 102, 103]);
    if (route === 'process-rest') expect(response.body.unpaidAdjustment).toMatchObject({ action: 'adjusted', originalAmount: 700000, adjustedAmount: 380000, paymentIds: [101, 102, 103] });
    expect(await financialHistory()).toEqual(history);
  });
  test('retrying the same pause preserves MySQL-normalized proration, billing audit and the original rest credit', async () => {
    await pauseBills('200000');
    const body = { rest_start_date: '2026-05-15', rest_end_date: '2026-05-31', rest_reason: '합성 휴원',
      credit_type: 'carryover', source_payment_id: 104 };
    const submit = () => request(server).post('/paca/students/101/process-rest').auth(token, { type: 'bearer' }).send(body);
    const first = await submit(); expect(first.status).toBe(200);
    const bills = await rows('student_payments'), audit = await rows('max_engine_payment_settlements'), credits = await rows('rest_credits');
    expect(bills.find(row => row.id === 101)).toMatchObject({ final_amount: '135000.00', is_prorated: 1 });
    expect(audit).toHaveLength(3); expect(credits).toHaveLength(1);
    expect(first.body.restCredit).toMatchObject({ id: credits[0].id, source_payment_id: 104, credit_amount: 164000 });
    const retry = await submit(); expect(retry.status).toBe(200);
    expect(retry.body.unpaidAdjustment).toMatchObject({ action: 'unchanged', paymentIds: [] });
    expect(retry.body.restCredit).toEqual(first.body.restCredit);
    expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual(audit);
    expect(await rows('rest_credits')).toEqual(credits);
  });
  async function rejectSecondInvoice(action) {
    await f.paca.query(`CREATE TRIGGER synthetic_lifecycle_bill_failure BEFORE UPDATE ON student_payments FOR EACH ROW
      BEGIN IF NEW.id = 102 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic second bill failure'; END IF; END`);
    try { return await action(); }
    finally { await f.paca.query('DROP TRIGGER synthetic_lifecycle_bill_failure'); }
  }
  test('withdrawal failure after one invoice and audit were changed rolls back bills, student status and every audit row', async () => {
    await bill(101); await bill(102, { paid_amount: '100000', payment_status: 'partial' }); await seasons();
    const before = { student: await getStudent(101), bills: await rows('student_payments'), seasons: await rows('student_seasons') };
    const response = await rejectSecondInvoice(() => withdraw('withdraw')); expect(response.status).toBe(500);
    expect(await getStudent(101)).toEqual(before.student); expect(await rows('student_payments')).toEqual(before.bills);
    expect(await rows('student_seasons')).toEqual(before.seasons); expect(await rows('max_engine_payment_settlements')).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('synthetic second bill failure');
  });
  test.each(['update', 'process-rest'])('%s pause failure restores active status, prior invoices and audit rows', async route => {
    await pauseBills('200000'); const student = await getStudent(101), before = await rows('student_payments');
    const response = await rejectSecondInvoice(() => pause(route, '2026-05-15')); expect(response.status).toBe(500);
    expect(await getStudent(101)).toEqual(student); expect(await rows('student_payments')).toEqual(before);
    expect(await rows('max_engine_payment_settlements')).toEqual([]);
    expect(JSON.stringify(response.body)).not.toContain('synthetic second bill failure');
  });
  test.each(['withdraw', 'update', 'process-rest'])('%s forbids another academy student without mutating status or bills', async route => {
    await bill(105, { student_id: 90, academy_id: 2 }); const student = await getStudent(90), before = await rows('student_payments');
    const response = route === 'withdraw'
      ? await request(server).post('/paca/students/90/withdraw').auth(token, { type: 'bearer' }).send({ withdrawal_date: f.date })
      : await pause(route, '2026-05-15', 90);
    expect(response.status).toBe(404); expect(await getStudent(90)).toEqual(student);
    expect(await rows('student_payments')).toEqual(before); expect(await rows('max_engine_payment_settlements')).toEqual([]);
  });
  test.each(['update', 'process-rest'])('%s impossible pause date cannot persist a student state transition', async route => {
    const student = await getStudent(101); const response = await pause(route, '2026-02-30');
    expect(response.status).toBe(422); expect(await getStudent(101)).toEqual(student);
    expect(await rows('max_engine_payment_settlements')).toEqual([]);
  });
  test('normal native JWT authentication is required before withdrawal can touch a student', async () => {
    const student = await getStudent(101);
    expect((await request(server).post('/paca/students/101/withdraw').send({ withdrawal_date: f.date })).status).toBe(401);
    expect(await getStudent(101)).toEqual(student);
  });
});
