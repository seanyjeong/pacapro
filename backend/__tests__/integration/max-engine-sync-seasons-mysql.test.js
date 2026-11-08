/** Real HTTP + isolated MySQL; no production credentials or real student rows. 시즌 읽기(맥스엔진 DL). */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__syncSeasonsPaca);
jest.mock('../../config/peak-database', () => ({}));
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const base = '/paca/integrations/max-engine/sync/seasons';
const key = crypto.randomBytes(32).toString('hex');
run('academy-scoped season sync HTTP with native MySQL', () => {
  let admin, pool, server;
  const original = { ...process.env };
  const database = 'max_engine_sync_seasons_test_paca';
  beforeAll(async () => {
    const port = Number(process.env.TEST_MYSQL_PORT);
    if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
    const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, timezone: '+09:00' };
    admin = await mysql.createConnection(options);
    await admin.query(`CREATE DATABASE IF NOT EXISTS ${database} CHARACTER SET utf8mb4`);
    for (const table of ['student_seasons', 'seasons', 'students']) await admin.query(`DROP TABLE IF EXISTS ${database}.${table}`);
    await admin.query(`CREATE TABLE ${database}.students (id INT PRIMARY KEY, academy_id INT NOT NULL, name VARCHAR(512), phone VARCHAR(512)) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE ${database}.seasons (id INT PRIMARY KEY, academy_id INT NOT NULL, season_name VARCHAR(100), season_type VARCHAR(20),
      status VARCHAR(20), season_start_date DATE, season_end_date DATE, non_season_end_date DATE, default_season_fee INT) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE ${database}.student_seasons (id INT PRIMARY KEY, student_id INT NOT NULL, season_id INT NOT NULL,
      season_fee INT, registration_date DATE, payment_status VARCHAR(20), is_cancelled TINYINT(1) DEFAULT 0, notes TEXT) ENGINE=InnoDB`);
    pool = mysql.createPool({ ...options, database });
    pool.on('connection', connection => connection.query("SET time_zone = '+09:00'"));
    global.__syncSeasonsPaca = pool;
    process.env.MAX_ENGINE_SYNC_KEY = key;
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1,2';
    await pool.query('INSERT INTO students VALUES ?', [[[501, 1, 'ENC:a', 'ENC:p'], [502, 1, 'ENC:b', null], [901, 2, 'ENC:c', null]]]);
    await pool.query('INSERT INTO seasons VALUES ?', [[
      [31, 1, '2027 정시', 'regular', 'active', '2026-10-01', '2027-02-28', '2026-09-30', 1000000],
      [30, 1, '2026 정시', 'regular', 'ended', '2025-10-01', '2026-02-28', null, 1000000],   // 끝난 지 1년 안
      [20, 1, '2024 정시', 'regular', 'ended', '2023-10-01', '2024-02-28', null, 1000000],   // 1년 넘음 → 빠짐
      [41, 2, '다른 교육원', 'regular', 'active', '2026-10-01', '2027-02-28', null, 1000000]]]);
    await pool.query('INSERT INTO student_seasons VALUES ?', [[
      [1, 501, 31, 1000000, '2026-09-20', 'paid', 0, 'private'], [2, 502, 31, 1000000, '2026-09-21', 'unpaid', 1, null],
      [3, 501, 30, 1000000, '2025-09-20', 'paid', 0, null], [4, 501, 20, 1000000, '2023-09-20', 'paid', 0, null],
      [5, 901, 41, 1000000, '2026-09-20', 'paid', 0, null], [6, 901, 31, 1000000, '2026-09-20', 'paid', 0, null]]]);  // 다른 교육원 학생이 31에 — 빠져야 함
    const app = express(); app.use('/paca/integrations', require('../../routes/integrations'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
    await pool?.end(); await admin?.end(); process.env = original;
  });
  const read = (query = { academy_id: '1' }, supplied = key) => request(server).get(base).set('X-Max-Engine-Sync-Key', supplied).query(query);
  test('key, allowlist and forwarded headers are checked like student sync; read-only', async () => {
    expect((await read(undefined, 'wrong')).status).toBe(401);
    expect((await read({ academy_id: '3' })).status).toBe(403);
    expect((await read().set('X-Forwarded-For', '127.0.0.1')).status).toBe(403);
    expect((await request(server).post(base)).status).toBe(404);
  });
  test('academy-scoped seasons (open or ended within a year) and registrations of that academy only, no personal fields', async () => {
    const response = await read();
    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');
    expect(response.body.seasons.map(s => s.id)).toEqual([30, 31]);
    expect(response.body.seasons[1]).toEqual({ id: 31, season_name: '2027 정시', season_type: 'regular', status: 'active',
      season_start_date: '2026-10-01', season_end_date: '2027-02-28', non_season_end_date: '2026-09-30' });
    expect(response.body.student_seasons).toEqual([
      { season_id: 31, paca_student_id: 501, registration_date: '2026-09-20', payment_status: 'paid', is_cancelled: false },
      { season_id: 31, paca_student_id: 502, registration_date: '2026-09-21', payment_status: 'unpaid', is_cancelled: true },
      { season_id: 30, paca_student_id: 501, registration_date: '2025-09-20', payment_status: 'paid', is_cancelled: false }]);
    expect(JSON.stringify(response.body)).not.toMatch(/ENC:|private|1000000/);  // 학생 이름·전화(암호문)·메모·금액 없음
    for (const row of response.body.student_seasons) expect(Object.keys(row).sort()).toEqual(['is_cancelled', 'paca_student_id', 'payment_status', 'registration_date', 'season_id']);
    const one = await read({ academy_id: '1', paca_student_id: '502' });
    expect(one.body.student_seasons.map(r => r.paca_student_id)).toEqual([502]);
    expect((await read({ academy_id: '2' })).body.student_seasons.map(r => [r.season_id, r.paca_student_id])).toEqual([[41, 901]]);
  });
});
