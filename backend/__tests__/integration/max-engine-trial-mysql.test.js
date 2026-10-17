/** Real authenticated routes and transactions on a dedicated disposable loopback MySQL. */
jest.mock('../../config/database', () => global.__trial.paca);
jest.mock('../../config/peak-database', () => global.__trial.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('PACA trial commands with isolated MySQL', () => {
  let f, app, token, other;
  beforeAll(async () => {
    f = await fixture(); global.__trial = f;
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20260927_max_engine_commands.sql'), 'utf8'));
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20260930_add_student_prospect_status.mysql'), 'utf8'));
    // The catalog fixture intentionally strips defaults and indexes. Match source defaults for newly created rows.
    await f.paca.query('ALTER TABLE attendance ADD UNIQUE KEY student_schedule (student_id,class_schedule_id)');
    app = express(); app.use(express.json()); app.use('/full', require('../../routes/integrations/full'));
    app.use('/paca/integrations/max-engine/full', require('../../routes/integrations/full'));
    for (const email of ['a@example.invalid', 'b@example.invalid']) {
      const r = await request(app).post('/full/token').send({ email, password: 'synthetic' });
      expect(r.status).toBe(200); if (email[0] === 'a') token = r.body.access_token; else other = r.body.access_token;
    }
  });
  afterAll(async () => { await f?.close(); });
  beforeEach(async () => {
    await f.paca.query('DELETE FROM max_engine_commands');
    await f.paca.query('DELETE FROM attendance WHERE student_id=8');
    await f.paca.query("UPDATE students SET status='pending',is_trial=0,trial_remaining=0,trial_dates='[]' WHERE id=8");
  });
  const post = (path, body, auth = token) => request(app).post('/full/paca/' + path).auth(auth, { type: 'bearer' }).send(body);
  const preview = (operation, changes, resource_id = 8) => post('preview', { operation, resource_id, changes });
  const confirm = (p, auth) => post('confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true }, auth);
  const register = () => preview('trial_register', { trial_dates: [{ date: f.date, time_slot: 'afternoon' }] });
  const student = async () => (await f.paca.query('SELECT * FROM students WHERE id=8'))[0][0];
  test('preview is read-only; confirm keeps student ID/billing, creates attendance once, query finds result', async () => {
    const before = await student();
    const billing = (await f.paca.query('SELECT * FROM student_payments ORDER BY id'))[0];
    const p = await register(); expect(p.status).toBe(200);
    expect(await student()).toEqual(before);
    expect((await f.paca.query('SELECT * FROM attendance WHERE student_id=8'))[0]).toHaveLength(0);
    expect((await post('confirm', { preview_token: p.body.preview_token, idempotency_key: p.body.idempotency_key, confirm: false })).status).toBe(422);
    expect((await confirm(p.body, other)).status).toBe(409);
    const c = await confirm(p.body); expect(c.status).toBe(200); expect(c.body.resource_id).toBe(8);
    expect((await confirm(p.body)).body).toEqual(c.body);
    expect(await student()).toMatchObject({ status: 'trial', is_trial: 1, trial_remaining: 1 });
    expect((await f.paca.query('SELECT * FROM attendance WHERE student_id=8'))[0]).toHaveLength(1);
    expect((await f.paca.query('SELECT * FROM student_payments ORDER BY id'))[0]).toEqual(billing);
    const r = await request(app).get('/full/paca/workflows/trial_students').auth(token, { type: 'bearer' }).query({ params: JSON.stringify({ student_id: 8 }) });
    expect(r.status).toBe(200); expect(r.body.items.map(s => s.id)).toEqual([8]);
  });
  test('additional and moved schedule preserve earlier attendance and reject checked moves', async () => {
    const p = await register(); expect((await confirm(p.body)).status).toBe(200);
    const add = await preview('trial_schedule_add', { date: '2099-05-01', time_slot: 'morning' });
    expect(add.status).toBe(200); expect((await confirm(add.body)).status).toBe(200);
    expect((await student()).trial_remaining).toBe(2);
    const changes = { previous_date: '2099-05-01', previous_time_slot: 'morning', date: '2099-05-02', time_slot: 'evening' };
    const move = await preview('trial_schedule_update', changes); expect(move.status).toBe(200);
    expect(move.body.after.related.remove_attendance).toHaveLength(1);
    expect((await confirm(move.body)).status).toBe(200);
    const [rows] = await f.paca.query('SELECT cs.class_date,cs.time_slot FROM attendance a JOIN class_schedules cs ON cs.id=a.class_schedule_id WHERE a.student_id=8 ORDER BY cs.class_date');
    expect(rows).toEqual([{ class_date: f.date, time_slot: 'afternoon' }, { class_date: '2099-05-02', time_slot: 'evening' }]);
    await f.paca.query("UPDATE attendance SET attendance_status='present' WHERE student_id=8");
    expect((await preview('trial_schedule_update', { ...changes, previous_date: '2099-05-02', previous_time_slot: 'evening' })).status).toBe(409);
  });
  test('academy boundary, deletion, caller-supplied academy/state and duplicate date are rejected', async () => {
    expect((await preview('trial_register', { trial_dates: [{ date: f.date, time_slot: 'morning' }] }, 90)).status).toBe(404);
    for (const extra of [{ academy_id: 2 }, { trial_remaining: 100 }, { status: 'active' }]) {
      expect((await preview('trial_register', { trial_dates: [{ date: f.date, time_slot: 'morning' }], ...extra })).status).toBe(422);
    }
    expect((await preview('trial_register', { trial_dates: [{ date: f.date, time_slot: 'morning' }, { date: f.date, time_slot: 'morning' }] })).status).toBe(409);
    await f.paca.query('UPDATE students SET deleted_at=NOW() WHERE id=8');
    expect((await register()).status).toBe(404);
    await f.paca.query('UPDATE students SET deleted_at=NULL WHERE id=8');
  });
  test('preview source changes invalidate confirmation; holidays are blocked', async () => {
    const p = await register(); expect(p.status).toBe(200);
    await f.paca.query("UPDATE academy_settings SET afternoon_class_time='15:00-18:00' WHERE academy_id=1");
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    expect((await student()).status).toBe('pending');
    const p2 = await register();
    await f.insert('paca', 'academy_events', { academy_id: 1, title: '합성 휴일', event_date: f.date, is_holiday: 1 });
    expect((await confirm(p2.body)).body.error.code).toBe('SOURCE_CHANGED');
    expect((await register()).body.error.code).toBe('TRIAL_CONFLICT');
    await f.paca.query('DELETE FROM academy_events');
  });
  test('attendance failure rolls back student and ledger; concurrent confirmation applies once', async () => {
    const p = await register(); expect(p.status).toBe(200);
    await f.paca.query("CREATE TRIGGER synthetic_trial_fail BEFORE INSERT ON attendance FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
    try {
      expect((await confirm(p.body)).status).toBe(503);
      expect((await student()).status).toBe('pending');
      expect((await f.paca.query('SELECT * FROM max_engine_commands'))[0]).toHaveLength(0);
    } finally { await f.paca.query('DROP TRIGGER synthetic_trial_fail'); }
    const results = await Promise.all([confirm(p.body), confirm(p.body)]);
    expect(results.map(r => r.status)).toEqual([200, 200]);
    expect(results[0].body).toEqual(results[1].body);
    expect((await f.paca.query('SELECT * FROM attendance WHERE student_id=8'))[0]).toHaveLength(1);
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
      expect(capabilities.data.commands.map(c => c.operation)).toContain('trial_register');
      for (const [operation, changes] of [
        ['trial_register', { trial_dates: [{ date: f.date, time_slot: 'morning' }] }],
        ['trial_schedule_add', { date: '2099-06-01', time_slot: 'afternoon' }],
        ['trial_schedule_update', { previous_date: '2099-06-01', previous_time_slot: 'afternoon', date: '2099-06-02', time_slot: 'evening' }],
      ]) {
        const old = await student();
        const p = await call('preview_change', { operation, resource_id: 8, changes });
        expect(p.isError).not.toBe(true); expect(p.data.requires_confirmation).toBe(true);
        expect(await student()).toEqual(old);
        const c = await call('confirm_change', { preview_id: p.data.preview_id, confirm: true });
        expect(c.data).toMatchObject({ applied: true, resource_id: 8 });
        expect((await call('confirm_change', { preview_id: p.data.preview_id, confirm: true })).data).toEqual(c.data);
      }
      const read = await call('trial_students', { student_id: 8 });
      expect(read.data.items).toHaveLength(1); expect(read.data.items[0].trial_remaining).toBe(2);
    } finally {
      await client?.close();
      await Promise.all([new Promise(r => mcp.close(r)), new Promise(r => upstream.close(r))]);
      store.close();
    }
  }, 20000);

});
