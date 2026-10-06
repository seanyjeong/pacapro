/** Real HTTP + isolated MySQL; no production credentials or real student rows. */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__syncPaca);
jest.mock('../../config/peak-database', () => ({}));
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const base = '/paca/integrations/max-engine/sync/students';
const key = crypto.randomBytes(32).toString('hex');
run('academy allowlist student sync HTTP with native MySQL', () => {
  let admin, pool, server, encrypt, baseline;
  const original = { ...process.env };
  const database = 'max_engine_sync_test_paca';
  beforeAll(async () => {
    const port = Number(process.env.TEST_MYSQL_PORT);
    if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
    const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, timezone: '+09:00' };
    admin = await mysql.createConnection(options);
    await admin.query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4`);
    await admin.query(`DROP TABLE IF EXISTS ${database}.students`);
    await admin.query(`CREATE TABLE ${database}.students (
      id INT PRIMARY KEY, academy_id INT NOT NULL, name VARCHAR(512), gender VARCHAR(10),
      school VARCHAR(100), grade VARCHAR(20), phone VARCHAR(512), parent_phone VARCHAR(512),
      admission_type VARCHAR(30), status VARCHAR(30), deleted_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL, birth_date DATE, notes TEXT) ENGINE=InnoDB`);
    pool = mysql.createPool({ ...options, database });
    pool.on('connection', connection => connection.query("SET time_zone = '+09:00'"));
    global.__syncPaca = pool;
    process.env.MAX_ENGINE_SYNC_KEY = key;
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1,2';
    process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    ({ encrypt } = require('../../services/maxEngineFullSecurity'));
    const rows = Array.from({ length: 405 }, (_, i) => [i + 1, 1, encrypt('합성학생' + (i + 1)), 'female',
      '합성학교', '고3', encrypt('000111'), encrypt('000222'), 'both', i === 0 ? 'prospect' : 'active',
      i === 1 ? '2026-10-01 09:00:00' : null, '2026-10-01 09:00:00', '2000-01-01', 'private']);
    rows.push([999, 2, encrypt('다른교육원'), null, null, null, null, null, 'early', 'active', null,
      '2026-10-01 09:00:00', null, 'private']);
    await pool.query('INSERT INTO students VALUES ?', [rows]);
    baseline = (await pool.query('SELECT * FROM students ORDER BY id'))[0];
    const app = express(); app.use('/paca/integrations', require('../../routes/integrations'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await pool?.end(); await admin?.end(); process.env = original;
  });
  const read = (query = { academy_id: '1' }, supplied = key) => request(server).get(base)
    .set('X-Max-Engine-Sync-Key', supplied).query(query);
  test('missing either env disables entire route; wrong key rejects and forwarded requests cannot enter', async () => {
    delete process.env.MAX_ENGINE_SYNC_KEY;
    expect((await read()).status).toBe(503);
    expect((await request(server).get(base)).status).toBe(503);
    process.env.MAX_ENGINE_SYNC_KEY = key;
    delete process.env.MAX_ENGINE_SYNC_ACADEMY_IDS;
    expect((await read()).status).toBe(503);
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1,2';
    expect((await read(undefined, 'wrong')).status).toBe(401);
    expect((await request(server).get(base).query({ academy_id: '1' })).status).toBe(401);
    for (const header of ['X-Forwarded-For', 'Forwarded', 'X-Real-IP']) {
      expect((await read().set(header, '127.0.0.1')).status).toBe(403);
    }
    expect((await request(server).post(base)).status).toBe(404);
  });
  test('nonmember returns 403 and revocation in the env is effective immediately', async () => {
    expect((await read({ academy_id: '3' })).status).toBe(403);
    expect((await read({ academy_id: '2' })).body.items.map(s => s.paca_student_id)).toEqual([999]);
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '2';
    expect((await read()).status).toBe(403);
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1,2';
  });
  test('405 equal timestamps paginate 200/200/5 without duplicates and include tombstones/prospects', async () => {
    const ids = [], times = [], sizes = []; let cursor;
    do {
      const response = await read({ academy_id: '1', ...(cursor ? { cursor } : {}) });
      expect(response.status).toBe(200);
      expect(response.headers['cache-control']).toBe('no-store');
      sizes.push(response.body.items.length); times.push(response.body.server_time);
      if (!cursor) {
        expect(response.body.items[0]).toMatchObject({ name: '합성학생1', phone: '000111', parent_phone: '000222', status: 'prospect', admission_type: 'both' });
        expect(response.body.items[1].deleted_at).toBe('2026-10-01T00:00:00.000Z');
        expect(Object.keys(response.body.items[0]).sort()).toEqual(['paca_student_id','academy_id','name','gender','school_name','grade','phone','parent_phone','admission_type','status','deleted_at','updated_at'].sort());
      }
      ids.push(...response.body.items.map(s => s.paca_student_id)); cursor = response.body.next_cursor;
    } while (cursor);
    expect(sizes).toEqual([200, 200, 5]); expect(new Set(times).size).toBe(1);
    expect(ids).toEqual(Array.from({ length: 405 }, (_, i) => i + 1));
    expect((await pool.query('SELECT * FROM students ORDER BY id'))[0]).toEqual(baseline);
  });
  test('strict delta supports Python microsecond ISO and scoped cursors cannot be reused or tampered', async () => {
    const since = '2026-09-30T23:59:59.000000Z';
    const first = await read({ academy_id: '1', updated_since: since });
    expect(first.status).toBe(200); expect(first.body.items).toHaveLength(200);
    const cursor = first.body.next_cursor;
    const second = await read({ academy_id: '1', updated_since: '2026-10-01T08:59:59+09:00', cursor });
    expect(second.status).toBe(200); expect(second.body.items[0].paca_student_id).toBe(201);
    for (const query of [{ academy_id: '2', updated_since: since, cursor }, { academy_id: '1', cursor },
      { academy_id: '1', updated_since: since, cursor: cursor + 'x' }, { academy_id: '1', updated_since: '2026-02-30T00:00:00Z' }]) {
      expect((await read(query)).status).toBe(422);
    }
    expect((await read({ academy_id: '1', updated_since: '2026-10-01T00:00:00Z' })).body.items).toEqual([]);
  });
  test('fixed watermark excludes subsequent updates; they appear in the next complete delta', async () => {
    const first = await read(); const { next_cursor: cursor, server_time: since } = first.body;
    // Simulate a write after page 1 using the next second; release GET itself never writes.
    await pool.execute('UPDATE students SET updated_at = DATE_ADD(?, INTERVAL 1 SECOND) WHERE id = 405',
      [require('../../models/maxEngineSyncPage').isoToMysql(since)]);
    const next = await read({ academy_id: '1', cursor });
    const last = await read({ academy_id: '1', cursor: next.body.next_cursor });
    expect(last.body.items.map(s => s.paca_student_id)).toEqual([401, 402, 403, 404]);
    // Let the database clock close that second before starting a new scan.
    await new Promise(resolve => setTimeout(resolve, 1100));
    const delta = await read({ academy_id: '1', updated_since: since });
    expect(delta.body.items.map(s => s.paca_student_id)).toEqual([405]);
  });
  test('crypto and DB failures return safe 503 without ciphertext, private columns or raw error details', async () => {
    await pool.execute('UPDATE students SET name = ? WHERE id = 1', ['ENC:broken']);
    const corrupt = await read(); expect(corrupt.status).toBe(503);
    expect(JSON.stringify(corrupt.body)).not.toMatch(/ENC:|private|birth_date/);
    await pool.query('RENAME TABLE students TO students_unavailable');
    try {
      const failure = await read(); expect(failure.status).toBe(503);
      expect(failure.body.error.code).toBe('SOURCE_UNAVAILABLE');
      expect(JSON.stringify(failure.body)).not.toMatch(/students_unavailable|SELECT|mysql|password/i);
    } finally { await pool.query('RENAME TABLE students_unavailable TO students'); }
  });
});
