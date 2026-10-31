/** All writes use a dedicated disposable loopback MySQL; no production credentials. */
jest.mock('../../config/database', () => global.__monthly.paca);
jest.mock('../../config/peak-database', () => global.__monthly.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
// 스케줄러의 시즌 자동 졸업은 이 비교와 관계없다
jest.mock('../../services/seasonGraduationService', () => ({ graduateDueSeasonStudents: jest.fn() }));
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('MCP monthly_payment_create matches the 1st-of-month automatic bill', () => {
  let f, app, token, generateMonthlyPayments;
  // 스케줄러는 KST 이번 달 청구를 만든다
  const now = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit' }).format(new Date());
  beforeAll(async () => {
    f = await fixture(); global.__monthly = f;
    for (const file of ['20260927_max_engine_commands.sql', '20261001_add_season_aftercare.mysql']) {
      const sql = fs.readFileSync(require.resolve('../../migrations/' + file), 'utf8');
      for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await f.paca.query(statement);
    }
    await f.paca.query('ALTER TABLE student_payments MODIFY paid_amount DECIMAL(10,2) DEFAULT 0, MODIFY carryover_amount DECIMAL(10,2) DEFAULT 0, MODIFY discount_amount DECIMAL(10,2) DEFAULT 0, MODIFY additional_amount DECIMAL(10,2) DEFAULT 0');
    ({ generateMonthlyPayments } = require('../../scheduler/paymentScheduler'));
    app = express(); app.use(express.json());
    app.use('/full', require('../../routes/integrations/full'));
    const response = await request(app).post('/full/token').send({ email: 'a@example.invalid', password: 'synthetic' });
    expect(response.status).toBe(200); token = response.body.access_token;
  });
  // The command ledger is not a fixture table; leave it empty for the next suite.
  afterAll(async () => { await f?.paca.query('DELETE FROM max_engine_commands'); await f?.close(); });
  async function reset({ student = {}, credit = null } = {}) {
    for (const table of ['max_engine_commands', 'student_payments', 'rest_credits']) await f.paca.query(`DELETE FROM ${table}`);
    await f.paca.query("UPDATE students SET status=?,monthly_tuition=?,discount_rate=10,payment_due_day=?,class_days='[2,4]',enrollment_date=?,deleted_at=NULL WHERE id=4",
      [student.status || 'active', student.monthly_tuition ?? 315500, student.payment_due_day ?? 7, student.enrollment_date || '2026-01-02']);
    if (credit) await f.insert('paca', 'rest_credits', { id: 40, student_id: 4, academy_id: 1, credit_amount: 80000, remaining_amount: credit, credit_type: 'carryover', status: 'pending', created_at: '2026-01-01 00:00:00' });
  }
  const post = (path, body) => request(app).post('/full/paca/' + path).auth(token, { type: 'bearer' }).send(body);
  const preview = changes => post('preview', { operation: 'monthly_payment_create', changes });
  const confirm = p => post('confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true });
  const outcome = async () => ({
    bills: (await f.paca.query('SELECT student_id,academy_id,`year_month`,payment_type,base_amount,discount_amount,additional_amount,carryover_amount,(rest_credit_id IS NOT NULL) AS credited,final_amount,due_date,payment_status,description,notes FROM student_payments WHERE student_id=4'))[0],
    credits: (await f.paca.query('SELECT id,remaining_amount,status,applied_to_payment_id,(processed_at IS NOT NULL) AS processed FROM rest_credits'))[0] });

  test.each([['no credit', null], ['credit smaller than the bill', '50000.00'], ['credit larger than the bill', '900000.00']])('same bill and credit as the scheduler (%s)', async (_name, credit) => {
    await reset({ credit });
    await generateMonthlyPayments();
    const expected = await outcome();
    expect(expected.bills).toHaveLength(1);
    await reset({ credit });
    const p = await preview({ student_id: 4, year_month: now });
    expect(p.body.error).toBeUndefined(); expect(p.status).toBe(200);
    expect(p.body.after).toMatchObject({ final_amount: Number(expected.bills[0].final_amount), due_date: expected.bills[0].due_date });
    expect((await outcome()).bills).toEqual([]);
    const c = await confirm(p.body); expect(c.status).toBe(200);
    expect((await confirm(p.body)).body).toEqual(c.body);
    expect(await outcome()).toEqual(expected);
    const [[{ recorded_by }]] = await f.paca.query('SELECT recorded_by FROM student_payments WHERE id=?', [c.body.resource_id]);
    expect(recorded_by).toBe(1);
  });
  test('rejects existing, paused, zero-tuition, pre-enrollment and foreign students with reasons; stale preview fails', async () => {
    await reset({ credit: '50000.00' });
    const p = await preview({ student_id: 4, year_month: now });
    await f.paca.query("UPDATE rest_credits SET remaining_amount=10000 WHERE id=40");
    expect((await confirm(p.body)).status).toBe(409);
    await f.insert('paca', 'student_payments', { student_id: 4, academy_id: 1, year_month: now, payment_type: 'monthly', base_amount: 1, final_amount: 1, paid_amount: 0, due_date: now + '-05', payment_status: 'cancelled' });
    const code = async changes => (await preview(changes)).body.error?.code;
    expect(await code({ student_id: 4, year_month: now })).toBe('PAYMENT_EXISTS');
    await reset({ student: { status: 'paused' } });
    expect(await code({ student_id: 4, year_month: now })).toBe('STUDENT_STATUS_CONFLICT');
    await reset({ student: { monthly_tuition: 0 } });
    expect(await code({ student_id: 4, year_month: now })).toBe('STUDENT_STATUS_CONFLICT');
    await reset({ student: { enrollment_date: '2099-03-02' } });
    expect(await code({ student_id: 4, year_month: '2099-02' })).toBe('STUDENT_DATE_RANGE');
    expect(await code({ student_id: 90, year_month: now })).toBe('STUDENT_STATUS_CONFLICT');
    expect((await outcome()).bills).toEqual([]);
  });
});
