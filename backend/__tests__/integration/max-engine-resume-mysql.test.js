/** All writes use a dedicated disposable loopback MySQL; no production credentials. */
jest.mock('../../config/database', () => global.__resume.paca);
jest.mock('../../config/peak-database', () => global.__resume.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
jest.mock('../../middleware/auth', () => ({
  verifyToken: (req, _res, next) => { req.user = { academyId: 1, userId: 1 }; next(); },
  checkPermission: () => (_req, _res, next) => next(),
}));
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('MCP paused student resume parity and confirmation', () => {
  let f, app, token, other;
  beforeAll(async () => {
    f = await fixture(); global.__resume = f;
    for (const file of ['20260927_max_engine_commands.sql', '20261001_add_season_aftercare.mysql']) {
      const sql = fs.readFileSync(require.resolve('../../migrations/' + file), 'utf8');
      for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await f.paca.query(statement);
    }
    await f.paca.query('ALTER TABLE student_payments MODIFY paid_amount DECIMAL(10,2) DEFAULT 0, MODIFY carryover_amount DECIMAL(10,2) DEFAULT 0');
    app = express(); app.use(express.json());
    app.use('/full', require('../../routes/integrations/full'));
    app.use('/paca/integrations/max-engine/full', require('../../routes/integrations/full'));
    const router = express.Router(); require('../../routes/students/rest/resume')(router); app.use('/students', router);
    for (const email of ['a@example.invalid', 'b@example.invalid']) {
      const response = await request(app).post('/full/token').send({ email, password: 'synthetic' });
      expect(response.status).toBe(200);
      if (email[0] === 'a') token = response.body.access_token; else other = response.body.access_token;
    }
  });
  afterAll(async () => { await f?.close(); });
  async function reset({ final = 100000, paid = 0, credit = false, used = 0, tuition = 310000 } = {}) {
    for (const table of ['max_engine_commands', 'rest_credits', 'student_seasons', 'seasons']) await f.paca.query(`DELETE FROM ${table}`);
    await f.paca.query('DELETE FROM attendance WHERE student_id=8');
    await f.paca.query("DELETE FROM class_schedules WHERE class_date BETWEEN '2099-10-01' AND '2099-11-30'");
    await f.paca.query('DELETE FROM student_payments WHERE student_id=8');
    await f.paca.query("UPDATE students SET status='paused',is_trial=0,trial_remaining=0,monthly_tuition=?,discount_rate=0,class_days='[1,5]',time_slot='evening',rest_start_date='2099-10-11',rest_end_date=NULL,rest_reason='synthetic',deleted_at=NULL WHERE id=8", [tuition]);
    if (final !== null) await f.insert('paca', 'student_payments', { id: 800, student_id: 8, academy_id: 1, year_month: '2099-10', payment_type: 'monthly', base_amount: tuition,
      discount_amount: 0, additional_amount: 0, carryover_amount: 0, final_amount: final, paid_amount: paid, due_date: '2099-10-05', payment_status: paid ? 'paid' : 'pending' });
    if (credit) await f.insert('paca', 'rest_credits', { id: 800, student_id: 8, academy_id: 1, rest_start_date: '2099-10-11', rest_end_date: '2099-10-31', rest_days: 21,
      credit_amount: 210000, remaining_amount: 210000 - used, credit_type: 'carryover', status: used ? 'partial' : 'pending' });
  }
  beforeEach(() => reset());
  const post = (path, body, auth = token) => request(app).post('/full/paca/' + path).auth(auth, { type: 'bearer' }).send(body);
  const preview = (date = '2099-10-21', id = 8) => post('preview', { operation: 'student_reactivate', resource_id: id, changes: date ? { resume_date: date } : {} });
  const confirm = (p, auth) => post('confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true }, auth);
  const rows = async (table, filter) => (await f.paca.query(`SELECT * FROM ${table} WHERE ${filter} ORDER BY id`))[0];
  const snapshot = async () => ({ student: await rows('students', 'id=8'), payments: await rows('student_payments', 'student_id=8'),
    credits: await rows('rest_credits', 'student_id=8'), attendance: await rows('attendance', 'student_id=8'), ledger: await rows('max_engine_commands', '1=1') });
  async function outcome() {
    const state = await snapshot();
    const omit = row => Object.fromEntries(Object.entries(row).filter(([k]) => !['id', 'created_at', 'updated_at'].includes(k)));
    return { status: state.student[0].status, payments: state.payments.map(omit), credits: state.credits.map(omit),
      schedules: (await f.paca.query('SELECT cs.class_date,cs.time_slot,a.attendance_status FROM attendance a JOIN class_schedules cs ON cs.id=a.class_schedule_id WHERE a.student_id=8 ORDER BY cs.class_date,cs.time_slot'))[0] };
  }
  test.each([
    ['shortened unpaid', {}, '2099-10-21'],
    ['partial paid floor', { final: 150000, paid: 150000 }, '2099-10-21'],
    ['full bill and unused credit', { final: 310000, credit: true }, '2099-10-21'],
    ['used credit preserved', { final: 310000, credit: true, used: 50000 }, '2099-10-21'],
    ['new month new bill', { final: null, credit: true }, '2099-11-02'],
    ['zero tuition', { final: null, tuition: 0 }, '2099-10-21'],
  ])('%s: preview writes nothing, confirm matches screen API exactly', async (_label, seed, date) => {
    await reset(seed); const before = await snapshot();
    const p = await preview(date); expect(p.body.error).toBeUndefined(); expect(p.status).toBe(200);
    expect(await snapshot()).toEqual(before);
    expect(p.body.after.related.activation).toContain('즉시');
    const c = await confirm(p.body); expect(c.body.error).toBeUndefined(); expect(c.status).toBe(200);
    const mcp = await outcome();
    const afterConfirm = await snapshot();
    expect((await confirm(p.body)).body).toEqual(c.body); expect(await snapshot()).toEqual(afterConfirm);
    if (p.body.after.related.paymentAdjusted) expect(Number(mcp.payments[0].final_amount)).toBe(p.body.after.related.paymentAdjusted.finalAmount);
    if (p.body.after.related.paymentCreated) expect(Number(mcp.payments[0].final_amount)).toBe(p.body.after.related.paymentCreated.finalAmount);
    if (p.body.after.related.creditRecalculation) expect(Number(mcp.credits[0].remaining_amount)).toBe(p.body.after.related.creditRecalculation.remainingAmount);
    expect(mcp.schedules).toHaveLength(p.body.after.related.scheduleChanges.filter(s => s.assign_attendance).length);
    await reset(seed);
    const ui = await request(app).post('/students/8/resume').send({ resume_date: date });
    expect(ui.body.error).toBeUndefined(); expect(ui.status).toBe(200);
    expect(await outcome()).toEqual(mcp);
  });
  test('dates, authority, confirmation and deleted students are enforced', async () => {
    for (const date of ['2099-02-30', '2099-10-10']) expect((await preview(date)).status).toBe(422);
    expect((await preview('2099-10-21', 90)).status).toBe(404); // another academy is never visible
    await f.paca.query("UPDATE students SET status='paused',rest_start_date='2099-10-11' WHERE id=90");
    expect((await preview('2099-10-21', 90)).status).toBe(404);
    const p = await preview();
    expect((await post('confirm', { preview_token: p.body.preview_token, idempotency_key: p.body.idempotency_key, confirm: false })).status).toBe(422);
    expect((await confirm(p.body, other)).status).toBe(409);
    await f.paca.query('UPDATE students SET deleted_at=NOW() WHERE id=8');
    expect((await confirm(p.body)).status).toBe(404);
  });
  test('credit overuse, ambiguous/manual bills and duplicate monthly invoices fail without writes', async () => {
    for (const seed of [{ final: 310000, credit: true, used: 150000 }, { final: 90000 }]) {
      await reset(seed); const before = await snapshot();
      expect((await preview()).body.error.code).toBe('REST_CREDIT_RECALCULATION_CONFLICT');
      expect(await snapshot()).toEqual(before);
    }
    await reset(); await f.paca.query("INSERT INTO student_payments (student_id,academy_id,`year_month`,payment_type,base_amount,final_amount,due_date) VALUES (8,1,'2099-10','monthly',1,1,'2099-10-05')");
    expect((await preview()).status).toBe(409);
  });
  test('payment, credit and schedule changes invalidate an old preview', async () => {
    for (const sql of ["UPDATE student_payments SET due_date='2099-10-22' WHERE id=800",
      "UPDATE rest_credits SET remaining_amount=200000 WHERE id=800",
      "INSERT INTO class_schedules (academy_id,class_date,time_slot) VALUES (1,'2099-10-23','evening')"]) {
      await reset({ final: 310000, credit: true }); const p = await preview(); expect(p.status).toBe(200);
      await f.paca.query(sql); const before = await snapshot();
      expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED'); expect(await snapshot()).toEqual(before);
    }
  });
  test('failure rolls back credit, new invoice and state; concurrent confirm applies once', async () => {
    await reset({ final: null, credit: true }); const before = await snapshot(); const p = await preview('2099-11-02'); expect(p.status).toBe(200);
    await f.paca.query("CREATE TRIGGER resume_failure BEFORE INSERT ON attendance FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic rollback'");
    try { expect((await confirm(p.body)).status).toBe(503); expect(await snapshot()).toEqual(before); }
    finally { await f.paca.query('DROP TRIGGER resume_failure'); }
    const results = await Promise.all([confirm(p.body), confirm(p.body)]);
    expect(results.map(r => r.status)).toEqual([200, 200]); expect(results[0].body).toEqual(results[1].body);
    expect((await snapshot()).ledger).toHaveLength(1); expect((await snapshot()).payments).toHaveLength(1);
  });
  test('season free-period exclusion and existing checked attendance match screen behavior', async () => {
    await reset({ final: null });
    await f.insert('paca', 'seasons', { id: 800, academy_id: 1, season_start_date: '2099-09-01', season_end_date: '2099-09-30',
      free_lesson_end_date: '2099-10-31', post_free_action: 'graduate', status: 'ended' });
    await f.insert('paca', 'student_seasons', { student_id: 8, season_id: 800, is_cancelled: 0, payment_status: 'paid' });
    const p = await preview(); expect(p.body.error).toBeUndefined(); expect(p.status).toBe(200);
    expect(p.body.after.related.paymentCreated).toBeUndefined();
    expect((await confirm(p.body)).status).toBe(200); expect((await snapshot()).payments).toHaveLength(0);
    await reset();
    await f.insert('paca', 'class_schedules', { id: 800, academy_id: 1, class_date: '2099-10-23', time_slot: 'evening' });
    await f.insert('paca', 'attendance', { id: 800, student_id: 8, class_schedule_id: 800, attendance_status: 'present' });
    const p2 = await preview(); expect(p2.status).toBe(200);
    expect(p2.body.after.related.scheduleChanges.find(s => s.schedule_id === 800).assign_attendance).toBe(false);
    expect((await confirm(p2.body)).status).toBe(200);
    expect((await rows('attendance', 'id=800'))[0].attendance_status).toBe('present');
  });
  test('omitted date uses Korea today and retained non-paused reactivation rejects irrelevant dates', async () => {
    await reset({ final: null, tuition: 0 });
    await f.paca.query('UPDATE students SET rest_start_date=? WHERE id=8', [f.date]);
    const p = await preview(null); expect(p.status).toBe(200); expect(p.body.after.resume_date).toBe(f.date);
    for (const status of ['withdrawn', 'graduated']) {
      await f.paca.query('UPDATE students SET status=? WHERE id=8', [status]);
      expect((await preview()).status).toBe(422);
      expect((await preview(null)).status).toBe(200);
    }
  });
  const mcpTest = process.env.PACA_MCP_TEST_ROOT ? test : test.skip;
  mcpTest('real MCP OAuth, preview, confirmation and readback through real PACA HTTP and MySQL', async () => {
    const path = require('path'), http = require('http'), crypto = require('crypto');
    const root = process.env.PACA_MCP_TEST_ROOT;
    const { login, connect } = require(path.join(root, 'test/helpers'));
    const { createApp } = require(path.join(root, 'shared/server'));
    const { createClient } = require(path.join(root, 'shared/client'));
    const { openStore } = require(path.join(root, 'shared/store'));
    const upstream = http.createServer(app), mcp = http.createServer();
    const listen = server => new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    await listen(upstream); await listen(mcp);
    const origin = `http://127.0.0.1:${mcp.address().port}`;
    const config = { provider: 'paca', publicUrl: new URL(origin),
      apiUrl: new URL(`http://127.0.0.1:${upstream.address().port}`), storageKey: crypto.randomBytes(32),
      allowedRedirectHosts: ['localhost'], accessTokenTtlSec: 900, scopes: ['business:read', 'business:confirmed-write'] };
    const store = openStore(':memory:', config.storageKey);
    mcp.on('request', createApp({ config, store, source: createClient(config) }));
    let client;
    try {
      const auth = await login(origin); expect(auth.status).toBe(200);
      const connection = await connect(origin, auth.tokens.access_token); client = connection.client;
      const { call } = connection;
      const capabilities = await call('list_capabilities');
      expect(capabilities.data.commands.map(c => c.operation)).toContain('student_reactivate');
      const before = await snapshot();
      const p = await call('preview_student_reactivate', { resource_id: 8, resume_date: '2099-10-21' });
      expect(p.isError).not.toBe(true); expect(p.data.requires_confirmation).toBe(true);
      expect(p.data.after.related.paymentAdjusted.finalAmount).toBe(210000);
      expect(await snapshot()).toEqual(before);
      const c = await call('confirm_change', { preview_id: p.data.preview_id, confirm: true });
      expect(c.data).toMatchObject({ applied: true, resource_id: 8 });
      expect((await call('confirm_change', { preview_id: p.data.preview_id, confirm: true })).data).toEqual(c.data);
      expect((await snapshot()).student[0].status).toBe('active');
      const read = await call('read_resource', { resource: 'students', ids: [8] });
      expect(read.isError).not.toBe(true);
    } finally {
      await client?.close();
      await Promise.all([new Promise(r => mcp.close(r)), new Promise(r => upstream.close(r))]);
      store.close();
    }
  }, 20000);
});
