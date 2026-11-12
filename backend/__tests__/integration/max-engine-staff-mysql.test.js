/** 직원(staff) AI 연결 — 파카 직원 권한대로(constants/maxEngineStaffPermissions.js). Real MySQL, synthetic rows only, isolated port·prefix. */
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__fullPaca);
jest.mock('../../config/peak-database', () => global.__fullPeak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const crypto = require('crypto');
const fs = require('fs');
const mysql = require('mysql2/promise');
const bcrypt = require('bcryptjs');
const express = require('express');
const request = require('supertest');
const schema = require('./max-engine-schema.json');
const catalog = require('../../constants/maxEngineReadCatalog.json');

run('staff delegation follows PACA staff permissions', () => {
  let paca, peak, admin, app, server, token, encrypt;
  const originalDbName = process.env.DB_NAME;
  const prefix = 'max_engine_staff_test_';
  const base = '/full';
  const secret = crypto.randomBytes(48).toString('hex');
  const password = crypto.randomBytes(16).toString('hex');
  beforeAll(async () => {
    const port = Number(process.env.TEST_MYSQL_PORT);
    if (!Number.isSafeInteger(port) || port < 10000) throw new Error('Dedicated TEST_MYSQL_PORT >=10000 required');
    const opts = { host: '127.0.0.1', port, user: 'root', password: '', dateStrings: true };
    admin = await mysql.createConnection(opts);
    for (const provider of ['paca', 'peak']) {
      await admin.query(`CREATE DATABASE IF NOT EXISTS ${prefix + provider} CHARACTER SET utf8mb4`);
      for (const [key, columns] of Object.entries(schema).filter(([k]) => k.startsWith(provider + '.'))) {
        if (!Object.values(catalog).some(s => s.provider === provider && s.table === key.split('.')[1])) continue;
        const name = key.split('.')[1];
        await admin.query(`DROP TABLE IF EXISTS ${prefix + provider}.\`${name}\``);
        const defs = columns.map(([col, type, nullable, index]) => `\`${col}\` ${type} ${col === 'id' ? 'NOT NULL AUTO_INCREMENT PRIMARY KEY' :
          index === 'PRI' ? 'NOT NULL PRIMARY KEY' : nullable === 'NO' ? 'NOT NULL' : 'NULL'}`);
        await admin.query(`CREATE TABLE ${prefix + provider}.\`${name}\` (${defs.join(',')}) ENGINE=InnoDB`);
      }
    }
    paca = mysql.createPool({ ...opts, database: prefix + 'paca' });
    peak = mysql.createPool({ ...opts, database: prefix + 'peak' });
    global.__fullPaca = paca; global.__fullPeak = peak;
    await paca.query(fs.readFileSync(require.resolve('../../migrations/20260930_add_student_prospect_status.mysql'), 'utf8'));
    await paca.query(fs.readFileSync(require.resolve('../../migrations/20261006_add_both_student_admission_type.mysql'), 'utf8'));
    // Production already has these nullable encrypted contact columns; no production DDL is needed.
    await paca.query('ALTER TABLE students ADD father_phone VARCHAR(512) NULL, ADD mother_phone VARCHAR(512) NULL');
    await paca.query('DROP TABLE IF EXISTS max_engine_commands');
    await paca.query(fs.readFileSync(require.resolve('../../migrations/20260927_max_engine_commands.sql'), 'utf8'));
    await peak.query('DROP TABLE IF EXISTS max_engine_commands');
    await peak.query('DROP TABLE IF EXISTS max_engine_academy_locks');
    for (const sql of fs.readFileSync(require.resolve('../../migrations/20261003_peak_max_engine_commands.sql'), 'utf8').replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await peak.query(sql);
    process.env.DB_NAME = prefix + 'paca';
    process.env.MAX_ENGINE_LINK_SECRET = secret;
    process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    ({ encrypt } = require('../../services/maxEngineFullSecurity'));
    const hash = bcrypt.hashSync(password, 4);
    await paca.query("INSERT INTO academies(id,owner_user_id,name) VALUES (1,1,'Synthetic A'),(2,2,'Synthetic B')");
    await paca.query("INSERT INTO users(id,name,email,password_hash,role,academy_id,is_active,approval_status) VALUES (1,'Synthetic A','a@example.invalid',?,'owner',1,1,'approved'),(2,'Synthetic B','b@example.invalid',?,'owner',2,1,'approved')", [hash, hash]);
    await paca.query("INSERT INTO students(id,academy_id,name,phone,grade,class_days,weekly_count,monthly_tuition,status) VALUES (1,1,?,?,'고3','[]',0,0,'active'),(2,2,?,?,'고3','[]',0,0,'active')", [encrypt('합성가'),encrypt('000111'),encrypt('합성나'),encrypt('000222')]);
    app = express(); app.use(express.json()); app.use(base, require('../../routes/integrations/full'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const login = await request(server).post(base + '/token').send({ email: 'a@example.invalid', password });
    expect(login.status).toBe(200); expect(login.body.expires_in).toBe(2592000); token = login.body.access_token;
  });
  afterAll(async () => {
    if (server) await new Promise(resolve => server.close(resolve));
    if (originalDbName === undefined) delete process.env.DB_NAME; else process.env.DB_NAME = originalDbName;
    await paca?.end(); await peak?.end(); await admin?.end(); });
  test('staff connect with PACA staff permissions: catalog, reads, workflows and writes follow view/edit; login is not rate limited', async () => {
    const perms = { students: { view: true, edit: false }, payments: { view: false, edit: false }, schedules: { view: true, edit: false } };
    await paca.query("INSERT INTO users(id,name,email,password_hash,role,academy_id,is_active,approval_status,permissions) VALUES (3,'Synthetic staff','staff@example.invalid',?,'staff',1,1,'approved',?),(4,'Synthetic pending','pending@example.invalid',?,'staff',1,1,'pending',NULL),(5,'Synthetic teacher','teacher@example.invalid',?,'teacher',1,1,'approved',NULL)",
      [bcrypt.hashSync(password, 4), JSON.stringify(perms), bcrypt.hashSync(password, 4), bcrypt.hashSync(password, 4)]);
    for (let i = 0; i < 12; i++) {
      const wrong = await request(server).post(base + '/token').send({ email: 'staff@example.invalid', password: 'wrong' });
      expect(wrong.status).toBe(401); expect(wrong.body.error.code).toBe('LOGIN_FAILED');
    }
    const pending = await request(server).post(base + '/token').send({ email: 'pending@example.invalid', password });
    expect(pending.status).toBe(403); expect(pending.body.error.message).toContain('승인되지 않은');
    const teacher = await request(server).post(base + '/token').send({ email: 'teacher@example.invalid', password });
    expect(teacher.status).toBe(403); expect(teacher.body.error.message).toContain('원장·관리자·직원');
    const login = await request(server).post(base + '/token').send({ email: 'staff@example.invalid', password, purpose: 'mcp' });
    expect(login.status).toBe(200);
    const staff = login.body.access_token;
    const sget = path => request(server).get(base + path).auth(staff, { type: 'bearer' });
    const spost = (path, body) => request(server).post(base + path).auth(staff, { type: 'bearer' }).send(body);
    expect((await sget('/identity')).body).toEqual(expect.objectContaining({ user_id: 3, academy_id: 1, role: 'staff' }));
    expect((await sget('/identity')).body.permissions).toBeUndefined();

    const catalogBody = (await sget('/paca/catalog')).body;
    const names = catalogBody.resources.map(r => r.resource);
    expect(names).toEqual(expect.arrayContaining(['students', 'attendance', 'peak_student_records']));
    expect(names).not.toContain('student_payments'); expect(names).not.toContain('users'); expect(names).not.toContain('salary_records');
    expect(catalogBody.commands.map(c => c.operation)).toEqual(expect.arrayContaining(['peak_record_create']));
    expect(catalogBody.commands.map(c => c.operation)).not.toContain('student_update');
    expect(catalogBody.commands.map(c => c.operation)).not.toContain('peak_exercise_pack_create');
    expect(catalogBody.workflows.map(w => w.name)).not.toContain('unpaid_list');

    const own = await sget('/paca/resources/students');
    expect(own.status).toBe(200); expect(own.body.items.map(s => s.id)).toContain(1); expect(own.body.items.map(s => s.id)).not.toContain(2);
    const denied = await sget('/paca/resources/student_payments');
    expect(denied.status).toBe(403); expect(denied.body.error).toEqual(expect.objectContaining({ code: 'PERMISSION_DENIED' }));
    expect(denied.body.error.message).toContain('학원비 조회');
    expect((await sget('/paca/resources/users')).status).toBe(403);
    expect((await sget('/peak/resources/students')).status).toBe(200);
    expect((await sget('/paca/workflows/unpaid_list?params=%7B%7D')).status).toBe(403);
    const brief = await sget('/paca/workflows/today_brief?params=%7B%7D');
    expect(brief.status).toBe(200); expect(brief.body.unpaid).toEqual({ hidden: true, reason: '파카 직원 권한 밖' });
    expect(brief.body.classes.hidden).toBeUndefined();

    const change = { operation: 'student_update', resource_id: 1, changes: { school: '직원고' } };
    const blocked = await spost('/paca/preview', change);
    expect(blocked.status).toBe(403); expect(blocked.body.error.message).toContain('학생 관리 수정');
    expect((await spost('/paca/preview', { operation: 'peak_exercise_pack_create', changes: { name: 'x', exercise_ids: [1] } })).status).toBe(403);
    // 원장이 학생 수정을 켜면 바로(재연결 없이) 되고, 미리보기 뒤 끄면 확인도 막힌다
    await paca.query('UPDATE users SET permissions=? WHERE id=3', [JSON.stringify({ ...perms, students: { view: true, edit: true } })]);
    const p = (await spost('/paca/preview', change)).body;
    expect(p.preview_token).toBeTruthy();
    await paca.query('UPDATE users SET permissions=? WHERE id=3', [JSON.stringify(perms)]);
    const late = await spost('/paca/confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true });
    expect(late.status).toBe(403);
    const [[student]] = await paca.query('SELECT school FROM students WHERE id=1');
    expect(student.school).not.toBe('직원고');
    await paca.query('UPDATE users SET permissions=? WHERE id=3', [JSON.stringify({ ...perms, students: { view: true, edit: true } })]);
    const applied = await spost('/paca/confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true });
    expect(applied.status).toBe(200); expect(applied.body.applied).toBe(true);
    await paca.query('UPDATE students SET school=NULL WHERE id=1');
    await paca.query('DELETE FROM users WHERE id IN (3,4,5)');
  });
});
