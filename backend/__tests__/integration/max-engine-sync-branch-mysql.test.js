/** 지점 범위 동기화 — 실제 HTTP + 일회용 MySQL. 운영 자격 증명·실제 학생 없음. */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__syncBranchPaca);
jest.mock('../../config/peak-database', () => ({}));
const mysql = require('mysql2/promise');
const crypto = require('crypto');
const express = require('express');
const request = require('supertest');
const base = '/paca/integrations/max-engine/sync';
const key = crypto.randomBytes(32).toString('hex');
run('branch scoped student sync HTTP with native MySQL', () => {
  let admin, pool, server;
  const original = { ...process.env };
  const database = 'max_engine_sync_branch_test_paca';
  beforeAll(async () => {
    const port = Number(process.env.TEST_MYSQL_PORT);
    if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
    const options = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true, timezone: '+09:00' };
    admin = await mysql.createConnection(options);
    await admin.query(`DROP DATABASE IF EXISTS ${database}`);
    await admin.query(`CREATE DATABASE ${database} CHARACTER SET utf8mb4`);
    await admin.query(`CREATE TABLE ${database}.students (
      id INT PRIMARY KEY, academy_id INT NOT NULL, name VARCHAR(512), gender VARCHAR(10),
      school VARCHAR(100), grade VARCHAR(20), phone VARCHAR(512), parent_phone VARCHAR(512),
      father_phone VARCHAR(512), mother_phone VARCHAR(512), admission_type VARCHAR(30), status VARCHAR(30), deleted_at TIMESTAMP NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP, branch_id INT NULL, class_id INT NULL) ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE ${database}.branches (id INT PRIMARY KEY, academy_id INT NOT NULL, name VARCHAR(100) NOT NULL,
      sort_order INT NOT NULL DEFAULT 0, status VARCHAR(10) NOT NULL DEFAULT 'active') ENGINE=InnoDB`);
    await admin.query(`CREATE TABLE ${database}.classes (id INT PRIMARY KEY, academy_id INT NOT NULL, branch_id INT NULL,
      class_name VARCHAR(100) NOT NULL, sort_order INT NOT NULL DEFAULT 0, status VARCHAR(10) NOT NULL DEFAULT 'active') ENGINE=InnoDB`);
    pool = mysql.createPool({ ...options, database });
    pool.on('connection', connection => connection.query("SET time_zone = '+09:00'"));
    global.__syncBranchPaca = pool;
    process.env.MAX_ENGINE_SYNC_KEY = key;
    process.env.MAX_ENGINE_SYNC_ACADEMY_IDS = '1,2';
    process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    const { encrypt } = require('../../services/maxEngineFullSecurity');
    await pool.query('INSERT INTO branches (id, academy_id, name, sort_order) VALUES (3, 1, "수성", 1), (5, 1, "칠곡", 2), (7, 2, "다른학원지점", 1)');
    await pool.query('INSERT INTO classes (id, academy_id, branch_id, class_name, sort_order) VALUES (8, 1, 3, "정시반", 1), (9, 1, 3, "수시반", 2)');
    // 1~3 수성(8반·9반·반 없음), 4 칠곡, 5 지점 없음, 99 다른 학원
    const student = (id, academy, branch, cls) => [id, academy, encrypt('합성학생' + id), 'female', '합성학교', '고3',
      encrypt('000111'), null, null, null, 'both', 'active', null, '2026-10-01 09:00:00', branch, cls];
    await pool.query('INSERT INTO students VALUES ?', [[student(1, 1, 3, 8), student(2, 1, 3, 9), student(3, 1, 3, null),
      student(4, 1, 5, null), student(5, 1, null, null), student(99, 2, 7, null)]]);
    const app = express(); app.use('/paca/integrations', require('../../routes/integrations'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    await admin?.query(`DROP DATABASE IF EXISTS ${database}`);
    await pool?.end(); await admin?.end(); process.env = original;
  });
  const read = (query, path = '/students') => request(server).get(base + path).set('X-Max-Engine-Sync-Key', key).query(query);
  const shape = items => items.map(s => s.out_of_scope ? [s.paca_student_id, 'out'] : [s.paca_student_id, s.branch_name, s.class_name]);

  test('범위 없는 조회는 학원 전체를 기존 칸 그대로 내준다', async () => {
    const all = await read({ academy_id: '1' });
    expect(all.status).toBe(200);
    expect(all.body.items.map(s => s.paca_student_id)).toEqual([1, 2, 3, 4, 5]);
    expect(Object.keys(all.body.items[0])).not.toEqual(expect.arrayContaining(['branch_id']));
    expect(all.body.items.some(s => 'out_of_scope' in s)).toBe(false);
  });
  test('두 엔진 교육원이 같은 학원에서 자기 지점 학생만 받고, 나머지는 번호만 받는다', async () => {
    const suseong = await read({ academy_id: '1', branch_ids: '3' });
    expect(shape(suseong.body.items)).toEqual([[1, '수성', '정시반'], [2, '수성', '수시반'], [3, '수성', null], [4, 'out'], [5, 'out']]);
    expect(Object.keys(suseong.body.items[3]).sort()).toEqual(['academy_id', 'out_of_scope', 'paca_student_id', 'updated_at']);
    const chilgok = await read({ academy_id: '1', branch_ids: '5' });
    expect(shape(chilgok.body.items)).toEqual([[1, 'out'], [2, 'out'], [3, 'out'], [4, '칠곡', null], [5, 'out']]);
    expect((await read({ academy_id: '1', branch_ids: '7' })).status).toBe(422); // 다른 학원 지점
  });
  test('지점을 옮긴 학생은 다음 증분 조회에서 옛 지점엔 범위 밖으로, 새 지점엔 학생으로 온다', async () => {
    const since = (await read({ academy_id: '1', branch_ids: '3' })).body.server_time;
    await new Promise(resolve => setTimeout(resolve, 1100));
    await pool.query('UPDATE students SET branch_id = 5, class_id = NULL WHERE id = 2');
    await new Promise(resolve => setTimeout(resolve, 1100));
    expect(shape((await read({ academy_id: '1', branch_ids: '3', updated_since: since })).body.items)).toEqual([[2, 'out']]);
    expect(shape((await read({ academy_id: '1', branch_ids: '5', updated_since: since })).body.items)).toEqual([[2, '칠곡', null]]);
  });
  test('지점 목록은 그 학원 것만 순서대로', async () => {
    const list = await read({ academy_id: '1' }, '/branches');
    expect(list.status).toBe(200);
    expect(list.body).toEqual({ academy_id: 1, branches: [
      { id: 3, name: '수성', status: 'active', classes: [{ id: 8, name: '정시반', status: 'active' }, { id: 9, name: '수시반', status: 'active' }] },
      { id: 5, name: '칠곡', status: 'active', classes: [] } ] });
    expect((await read({ academy_id: '3' }, '/branches')).status).toBe(403);
  });
});
