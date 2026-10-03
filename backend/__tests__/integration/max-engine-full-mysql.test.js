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
  let paca, peak, admin, app, server, token, encrypt;
  const originalDbName = process.env.DB_NAME;
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
  const get = path => request(server).get(base + path).auth(token, { type: 'bearer' });
  const post = (path, body) => request(server).post(base + path).auth(token, { type: 'bearer' }).send(body);
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
      expect((await request(server).get(base + '/identity').auth(aged(days), { type: 'bearer' })).status).toBe(200);
    }
    expect((await request(server).get(base + '/identity').auth(aged(30), { type: 'bearer' })).status).toBe(401);
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
    expect((await request(server).get('/full/identity').set('x-api-key', secret)).status).toBe(401);
    const old = require('jsonwebtoken').sign({ academy_id: 1, scope: 'students:read records:read' }, secret, { issuer: 'paca-max-engine', audience: 'max-engine-read', subject: '1' });
    expect((await request(server).get('/full/identity').auth(old,{type:'bearer'})).status).toBe(401);
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
  test.each([
    ['both', { father_phone:'01012345678',mother_phone:' 010-8765-4321 ' }, '010-1234-5678','010-8765-4321'],
    ['father', { father_phone:'01012345678' }, '010-1234-5678',null],
    ['mother', { mother_phone:'01087654321' }, null,'010-8765-4321'],
    ['blank', { father_phone:'',mother_phone:' ' }, null,null],
    ['null', { father_phone:null,mother_phone:null }, null,null],
    ['legacy', {}, null,null],
  ])('engine parent phones %s: preview is read-only and confirmation stores encrypted optional fields', async (name, contacts, father, mother) => {
    const [[before]] = await paca.query('SELECT COUNT(*) n FROM students');
    const p = await preview({operation:'student_create',changes:{name:'합성부모'+name,
      phone:'01099998877',enrollment_date:'2026-10-02',registration_source:'max_engine',
      parent_phone:'010-2222-3333',...contacts}});
    expect(p.status).toBe(200);
    expect((await paca.query('SELECT COUNT(*) n FROM students'))[0][0].n).toBe(before.n);
    const created = await confirm(p.body); expect(created.status).toBe(200);
    expect((await confirm(p.body)).body).toEqual(created.body);
    const [[row]] = await paca.query('SELECT status,parent_phone,father_phone,mother_phone FROM students WHERE id=?',[created.body.resource_id]);
    expect(row.status).toBe('prospect');
    const {decryptStudentParentContacts}=require('../../services/studentParentContactService');
    expect(decryptStudentParentContacts(row)).toMatchObject({father_phone:father,mother_phone:mother});
    expect(require('../../services/maxEngineFullSecurity').decrypt(row.parent_phone)).toBe('010-2222-3333');
    for (const field of ['father_phone','mother_phone']) if(row[field]!==null) expect(row[field]).toMatch(/^ENC:/);
  });
  test('engine phone edit preserves omitted fields and representative phone; blanks clear only supplied fields', async () => {
    const create = await preview({operation:'student_create',changes:{name:'합성부분수정',phone:'01088887777',
      enrollment_date:'2026-10-02',registration_source:'max_engine',parent_phone:'010-2222-3333',
      father_phone:'01012345678',mother_phone:'01087654321'}});
    const created=await confirm(create.body); expect(created.status).toBe(200);
    const id=created.body.resource_id;
    const [[before]]=await paca.query('SELECT father_phone,mother_phone,parent_phone FROM students WHERE id=?',[id]);
    const p=await preview({operation:'student_update',resource_id:id,changes:{father_phone:''}});
    expect(p.status).toBe(200); expect(p.body.before.father_phone).toBe('010-1234-5678');
    expect(p.body.after.father_phone).toBeNull();
    expect((await paca.query('SELECT father_phone FROM students WHERE id=?',[id]))[0][0].father_phone).toBe(before.father_phone);
    expect((await confirm(p.body)).status).toBe(200);
    const [[after]]=await paca.query('SELECT father_phone,mother_phone,parent_phone FROM students WHERE id=?',[id]);
    expect(after).toEqual({...before,father_phone:null});
    const legacy=await preview({operation:'student_update',resource_id:id,changes:{school:'합성고'}});
    expect((await confirm(legacy.body)).status).toBe(200);
    expect((await paca.query('SELECT father_phone,mother_phone,parent_phone FROM students WHERE id=?',[id]))[0][0]).toEqual(after);
    const clear=await preview({operation:'student_update',resource_id:id,changes:{mother_phone:null}});
    expect((await confirm(clear.body)).status).toBe(200);
    expect((await paca.query('SELECT mother_phone FROM students WHERE id=?',[id]))[0][0].mother_phone).toBeNull();
  });
  test.each(['father_phone','mother_phone'])('malformed %s registration and editing fail before a write', async field => {
    const [[before]]=await paca.query('SELECT COUNT(*) n FROM students');
    for (const command of [
      {operation:'student_create',changes:{name:'합성오류',phone:'01022223333',enrollment_date:'2026-10-02',[field]:'invalid'}},
      {operation:'student_update',resource_id:1,changes:{[field]:'invalid'}},
    ]) {
      const p=await preview(command); expect(p.status).toBe(422);
      expect(p.body.error.message).toContain(field==='father_phone'?'아버지 전화번호':'어머니 전화번호');
    }
    expect((await paca.query('SELECT COUNT(*) n FROM students'))[0][0].n).toBe(before.n);
  });
  test('account move, revoke, role downgrade and password change invalidate delegation immediately', async () => {
    for(const [column,value] of [['academy_id',2],['is_active',0],['approval_status','pending'],['role','teacher'],['password_hash','changed']]){
      const [[before]]=await paca.query(`SELECT \`${column}\` v FROM users WHERE id=1`);
      await paca.query(`UPDATE users SET \`${column}\`=? WHERE id=1`,[value]);
      expect([401,403]).toContain((await get('/identity')).status);
      await paca.query(`UPDATE users SET \`${column}\`=? WHERE id=1`,[before.v]);
    }
  });
  test('withdrawal is preview-only then atomic; preserves invoices, past and checked future attendance; return is idempotent', async () => {
    await paca.query("INSERT INTO students(id,academy_id,name,class_days,weekly_count,monthly_tuition,status) VALUES(600,1,'Synthetic lifecycle','[]',0,0,'active')");
    const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0,10);
    const future = new Date(day + 'T00:00:00Z'); future.setUTCDate(future.getUTCDate() + 1);
    const past = new Date(day + 'T00:00:00Z'); past.setUTCDate(past.getUTCDate() - 1);
    await paca.query("INSERT INTO class_schedules(id,academy_id,class_date,time_slot) VALUES(600,1,?,'morning'),(601,1,?,'morning'),(602,1,?,'morning')", [day, future.toISOString().slice(0,10), past.toISOString().slice(0,10)]);
    await paca.query("INSERT INTO attendance(id,student_id,class_schedule_id,attendance_status) VALUES(600,600,600,'present'),(601,600,601,NULL),(602,600,601,'present'),(603,600,602,'present')");
    await paca.query("INSERT INTO student_payments(id,academy_id,student_id,`year_month`,base_amount,final_amount,payment_status,due_date) VALUES(600,1,600,'2026-10',100,100,'pending','2026-10-03')");
    const p = await preview({operation:'student_withdraw',resource_id:600,changes:{withdrawal_date:day,reason:'이사'}});
    expect(p.status).toBe(200); expect(p.body.after.related.attendance_to_remove.map(r=>r.id)).toEqual([600,601]);
    expect((await paca.query('SELECT status FROM students WHERE id=600'))[0][0].status).toBe('active');
    await paca.query("CREATE TRIGGER block_withdrawal BEFORE DELETE ON attendance FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic attendance failure'");
    try { expect((await confirm(p.body)).status).toBe(503);
      expect((await paca.query('SELECT status FROM students WHERE id=600'))[0][0].status).toBe('active');
      expect((await paca.query('SELECT COUNT(*) n FROM attendance WHERE student_id=600'))[0][0].n).toBe(4);
    } finally { await paca.query('DROP TRIGGER block_withdrawal'); }
    const results = await Promise.all([confirm(p.body), confirm(p.body)]); expect(results.map(r=>r.status)).toEqual([200,200]);
    const c = results[0]; expect(results[1].body).toEqual(c.body);
    expect((await paca.query('SELECT id FROM attendance WHERE student_id=600 ORDER BY id'))[0].map(r=>r.id)).toEqual([602,603]);
    expect((await paca.query('SELECT payment_status FROM student_payments WHERE id=600'))[0][0].payment_status).toBe('pending');
    const ret = await preview({operation:'student_reactivate',resource_id:600,changes:{}}); expect(ret.status).toBe(200);
    expect((await confirm(ret.body)).status).toBe(200);
    expect((await paca.query('SELECT status,withdrawal_reason FROM students WHERE id=600'))[0][0]).toMatchObject({status:'active',withdrawal_reason:'이사'});
    expect((await paca.query('SELECT COUNT(*) n FROM student_payments WHERE student_id=600'))[0][0].n).toBe(1);
  });
  test('withdrawal refuses a stale preview after another attendance editor changes a related reservation', async () => {
    const day = new Date(Date.now() + 9 * 3600 * 1000).toISOString().slice(0,10);
    await paca.query("INSERT INTO attendance(id,student_id,class_schedule_id) VALUES(604,600,601)");
    const p = await preview({operation:'student_withdraw',resource_id:600,changes:{withdrawal_date:day}}); expect(p.status).toBe(200);
    await paca.query("UPDATE attendance SET attendance_status='present' WHERE id=604");
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    expect((await paca.query('SELECT status FROM students WHERE id=600'))[0][0].status).toBe('active');
  });
  test('PACA connection reads PEAK resources with the same current-student academy checks', async () => {
    const own = await get('/paca/resources/peak_students'); expect(own.status).toBe(200);
    expect(own.body.items.map(s=>s.id)).toEqual([1]);
    expect((await get('/peak/resources/paca_student_payments')).status).toBe(200);
    expect((await get('/paca/catalog')).body.commands).toEqual(expect.arrayContaining([expect.objectContaining({operation:'peak_record_create',source:'peak'})]));
  });
  test('PEAK record create/update/delete uses PEAK ledger and blocks foreign, stale-linked and out-of-range rows', async () => {
    await peak.query("INSERT INTO record_types(id,academy_id,name,unit,direction,is_active,min_value,max_value) VALUES(600,1,'제멀','cm','higher',1,1,400),(601,2,'외부','cm','higher',1,1,400)");
    const command = {operation:'peak_record_create',changes:{student_id:1,record_type_id:600,measured_at:'2026-10-03',value:'250.00',notes:'keep'}};
    for(const changes of [{student_id:2},{record_type_id:601},{value:'400.01'}]) expect([404,422]).toContain((await preview({...command,changes:{...command.changes,...changes}})).status);
    const p=await preview(command);expect(p.status).toBe(200);
    expect((await peak.query('SELECT COUNT(*) n FROM student_records WHERE record_type_id=600'))[0][0].n).toBe(0);
    const results=await Promise.all([confirm(p.body),confirm(p.body)]);expect(results.map(r=>r.status)).toEqual([200,200]);expect(results[0].body).toEqual(results[1].body);
    const id=results[0].body.resource_id;
    expect((await peak.query("SELECT COUNT(*) n FROM max_engine_commands WHERE operation='peak_record_create'"))[0][0].n).toBe(1);
    expect((await paca.query("SELECT COUNT(*) n FROM max_engine_commands WHERE operation='peak_record_create'"))[0][0].n).toBe(0);
    expect((await preview(command)).body.error.code).toBe('PEAK_DUPLICATE');
    const edit=await preview({operation:'peak_record_update',resource_id:id,changes:{notes:null}});expect(edit.status).toBe(200);
    expect((await Promise.all([confirm(edit.body), confirm(edit.body)])).map(r=>r.status)).toEqual([200,200]);
    expect((await peak.query('SELECT value,notes FROM student_records WHERE id=?',[id]))[0][0]).toEqual({value:'250.00',notes:null});
    const stale=await preview({operation:'peak_record_update',resource_id:id,changes:{value:'260'}});expect(stale.status).toBe(200);
    await paca.query('UPDATE students SET academy_id=2 WHERE id=1');
    expect((await confirm(stale.body)).status).toBe(404);
    await paca.query('UPDATE students SET academy_id=1 WHERE id=1');
    const del=await preview({operation:'peak_record_delete',resource_id:id,changes:{reason:'오입력'}});expect(del.status).toBe(200);
    expect((await confirm(del.body)).status).toBe(200);expect((await confirm(del.body)).status).toBe(200);
    expect((await peak.query('SELECT * FROM student_records WHERE id=?',[id]))[0]).toEqual([]);
  });
  test('PEAK business write and idempotency ledger roll back together; exact same receipt can retry', async () => {
    const p=await preview({operation:'peak_record_create',changes:{student_id:1,record_type_id:600,measured_at:'2026-10-04',value:'255'}});expect(p.status).toBe(200);
    await peak.query("CREATE TRIGGER block_ledger BEFORE INSERT ON max_engine_commands FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic ledger failure'");
    try { expect((await confirm(p.body)).status).toBe(503);
      expect((await peak.query("SELECT COUNT(*) n FROM student_records WHERE measured_at='2026-10-04'"))[0][0].n).toBe(0);
    } finally { await peak.query('DROP TRIGGER block_ledger'); }
    expect((await confirm(p.body)).status).toBe(200);
  });
  test('PEAK plans support incremental exercises, explicit completion and synthetic training logs', async () => {
    const created=await preview({operation:'peak_plan_create',changes:{date:'2026-10-03',time_slot:'evening',instructor_id:-1,description:'plan'}});expect(created.status).toBe(200);
    const confirmed=await confirm(created.body);expect(confirmed.status).toBe(200);const id=confirmed.body.resource_id;
    expect((await preview({operation:'peak_plan_create',changes:{date:'2026-10-03',time_slot:'evening',instructor_id:-1}})).status).toBe(409);
    expect((await preview({operation:'peak_plan_create',changes:{date:'2026-10-03',time_slot:'evening',instructor_id:-2}})).status).toBe(404);
    await peak.query("INSERT INTO exercises(id,academy_id,name,tags) VALUES(600,1,'스쿼트','[]'),(601,2,'외부운동','[]')");
    expect((await preview({operation:'peak_plan_exercise_add',resource_id:id,changes:{exercise_id:601}})).status).toBe(404);
    for (const command of [
      {operation:'peak_plan_exercise_add',changes:{exercise_id:600,sets:3,reps:10}},
      {operation:'peak_plan_exercise_complete',changes:{exercise_id:600,completed:true}},
      {operation:'peak_plan_update',changes:{description:'edited'}},
    ]) { const p=await preview({...command,resource_id:id});expect(p.status).toBe(200);expect((await confirm(p.body)).status).toBe(200);expect((await confirm(p.body)).status).toBe(200); }
    const [[plan]]=await peak.query('SELECT * FROM daily_plans WHERE id=?',[id]);expect(typeof plan.completed_exercises === 'string' ? JSON.parse(plan.completed_exercises) : plan.completed_exercises).toEqual([600]);expect(plan.description).toBe('edited');
    const log=await preview({operation:'peak_training_create',changes:{date:'2026-10-03',student_id:1,trainer_id:-1,plan_id:id,condition_score:4,temperature:0,humidity:0,notes:'preserve'}});expect(log.status).toBe(200);
    const lc=await confirm(log.body);expect(lc.status).toBe(200);
    const edit=await preview({operation:'peak_training_update',resource_id:lc.body.resource_id,changes:{condition_score:5}});expect(edit.status).toBe(200);expect((await confirm(edit.body)).status).toBe(200);
    expect((await peak.query('SELECT condition_score,notes,temperature,humidity FROM training_logs WHERE id=?',[lc.body.resource_id]))[0][0]).toEqual({condition_score:5,notes:'preserve',temperature:'0.0',humidity:0});
    const remove=await preview({operation:'peak_plan_exercise_remove',resource_id:id,changes:{exercise_id:600}});expect(remove.status).toBe(200);expect((await confirm(remove.body)).status).toBe(200);
    const [[after]]=await peak.query('SELECT exercises,completed_exercises FROM daily_plans WHERE id=?',[id]);expect(typeof after.exercises === 'string' ? JSON.parse(after.exercises) : after.exercises).toEqual([]);expect(typeof after.completed_exercises === 'string' ? JSON.parse(after.completed_exercises) : after.completed_exercises).toEqual([]);
  });

  test('PEAK reads PACA instructor scope, rejects mismatched training plans, and binds receipts to the connection provider', async () => {
    await paca.query("INSERT INTO instructors(id,academy_id,name,salary_type,status) VALUES(600,1,'Synthetic teacher','hourly','active'),(601,2,'Synthetic foreign','hourly','active')");
    const changes={date:'2026-10-05',time_slot:'morning',instructor_id:600};
    expect((await post('/peak/preview',{operation:'peak_plan_create',changes:{...changes,instructor_id:601}})).status).toBe(404);
    const p=await post('/peak/preview',{operation:'peak_plan_create',changes});expect(p.status).toBe(200);
    expect((await confirm(p.body)).body.error.code).toBe('PREVIEW_MISMATCH');
    const c=await post('/peak/confirm',{preview_token:p.body.preview_token,idempotency_key:p.body.idempotency_key,confirm:true});expect(c.status).toBe(200);
    const log=await preview({operation:'peak_training_create',changes:{date:'2026-10-06',student_id:1,trainer_id:600,plan_id:c.body.resource_id}});
    expect(log.body.error.code).toBe('PEAK_PLAN_MISMATCH');
    const record=await preview({operation:'peak_record_update',resource_id:(await peak.query("SELECT id FROM student_records WHERE measured_at='2026-10-04'"))[0][0].id,changes:{value:'265'}});
    expect(record.status).toBe(200);await peak.query('UPDATE record_types SET max_value=260 WHERE id=600');
    expect((await confirm(record.body)).body.error.code).toBe('SOURCE_CHANGED');
  });

});
