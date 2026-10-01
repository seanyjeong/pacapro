/** Real MySQL, synthetic rows only. Requires an explicitly isolated port and database prefix. */
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

run('D-117 isolated MySQL transactions and delegation', () => {
  let paca, peak, admin, app, token, encrypt;
  const prefix = 'max_engine_full_test_';
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
        if (!catalog[key]) continue;
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
    await paca.query('DROP TABLE IF EXISTS max_engine_commands');
    await paca.query(fs.readFileSync(require.resolve('../../migrations/20260927_max_engine_commands.sql'), 'utf8'));
    process.env.MAX_ENGINE_LINK_SECRET = secret;
    process.env.DATA_ENCRYPTION_KEY = crypto.randomBytes(32).toString('hex');
    ({ encrypt } = require('../../services/maxEngineFullSecurity'));
    const hash = bcrypt.hashSync(password, 4);
    await paca.query("INSERT INTO academies(id,owner_user_id,name) VALUES (1,1,'Synthetic A'),(2,2,'Synthetic B')");
    await paca.query("INSERT INTO users(id,name,email,password_hash,role,academy_id,is_active,approval_status) VALUES (1,'Synthetic A','a@example.invalid',?,'owner',1,1,'approved'),(2,'Synthetic B','b@example.invalid',?,'owner',2,1,'approved')", [hash, hash]);
    await paca.query("INSERT INTO students(id,academy_id,name,phone,grade,class_days,weekly_count,monthly_tuition,status) VALUES (1,1,?,?,'고3','[]',0,0,'active'),(2,2,?,?,'고3','[]',0,0,'active')", [encrypt('합성가'),encrypt('000111'),encrypt('합성나'),encrypt('000222')]);
    app = express(); app.use(express.json()); app.use(base, require('../../routes/integrations/full'));
    const login = await request(app).post(base + '/token').send({ email: 'a@example.invalid', password });
    expect(login.status).toBe(200); expect(login.body.expires_in).toBe(2592000); token = login.body.access_token;
  });
  afterAll(async () => { await paca?.end(); await peak?.end(); await admin?.end(); });
  const get = path => request(app).get(base + path).auth(token, { type: 'bearer' });
  const post = (path, body) => request(app).post(base + path).auth(token, { type: 'bearer' }).send(body);
  const preview = command => post('/paca/preview', command);
  const confirm = p => post('/paca/confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true });

  test('30-day delegation remains valid after one hour and expires at its boundary', async () => {
    const jwt = require('jsonwebtoken');
    const claims = jwt.decode(token);
    expect(claims.exp - claims.iat).toBe(2592000);
    expect(claims.scope).toBe('business:read business:confirmed-write');
    const now = Math.floor(Date.now() / 1000);
    const identity = { ...claims };
    delete identity.iat; delete identity.exp;
    const aged = days => jwt.sign({ ...identity, iat: now - days * 86400 }, secret,
      { algorithm: 'HS256', expiresIn: 2592000 });
    for (const days of [2, 29]) {
      expect((await request(app).get(base + '/identity').auth(aged(days), { type: 'bearer' })).status).toBe(200);
    }
    expect((await request(app).get(base + '/identity').auth(aged(30), { type: 'bearer' })).status).toBe(401);
  });

  test('all allowlisted read resources execute; private columns never appear; other academy blocked', async () => {
    for (const key of Object.keys(catalog)) {
      const response = await get(`/${key.replace('.','/resources/')}`);
      expect({ key, status: response.status }).toEqual({ key, status: 200 });
    }
    const response = await get('/paca/resources/students');
    expect(response.body.items.map(s => s.id)).toEqual([1]);
    expect(response.body.items[0].name).toBe('합성가');
    expect((await get('/paca/resources/users')).body.items[0].password_hash).toBeUndefined();
    expect((await get('/paca/resources/nc_users')).status).toBe(404);
    expect((await get('/unknown')).body.error.code).toBe('NOT_FOUND');
    expect((await get('/paca/resources/students?filters=%7B%22academy_id%22%3A2%7D')).status).toBe(422);
    expect((await preview({ operation: 'student_update', resource_id: 2, changes: { school: 'x' } })).status).toBe(404);
  });
  test('PEAK cache must still match the current PACA academy; shared library remains readable', async () => {
    await peak.query("INSERT INTO students(id,academy_id,paca_student_id,name) VALUES(1,1,1,'synthetic own'),(2,1,2,'stale foreign'),(3,2,2,'foreign')");
    expect((await get('/peak/resources/students')).body.items.map(x=>x.id)).toEqual([1]);
    expect((await get('/peak/resources/paca_students')).body.items.map(x=>x.id)).toEqual([1]);
    await peak.query("INSERT INTO exercises(id,academy_id,name,is_system,tags) VALUES(1,NULL,'shared',0,'[]'),(2,2,'private',0,'[]')");
    expect((await get('/peak/resources/exercises')).body.items.map(x=>x.id)).toEqual([1]);
  });
  test('unknown writes, service key, ordinary JWT and prior read audience are rejected', async () => {
    expect((await post('/paca/preview', { operation: 'salary_pay', resource_id: 1, changes: {} })).status).toBe(403);
    expect((await post('/paca/preview', { operation: 'sms_send', changes: {} })).status).toBe(403);
    expect((await request(app).get('/full/identity').set('x-api-key', secret)).status).toBe(401);
    const old = require('jsonwebtoken').sign({ academy_id: 1, scope: 'students:read records:read' }, secret, { issuer: 'paca-max-engine', audience: 'max-engine-read', subject: '1' });
    expect((await request(app).get('/full/identity').auth(old,{type:'bearer'})).status).toBe(401);
  });
  test('preview does not mutate; partial update preserves omitted fields; concurrent confirm applies once', async () => {
    const p = await preview({ operation: 'student_update', resource_id: 1, changes: { school: '합성고' } });
    expect(p.status).toBe(200);
    expect((await paca.query('SELECT school FROM students WHERE id=1'))[0][0].school).toBeNull();
    const results = await Promise.all([confirm(p.body), confirm(p.body)]);
    expect(results.map(r => r.status)).toEqual([200,200]);
    expect(results[0].body).toEqual(results[1].body);
    const [rows] = await paca.query('SELECT school,phone FROM students WHERE id=1');
    expect(rows[0].school).toBe('합성고'); expect(rows[0].phone.startsWith('ENC:')).toBe(true);
    expect((await paca.query("SELECT COUNT(*) n FROM max_engine_commands WHERE operation='student_update'"))[0][0].n).toBe(1);
    expect(JSON.stringify((await paca.query('SELECT * FROM max_engine_commands'))[0])).not.toContain('합성고');
  });
  test('CAS, token tampering, identity/provider/key mismatch and preview expiration reject', async () => {
    const p = (await preview({ operation:'student_update',resource_id:1,changes:{memo:'new'} })).body;
    await paca.query("UPDATE students SET notes='changed by another editor' WHERE id=1");
    expect((await confirm(p)).status).toBe(409);
    expect((await confirm({...p,preview_token:'tampered'})).status).toBe(409);
    expect((await confirm({...p,idempotency_key:crypto.randomUUID()})).status).toBe(409);
    const {seal,unseal}=require('../../services/maxEngineFullSecurity');
    const old=unseal(p.preview_token);old.expires_at=1;
    expect((await confirm({...p,preview_token:seal(old)})).status).toBe(409);
    expect((await post('/peak/confirm',{...p,confirm:true})).status).toBe(422);
  });
  test('student and consultation registration are transactional and idempotent', async () => {
    const year=new Intl.DateTimeFormat('en',{year:'numeric',timeZone:'Asia/Seoul'}).format(new Date());
    await paca.query("INSERT INTO students(academy_id,name,phone,student_number,deleted_at,class_days,weekly_count,monthly_tuition,status) VALUES (1,?,?,?,NOW(),'[]',0,0,'active')",[encrypt('합성신규'),encrypt('000333'),year+'007']);
    const p = await preview({operation:'student_create',changes:{name:'합성신규',phone:'000333',grade:'고2',enrollment_date:'2026-09-27'}});
    expect(p.status).toBe(200);const c=await confirm(p.body);expect(c.status).toBe(200);
    const [[student]]=await paca.query('SELECT student_number FROM students WHERE id=?',[c.body.resource_id]);
    expect(student.student_number).toBe(year+'008');
    expect((await confirm(p.body)).body).toEqual(c.body);
    expect((await preview({operation:'student_create',changes:{name:'합성신규',phone:'000333',enrollment_date:'2026-09-27'}})).status).toBe(409);
    const cp=await preview({operation:'consultation_create',changes:{student_id:c.body.resource_id,preferred_date:'2026-09-28',preferred_time:'14:00',learning_type:'regular',admin_notes:'합성 상담'}});
    expect(cp.status).toBe(200);const cc=await confirm(cp.body);expect(cc.status).toBe(200);
    const [details]=await paca.query('SELECT consultation_id,student_id FROM student_consultations');
    expect(details).toEqual([{consultation_id:cc.body.resource_id,student_id:c.body.resource_id}]);
  });
  test('engine import creates prospect with source memo, no charge or attendance, and rejects missing phone', async () => {
    const missing=await preview({operation:'student_create',changes:{name:'합성예비생',enrollment_date:'2026-09-30',registration_source:'max_engine'}});
    expect(missing.status).toBe(422); expect(missing.body.error.message).toContain('전화번호');
    const p=await preview({operation:'student_create',changes:{name:'합성예비생',phone:'01099998888',enrollment_date:'2026-09-30',memo:'기존 엔진 메모',registration_source:'max_engine'}});
    expect(p.status).toBe(200);
    expect((await paca.query("SELECT COUNT(*) n FROM students WHERE status='prospect'"))[0][0].n).toBe(0);
    const created=await confirm(p.body); expect(created.status).toBe(200);
    const id=created.body.resource_id;
    const [[row]]=await paca.query('SELECT status,memo,monthly_tuition,weekly_count FROM students WHERE id=?',[id]);
    expect(row).toMatchObject({status:'prospect',memo:'엔진등록\n기존 엔진 메모',monthly_tuition:'0.00',weekly_count:0});
    expect((await paca.query('SELECT COUNT(*) n FROM student_payments WHERE student_id=?',[id]))[0][0].n).toBe(0);
    expect((await paca.query('SELECT COUNT(*) n FROM attendance WHERE student_id=?',[id]))[0][0].n).toBe(0);
    expect((await preview({operation:'student_create',changes:{name:'합성예비생',phone:'01099998888',enrollment_date:'2026-09-30',registration_source:'max_engine'}})).status).toBe(409);
  });
  test('detailed counseling records preserve omitted scores and enforce student scope', async () => {
    const p=await preview({operation:'consultation_record_create',changes:{student_id:1,consultation_date:'2026-09-27',consultation_type:'regular',school_grade_avg:3.5,physical_records:{standing_jump:250},general_memo:'original'}});
    expect(p.status).toBe(200);const created=await confirm(p.body);expect(created.status).toBe(200);
    const id=created.body.resource_id;
    const edit=await preview({operation:'consultation_record_update',resource_id:id,changes:{general_memo:'updated'}});
    expect(edit.status).toBe(200);expect((await confirm(edit.body)).status).toBe(200);
    const [[row]]=await paca.query('SELECT school_grade_avg,physical_records,general_memo FROM student_consultations WHERE id=?',[id]);
    expect(row.school_grade_avg).toBe('3.50');expect(row.physical_records).toEqual({standing_jump:250});expect(row.general_memo).toBe('updated');
    expect((await preview({operation:'consultation_record_create',changes:{student_id:2,consultation_date:'2026-09-27',consultation_type:'regular'}})).status).toBe(404);
  });
  test('attendance preserves trial lifecycle with no SMS queue writes', async () => {
    const today = new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Seoul'}).format(new Date());
    await paca.query("UPDATE students SET status='trial',is_trial=1,trial_remaining=1,trial_dates=? WHERE id=1",[JSON.stringify([{date:today,time_slot:'evening',attended:false}])]);
    await paca.query("INSERT INTO class_schedules(id,academy_id,class_date,time_slot) VALUES (1,1,?,'evening')",[today]);
    await paca.query('INSERT INTO attendance(id,class_schedule_id,student_id) VALUES(1,1,1)');
    const p=await preview({operation:'attendance_set',resource_id:1,changes:{attendance_status:'present'}});
    expect(p.status).toBe(200);expect((await confirm(p.body)).status).toBe(200);
    expect((await paca.query('SELECT status,is_trial,trial_remaining FROM students WHERE id=1'))[0][0]).toEqual({status:'pending',is_trial:0,trial_remaining:0});
    expect((await paca.query('SELECT COUNT(*) n FROM attendance_notification_queue'))[0][0].n).toBe(0);
  });
  test('payment and revenue commit once; failed ledger insert rolls back amount and command', async () => {
    await paca.query("INSERT INTO student_payments(id,student_id,academy_id,`year_month`,payment_type,base_amount,final_amount,paid_amount,due_date,payment_status) VALUES(1,1,1,'2026-09','monthly',10000,10000,0,'2026-09-27','pending')");
    const p=await preview({operation:'payment_pay',resource_id:1,changes:{paid_amount:'3000.50',payment_date:'2026-09-27',payment_method:'cash'}});
    expect(p.status).toBe(200);expect((await confirm(p.body)).status).toBe(200);expect((await confirm(p.body)).status).toBe(200);
    expect((await paca.query('SELECT paid_amount,payment_status FROM student_payments WHERE id=1'))[0][0]).toEqual({paid_amount:'3000.50',payment_status:'partial'});
    expect((await paca.query('SELECT COUNT(*) n FROM revenues'))[0][0].n).toBe(1);
    const retry=await preview({operation:'payment_pay',resource_id:1,changes:{paid_amount:'100',payment_date:'2026-09-27',payment_method:'cash'}});
    await paca.query("CREATE TRIGGER reject_revenue BEFORE INSERT ON revenues FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic ledger failure'");
    expect((await confirm(retry.body)).status).toBe(503);
    expect((await paca.query('SELECT paid_amount FROM student_payments WHERE id=1'))[0][0].paid_amount).toBe('3000.50');
    await paca.query('DROP TRIGGER reject_revenue');
    expect((await confirm(retry.body)).status).toBe(200);
    expect((await paca.query('SELECT paid_amount FROM student_payments WHERE id=1'))[0][0].paid_amount).toBe('3100.50');
  });
  test('cursor pagination covers every row once and filters cannot escape academy scope', async () => {
    const values=Array.from({length:101},(_,i)=>[1000+i,1,encrypt('synthetic '+i),'[]',0,0]);
    await paca.query('INSERT INTO students(id,academy_id,name,class_days,weekly_count,monthly_tuition) VALUES ?',[values]);
    const first=await get('/paca/resources/students');expect(first.body.items.length).toBe(100);expect(first.body.next_cursor).not.toBeNull();
    const second=await get('/paca/resources/students?cursor='+first.body.next_cursor);expect(second.body.next_cursor).toBeNull();
    const ids=[...first.body.items,...second.body.items].map(r=>r.id);expect(ids.length).toBe(104);expect(new Set(ids).size).toBe(104);expect(ids).not.toContain(2);
    const filtered=await get('/paca/resources/students?filters='+encodeURIComponent(JSON.stringify({id:2})));expect(filtered.body.items).toEqual([]);
  });
  test('account move, revoke, role downgrade and password change invalidate delegation immediately', async () => {
    for(const [column,value] of [['academy_id',2],['is_active',0],['approval_status','pending'],['role','teacher'],['password_hash','changed']]){
      const [[before]]=await paca.query(`SELECT \`${column}\` v FROM users WHERE id=1`);
      await paca.query(`UPDATE users SET \`${column}\`=? WHERE id=1`,[value]);
      expect([401,403]).toContain((await get('/identity')).status);
      await paca.query(`UPDATE users SET \`${column}\`=? WHERE id=1`,[before.v]);
    }
  });
});
