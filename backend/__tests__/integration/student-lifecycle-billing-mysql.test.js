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
    await f.paca.query(`CREATE TABLE IF NOT EXISTS audit_logs (
      id INT NOT NULL AUTO_INCREMENT PRIMARY KEY, user_id INT NULL, user_email VARCHAR(255),
      user_role VARCHAR(50), action VARCHAR(100) NOT NULL, table_name VARCHAR(100) NOT NULL,
      record_id INT, old_values JSON, new_values JSON, ip_address VARCHAR(45), user_agent TEXT,
      created_at TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP)`);
    process.env.JWT_SECRET = crypto.randomBytes(48).toString('hex');
    for (const sql of fs.readFileSync(require.resolve('../../migrations/20260929_add_student_parent_phones.mysql'), 'utf8')
      .replace(/^--.*$/gm, '').split(';').filter(sql => sql.trim())) await f.paca.query(sql);
    // The fixture's legacy ledger has no AUTO_INCREMENT for bigint IDs.
    await f.paca.query('DROP TABLE IF EXISTS max_engine_payment_settlements');
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20261004_max_engine_payment_settlements.sql'), 'utf8'));
    const app = express(); app.use(express.json());
    const router = express.Router();
    require('../../routes/students/lifecycleBillingPreview')(router);
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
  test('verified legacy metadata preserves its amount and enables a later native date correction from the original basis', async () => {
    await f.paca.execute("UPDATE students SET status='paused',rest_start_date='2026-05-07',monthly_tuition=400000,discount_rate=0 WHERE id=101");
    await bill(101, { base_amount: '400000', final_amount: '77000', discount_amount: '0', additional_amount: '0', notes: null });
    const { normalize } = require('../../../docs/operations/lifecycle-billing-deploy-20261009/normalize-legacy-pause.cjs');
    const context = {academyId: 1, studentId: 101, userId: 1, paymentId: 101,
      date: '2026-05-07', originalAmount: 400000, currentAmount: 77000};
    const history = await financialHistory();
    const preview = await normalize(f.paca, context);
    expect(preview).toMatchObject({before: 77000, after: 77000, metadata_only: true});
    const conn = await f.paca.getConnection();
    try { await conn.beginTransaction(); await normalize(conn, context, preview.source_hash); await conn.commit(); }
    catch (error) { await conn.rollback(); throw error; } finally { conn.release(); }
    expect((await rows('student_payments'))[0].final_amount).toBe('77000.00');
    expect((await rows('max_engine_payment_settlements'))[0]).toMatchObject({before_final_amount: '77000.00', after_final_amount: '77000.00', waived_amount: '0.00'});
    const response = await request(server).put('/paca/students/101').auth(token, {type:'bearer'})
      .send({rest_start_date: '2026-05-10'});
    expect(response.status).toBe(200);
    expect((await rows('student_payments'))[0].final_amount).toBe('116000.00');
    expect(await financialHistory()).toEqual(history);
  });
  test.each(['withdraw', 'update'])('%s withdrawal uses the saved pause cutoff, preserves older and nonmonthly history and cancels future unpaid monthly bills', async route => {
    await f.paca.execute("UPDATE students SET status='paused',rest_start_date='2026-05-15' WHERE id=101");
    await bill(101); await bill(102, { paid_amount: '100000', payment_status: 'partial' });
    await bill(103, { paid_amount: '300000', payment_status: 'paid' });
    await bill(104, { base_amount: '100000', final_amount: '100000', payment_status: 'overdue' });
    await bill(105, { student_id: 90, academy_id: 2, final_amount: '99999' });
    await bill(106, { academy_id: 2, final_amount: '88888' });
    await bill(107, { year_month: '2026-06' }); await bill(108, { year_month: '2026-04' });
    await seasons(); await bill(201, { payment_type: 'season', season_id: 401, final_amount: '200000', paid_amount: '50000', payment_status: 'partial' });
    const before = await rows('student_payments'), oldSeasons = await rows('student_seasons'), history = await financialHistory();
    const response = await withdraw(route); expect(response.status).toBe(200);
    expect((await getStudent(101)).status).toBe('withdrawn');
    const after = await rows('student_payments'); expect(after).toHaveLength(before.length);
    expect(after.find(row => row.id === 101)).toMatchObject({ final_amount: '135000.00', paid_amount: '0.00', payment_status: 'pending' });
    expect(after.find(row => row.id === 102)).toMatchObject({ final_amount: '135000.00', paid_amount: '100000.00', payment_status: 'partial' });
    expect(after.find(row => row.id === 104)).toMatchObject({ final_amount: '45000.00', paid_amount: '0.00', payment_status: 'overdue' });
    expect(after.find(row => row.id === 107)).toMatchObject({ final_amount: '0.00', paid_amount: '0.00', payment_status: 'cancelled' });
    for (const id of [103, 105, 106, 108, 201]) expect(after.find(row => row.id === id)).toEqual(before.find(row => row.id === id));
    const ended = (await rows('student_seasons')).find(row => row.id === 301);
    expect(ended).toMatchObject({ is_cancelled: 1, cancellation_date: f.date, after_season_action: 'terminate', paid_amount: '50000.00' });
    expect((await rows('student_seasons')).find(row => row.id === 390)).toEqual(oldSeasons.find(row => row.id === 390));
    const audit = await rows('max_engine_payment_settlements'); expect(audit.map(row => row.payment_id).sort((a, b) => a - b)).toEqual([101, 102, 104, 107]);
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
    if (route === 'process-rest') expect(response.body.unpaidAdjustment).toMatchObject({ originalAmount: 1000000, adjustedAmount: 400000, paymentIds: [101, 102, 103] });
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
    if (route === 'process-rest') expect(response.body.unpaidAdjustment).toMatchObject({ action: 'adjusted', originalAmount: 1000000, adjustedAmount: 680000, paymentIds: [101, 102, 103] });
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
    expect(first.body.restCredit).toMatchObject({ id: credits[0].id, source_payment_id: 104, credit_amount: 165000 });
    const retry = await submit(); expect(retry.status).toBe(200);
    expect(retry.body.unpaidAdjustment).toMatchObject({ action: 'unchanged', paymentIds: [] });
    expect(retry.body.restCredit).toEqual(first.body.restCredit);
    expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual(audit);
    expect(await rows('rest_credits')).toEqual(credits);
  });
  test.each([false, true])('already paused date edits recalculate full bills without requiring status (explicit status=%s)', async includeStatus => {
    await f.paca.execute("UPDATE students SET status='paused',rest_start_date='2026-05-01' WHERE id=101");
    await bill(101); await bill(102, { paid_amount: '60000', payment_status: 'partial' });
    await bill(104, { paid_amount: '300000', payment_status: 'paid' });
    await bill(105, { final_amount: '0', payment_status: 'cancelled' });
    const history = await financialHistory(), original = await rows('student_payments');
    const edit = async date => {
      const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' })
        .send({ action: 'pause', date });
      expect(quote.status).toBe(200);
      return request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
        .send({ rest_start_date: date, billing_preview_hash: quote.body.preview_hash, ...(includeStatus ? { status: 'paused' } : {}) });
    };
    expect((await edit('2026-05-15')).status).toBe(200);
    let bills = await rows('student_payments');
    expect(bills.find(row => row.id === 101)).toMatchObject({ final_amount: '135000.00', payment_status: 'pending' });
    expect(bills.find(row => row.id === 102)).toMatchObject({ final_amount: '135000.00', paid_amount: '60000.00' });
    expect((await getStudent(101))).toMatchObject({ status: 'paused', rest_start_date: '2026-05-15' });
    expect((await edit('2026-05-20')).status).toBe(200);
    bills = await rows('student_payments');
    // Reuse the full 300,000 won basis; using the prior 135,000 won bill would undercharge.
    for (const id of [101, 102]) expect(bills.find(row => row.id === id).final_amount).toBe('183000.00');
    const audit = await rows('max_engine_payment_settlements'); expect(audit).toHaveLength(4);
    expect((await edit('2026-05-20')).status).toBe(200);
    expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual(audit);
    for (const id of [104, 105]) expect(bills.find(row => row.id === id)).toEqual(original.find(row => row.id === id));
    expect(await financialHistory()).toEqual(history);
  });
  test('same-month correction reopens only bills closed by the previous audited pause, retaining payment history', async () => {
    await bill(101); await bill(102, { paid_amount: '100000', payment_status: 'partial' });
    await bill(104, { paid_amount: '300000', payment_status: 'paid' });
    await bill(105, { final_amount: '0', payment_status: 'cancelled', notes: '원장 수동 취소' });
    const protectedBills = (await rows('student_payments')).filter(row => [104, 105].includes(row.id));
    const history = await financialHistory();
    expect((await pause('update', '2026-05-01')).status).toBe(200);
    expect((await rows('student_payments')).find(row => row.id === 101)).toMatchObject({ final_amount: '0.00', payment_status: 'cancelled' });
    expect((await rows('student_payments')).find(row => row.id === 102)).toMatchObject({ final_amount: '100000.00', payment_status: 'paid' });
    const response = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ rest_start_date: '2026-05-15' });
    expect(response.status).toBe(200);
    const bills = await rows('student_payments');
    expect(bills.find(row => row.id === 101)).toMatchObject({ final_amount: '135000.00', paid_amount: '0.00', payment_status: 'pending' });
    expect(bills.find(row => row.id === 102)).toMatchObject({ final_amount: '135000.00', paid_amount: '100000.00', payment_status: 'partial' });
    expect(bills.filter(row => [104, 105].includes(row.id))).toEqual(protectedBills);
    expect(await financialHistory()).toEqual(history);
  });
  test.each(['2026-04-15', '2026-06-15'])('moving the pause date to another month %s applies the authoritative range quote and preserves paid history', async date => {
    await pauseBills('200000'); expect((await pause('update', '2026-05-15')).status).toBe(200);
    const before = await rows('student_payments'), history = await financialHistory();
    const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' })
      .send({ action: 'pause', date });
    expect(quote.status).toBe(200);
    const response = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ rest_start_date: date, billing_preview_hash: quote.body.preview_hash });
    expect(response.status).toBe(200); expect((await getStudent(101)).rest_start_date).toBe(date);
    const after = await rows('student_payments');
    for (const row of quote.body.rows) expect(Number(after.find(item => item.id === row.payment_id).final_amount)).toBe(row.adjusted_amount);
    expect(after.find(row => row.id === (date.startsWith('2026-04') ? 108 : 107)).final_amount).toBe('140000.00');
    expect(after.find(row => row.id === 101).final_amount).toBe(date.startsWith('2026-04') ? '0.00' : '300000.00');
    expect(after.find(row => row.id === 102).paid_amount).toBe('200000.00');
    for (const id of [104, 105, 106, 109, 110]) expect(after.find(row => row.id === id)).toEqual(before.find(row => row.id === id));
    expect(await financialHistory()).toEqual(history);
  });
  test('an absent target-month invoice rejects a date edit without creating a guessed invoice or changing existing balances', async () => {
    await pauseBills('200000'); expect((await pause('update', '2026-05-15')).status).toBe(200);
    const student = await getStudent(101), bills = await rows('student_payments'), audits = await rows('max_engine_payment_settlements');
    const result = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ rest_start_date: '2026-07-15' });
    expect(result.status).toBe(409); expect(result.body.error).toBe('BILLING_MONTH_MISSING');
    expect(await getStudent(101)).toEqual(student); expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual(audits);
  });
  test('a legacy pause keeps one original amount through May10 to May20 to Jun05 to Jun08 to May25 and a duplicate retry', async () => {
    await bill(101); await bill(107, { year_month: '2026-06' });
    await bill(104, { paid_amount: '300000', payment_status: 'paid' });
    await bill(105, { final_amount: '0', payment_status: 'cancelled' });
    const protectedRows = (await rows('student_payments')).filter(row => [104, 105].includes(row.id));
    expect((await pause('update', '2026-05-10')).status).toBe(200);
    await f.paca.execute("UPDATE student_payments SET proration_details=JSON_REMOVE(proration_details,'$.session_origin_date') WHERE id=101");
    const edit = async date => {
      const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' }).send({ action: 'pause', date });
      expect(quote.status).toBe(200);
      const result = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
        .send({ rest_start_date: date, billing_preview_hash: quote.body.preview_hash });
      expect(result.status).toBe(200);
    };
    for (const [date, may, june] of [['2026-05-20', '183000.00', '300000.00'], ['2026-06-05', '300000.00', '40000.00'],
      ['2026-06-08', '300000.00', '70000.00'], ['2026-05-25', '232000.00', '0.00']]) {
      await edit(date); const stored = await rows('student_payments');
      expect(stored.find(row => row.id === 101).final_amount).toBe(may);
      expect(stored.find(row => row.id === 107).final_amount).toBe(june);
    }
    const bills = await rows('student_payments'), audits = await rows('max_engine_payment_settlements');
    await edit('2026-05-25'); expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual(audits);
    expect(bills.filter(row => [104, 105].includes(row.id))).toEqual(protectedRows);
  });
  test('a legacy prorated bill without its original amount blocks a date correction instead of prorating a guessed basis', async () => {
    await f.paca.execute("UPDATE students SET status='paused',rest_start_date='2026-05-15' WHERE id=101");
    await bill(101, { final_amount: '135000', is_prorated: 1, proration_details: '{"calculation":"legacy calendar","attended_days":14}' });
    const student = await getStudent(101), bills = await rows('student_payments');
    const response = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ rest_start_date: '2026-05-20' });
    expect(response.status).toBe(409);
    expect(await getStudent(101)).toEqual(student); expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual([]);
  });
  test.each(['carryover', 'refund'])('an existing positive %s credit blocks a date-only correction and preserves that credit', async creditType => {
    await pauseBills('200000');
    const first = await request(server).post('/paca/students/101/process-rest').auth(token, { type: 'bearer' })
      .send({ rest_start_date: '2026-05-15', rest_end_date: '2026-05-31', credit_type: creditType, source_payment_id: 104 });
    expect(first.status).toBe(200);
    const student = await getStudent(101), bills = await rows('student_payments'),
      audit = await rows('max_engine_payment_settlements'), credits = await rows('rest_credits');
    const response = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ rest_start_date: '2026-05-20' });
    expect(response.status).toBe(409); expect(response.body.error).toBe('PAUSE_BILLING_CONFLICT');
    expect(await getStudent(101)).toEqual(student); expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual(audit); expect(await rows('rest_credits')).toEqual(credits);
  });
  test('authoritative preview is read only and confirmed pause amounts match every displayed row', async () => {
    await pauseBills('200000');
    const student = await getStudent(101), before = await rows('student_payments'), history = await financialHistory();
    const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' })
      .send({ action: 'pause', date: '2026-05-15' });
    expect(quote.status).toBe(200); expect(quote.body).toMatchObject({ readonly: true, external_refund_executed: false, requires_confirmation: true });
    expect(quote.body.rows.find(row => row.payment_id === 101)).toMatchObject({ original_amount: 300000, adjusted_amount: 135000 });
    expect(quote.body.rows.find(row => row.payment_id === 102)).toMatchObject({ adjusted_amount: 200000, paid_amount: 200000 });
    for (const value of Object.values(quote.body.summary)) expect(typeof value).toBe('number');
    expect(await getStudent(101)).toEqual(student); expect(await rows('student_payments')).toEqual(before);
    expect(await rows('max_engine_payment_settlements')).toEqual([]);
    const applied = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ status: 'paused', rest_start_date: '2026-05-15', billing_preview_hash: quote.body.preview_hash });
    expect(applied.status).toBe(200); const after = await rows('student_payments');
    for (const row of quote.body.rows) {
      const stored = after.find(item => item.id === row.payment_id);
      expect(Number(stored.final_amount)).toBe(row.adjusted_amount); expect(Number(stored.paid_amount)).toBe(row.paid_amount);
    }
    expect(await financialHistory()).toEqual(history);
  });
  test('a changed paid balance makes an approved preview stale and rolls back the proposed student transition', async () => {
    await pauseBills('200000');
    const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' })
      .send({ action: 'pause', date: '2026-05-15' });
    expect(quote.status).toBe(200);
    await f.paca.execute("UPDATE student_payments SET paid_amount=10000,payment_status='partial' WHERE id=101");
    const student = await getStudent(101), bills = await rows('student_payments');
    const result = await request(server).put('/paca/students/101').auth(token, { type: 'bearer' })
      .send({ status: 'paused', rest_start_date: '2026-05-15', billing_preview_hash: quote.body.preview_hash });
    expect(result.status).toBe(409); expect(result.body.error).toBe('SOURCE_CHANGED');
    expect(await getStudent(101)).toEqual(student); expect(await rows('student_payments')).toEqual(bills);
    expect(await rows('max_engine_payment_settlements')).toEqual([]);
  });
  test('the dedicated rest confirmation stores the exact server credit quote without modifying income or executing refunds', async () => {
    await pauseBills('200000'); const history = await financialHistory();
    const body = { rest_start_date: '2026-05-15', rest_end_date: '2026-05-31', credit_type: 'carryover', source_payment_id: 104 };
    const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' })
      .send({ action: 'pause', date: body.rest_start_date, rest_end_date: body.rest_end_date,
        credit_type: body.credit_type, source_payment_id: body.source_payment_id });
    expect(quote.status).toBe(200); expect(quote.body.credit).toMatchObject({ credit_amount: 165000, remaining_amount: 165000, source_payment_id: 104 });
    expect(await rows('rest_credits')).toEqual([]);
    const result = await request(server).post('/paca/students/101/process-rest').auth(token, { type: 'bearer' })
      .send({ ...body, billing_preview_hash: quote.body.preview_hash });
    expect(result.status).toBe(200); expect(result.body.unpaidAdjustment.summary).toEqual(quote.body.summary);
    expect(result.body.restCredit).toMatchObject({ credit_amount: quote.body.credit.credit_amount,
      remaining_amount: quote.body.credit.remaining_amount, source_payment_id: 104, status: 'pending' });
    expect(await rows('rest_credits')).toHaveLength(1); expect(await financialHistory()).toEqual(history);
  });
  test('a legacy paid flag with explicit zero paid amount remains zero and cannot grant a guessed credit', async () => {
    await pauseBills('200000'); await f.paca.execute('UPDATE student_payments SET paid_amount=0 WHERE id=104');
    const quote = await request(server).post('/paca/students/101/lifecycle-billing-preview').auth(token, { type: 'bearer' })
      .send({ action: 'pause', date: '2026-05-15', rest_end_date: '2026-05-31', credit_type: 'carryover', source_payment_id: 104 });
    expect(quote.status).toBe(200); expect(quote.body.requires_payment_review).toBe(true);
    expect(quote.body.rows.find(row => row.payment_id === 104)).toMatchObject({ paid_amount: 0, outstanding_amount: 0, requires_payment_review: true });
    expect(quote.body.credit).toBeNull();
    const result = await request(server).post('/paca/students/101/process-rest').auth(token, { type: 'bearer' })
      .send({ rest_start_date: '2026-05-15', rest_end_date: '2026-05-31', credit_type: 'carryover',
        source_payment_id: 104, billing_preview_hash: quote.body.preview_hash });
    expect(result.status).toBe(200); expect(result.body.restCredit).toBeNull(); expect(await rows('rest_credits')).toEqual([]);
    expect((await rows('student_payments')).find(row => row.id === 104)).toMatchObject({ paid_amount: '0.00', final_amount: '300000.00', payment_status: 'paid' });
  });
  async function rejectSecondInvoice(action) {
    await f.paca.query(`CREATE TRIGGER synthetic_lifecycle_bill_failure BEFORE UPDATE ON student_payments FOR EACH ROW
      BEGIN IF NEW.id = 102 THEN SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic second bill failure'; END IF; END`);
    try { return await action(); }
    finally { await f.paca.query('DROP TRIGGER synthetic_lifecycle_bill_failure'); }
  }
  test('withdrawal failure after one invoice and audit were changed rolls back bills, student status and every audit row', async () => {
    await f.paca.execute("UPDATE students SET status='paused',rest_start_date='2026-05-15' WHERE id=101");
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
