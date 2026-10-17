const crypto=require('crypto');
process.env.DATA_ENCRYPTION_KEY=crypto.randomBytes(32).toString('hex');
process.env.JWT_SECRET=crypto.randomBytes(32).toString('hex');
let mockPool, mockToday='2026-10-16';
jest.mock('../../config/database',()=>({
  getConnection:(...args)=>mockPool.getConnection(...args),query:(...args)=>mockPool.query(...args),
}));
jest.mock('../../utils/proratedPaymentDueDate',()=>({getKoreaDateText:()=>mockToday}));
jest.mock('../../utils/logger',()=>({error:jest.fn(),warn:jest.fn(),info:jest.fn()}));
const express=require('express'),request=require('supertest'),jwt=require('jsonwebtoken');
const {createFixture}=require('./ilsan-admission-fixture');
const {createAdmissionService}=require('../../services/ilsanAdmissionService');
const {open,seal}=require('../../services/ilsanAdmissionCodec');
const router=require('../../routes/ilsanAdmissions');
const {ilsanAdmissionFileCors}=require('../../middleware/ilsanAdmissionFileCors');
const run=process.env.RUN_ILSAN_MYSQL==='1'?describe:describe.skip;

run('Ilsan admission HTTP and scheduled enrollment on isolated MySQL',()=>{
  let fixture,app,server,service,caseIp=0;
  const token=id=>`Bearer ${jwt.sign({userId:id},process.env.JWT_SECRET)}`;
  const form=(name='합성 신규학생')=>({name,school:'합성고',grade:'고2',gender:'female',birth_six:'080229',phone:'01012345678',father_name:'합성아버지',father_phone:'01011112222',mother_name:'합성어머니',mother_phone:'01033334444',primary_parent:'mother',enrollment_date:'2026-10-20',consent:true});
  const terms=(date='2026-10-20')=>({enrollment_date:date,monthly_tuition:300000,discount_rate:10,class_days:[2,4],time_slot:'evening'});
  const http=async(method,url,body,user=2)=>{
    const result=await request(server)[method](`/paca/ilsan-admissions${url}`).set('Authorization',token(user)).send(body);
    if(result.status===401)throw new Error(`Synthetic authenticated request ${method} ${url}: ${result.body.message}`);
    return result;
  };
  const submit=(profile=form(),key=crypto.randomUUID())=>request(server).post('/paca/ilsan-admissions/submit').set('X-Forwarded-For',`192.0.2.${caseIp}`).set('Idempotency-Key',key).send(profile);
  async function add(name) {const response=await submit(form(name));expect(response.status).toBe(200);const list=await http('get','/');return list.body.applications[0];}
  async function approve(id,value=terms()) {const preview=await http('post',`/${id}/preview`,value);expect(preview.status).toBe(200);return http('post',`/${id}/confirm`,{...value,preview_hash:preview.body.preview_hash});}
  async function counts(){const [[row]]=await mockPool.query('SELECT (SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM student_payments) payments,(SELECT COUNT(*) FROM attendance) attendance');return row;}
  beforeAll(async()=>{fixture=await createFixture();mockPool=fixture.pool;service=createAdmissionService(mockPool,()=>mockToday);app=express();app.set('trust proxy',1);app.use(ilsanAdmissionFileCors,express.json());app.use('/paca/ilsan-admissions',router);
    // One loopback listener avoids ephemeral-port reuse across fast Supertest requests.
    server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
  },30000);
  afterAll(async()=>{if(server)await new Promise(resolve=>server.close(resolve));await fixture?.close();});
  beforeEach(async()=>{caseIp++;mockToday='2026-10-16';for(const table of ['ilsan_admission_applications','attendance','class_schedules','student_payments','students'])await mockPool.query(`DELETE FROM ${table}`);});

  test('share link requires current Ilsan membership and student-edit permission',async()=>{
    const {PUBLIC_FORM_PATH}=require('../../constants/ilsanAdmission');
    const allowed=await http('get','/share-link');
    expect(allowed.status).toBe(200);expect(allowed.body).toEqual({path:PUBLIC_FORM_PATH});
    expect(allowed.headers['cache-control']).toBe('no-store');
    expect((await request(server).get('/paca/ilsan-admissions/share-link')).status).toBe(401);
    for(const user of [1,3]) expect((await http('get','/share-link?academy_id=2',undefined,user)).status).toBe(403);
    await mockPool.execute('UPDATE users SET permissions=? WHERE id=3',[JSON.stringify({students:{view:true,edit:true}})]);
    try {expect((await http('get','/share-link',undefined,3)).status).toBe(200);}
    finally {await mockPool.execute('UPDATE users SET permissions=? WHERE id=3',[JSON.stringify({students:{view:true,edit:false}})]);}
    await mockPool.execute('UPDATE users SET academy_id=1 WHERE id=2');
    try {expect((await http('get','/share-link')).status).toBe(403);}
    finally {await mockPool.execute('UPDATE users SET academy_id=2 WHERE id=2');}
  });

  (process.env.PACA_ADMISSION_LINK_BASE_URL ? test : test.skip)('copied link opens anonymously and stores only in Ilsan via real HTTP and SQL',async()=>{
    const {verifyAdmissionLinkBrowser}=require('./ilsan-admission-link-browser');
    await verifyAdmissionLinkBrowser({app,pool:mockPool,token:token(2).slice(7),otherToken:token(1).slice(7),readerToken:token(3).slice(7)});
  },90000);

  test('public intake is encrypted, academy-fixed and idempotent; staff reads are authorized',async()=>{
    const key=crypto.randomUUID(),profile={...form(),academy_id:1,status:'active',monthly_tuition:1};
    const first=await submit(profile,key);expect(first.status).toBe(200);expect(first.body).not.toHaveProperty('profile');
    expect((await submit(profile,key)).body).toEqual(first.body);
    expect((await submit({...profile,name:'다른 학생'},key)).status).toBe(409);
    mockToday='2026-10-21';
    expect((await submit(profile,key)).body).toEqual(first.body);
    expect((await submit(profile)).status).toBe(422);
    mockToday='2026-10-16';
    const [[stored]]=await mockPool.query('SELECT * FROM ilsan_admission_applications');
    expect(stored.academy_id).toBe(2);expect(stored.profile_encrypted.startsWith('ENC:')).toBe(true);
    expect(stored.profile_encrypted).not.toContain(profile.name);
    expect(JSON.parse(open(stored.profile_encrypted))).not.toHaveProperty('monthly_tuition');
    expect(await counts()).toEqual({students:0,payments:0,attendance:0});
    expect((await request(server).get('/paca/ilsan-admissions')).status).toBe(401);
    expect((await http('get','/',undefined,1)).status).toBe(403);
    expect((await http('get','/',undefined,3)).status).toBe(403);
    expect((await http('get','/')).headers['cache-control']).toBe('no-store');
  });
  test('validates birth digits, consent, dates and staff identity without any write',async()=>{
    const ready=await request(server).get('/paca/ilsan-admissions/availability').set('Origin','null');
    expect(ready.body).toEqual({available:true,academy_name:'일산 맥스체대입시'});
    expect(ready.headers['access-control-allow-origin']).toBe('null');
    for(const change of [{birth_six:'0802291234567'},{consent:false},{enrollment_date:'2026-02-30'},{father_phone:'',mother_phone:''}])expect((await submit({...form(),...change})).status).toBe(422);
    await mockPool.query("UPDATE academies SET name='다른 교육원' WHERE id=2");
    expect((await submit()).status).toBe(503);
    expect((await request(server).get('/paca/ilsan-admissions/availability')).status).toBe(503);
    await mockPool.query("UPDATE academies SET name='일산 맥스체대입시' WHERE id=2");
    expect(await counts()).toEqual({students:0,payments:0,attendance:0});
  });
  test('future approval waits for the Korean registration date, enrolls once, preserves contacts and quoted fee',async()=>{
    const record=await add();const response=await approve(record.id);expect(response.status).toBe(200);expect(response.body.status).toBe('scheduled');
    expect(await service.activateDue()).toEqual({enrolled:0,review:0});expect(await counts()).toEqual({students:0,payments:0,attendance:0});
    mockToday='2026-10-20';await Promise.all([service.activateDue(),service.activateDue()]);
    expect(await counts()).toEqual({students:1,payments:1,attendance:4});
    const [[student]]=await mockPool.query('SELECT * FROM students');
    expect(student.status).toBe('active');expect(student.enrollment_date).toBe(mockToday);
    expect(open(student.father_name)).toBe('합성아버지');expect(open(student.mother_phone)).toBe('010-3333-4444');expect(open(student.parent_phone)).toBe('010-3333-4444');
    const [[bill]]=await mockPool.query('SELECT * FROM student_payments');
    expect(Number(bill.final_amount)).toBe(120000);expect(bill.year_month).toBe('2026-10');expect(bill.due_date).toBe(mockToday);
    expect(await service.activateDue()).toEqual({enrolled:0,review:0});
  });
  test('a changed date or stale approval hash cannot create an unintended bill',async()=>{
    const record=await add();const preview=await http('post',`/${record.id}/preview`,terms());
    const changed=await http('post',`/${record.id}/confirm`,{...terms('2026-10-22'),preview_hash:preview.body.preview_hash});expect(changed.status).toBe(409);
    expect((await approve(record.id)).status).toBe(200);
    expect((await http('post',`/${record.id}/confirm`,{...terms(),preview_hash:preview.body.preview_hash})).status).toBe(409);
    const changedAgain=await approve(record.id,terms('2026-10-22'));expect(changedAgain.body.quote.final_amount).toBe(90000);
    mockToday='2026-10-20';expect(await service.activateDue()).toEqual({enrolled:0,review:0});
    mockToday='2026-10-22';await service.activateDue();expect(await counts()).toEqual({students:1,payments:1,attendance:3});
  });
  test('same-day approval is atomic and replay does not duplicate students or bills',async()=>{
    const record=await add();const value=terms(mockToday);const preview=await http('post',`/${record.id}/preview`,value);
    const body={...value,preview_hash:preview.body.preview_hash};
    expect((await http('post',`/${record.id}/confirm`,body)).body.status).toBe('enrolled');
    expect((await http('post',`/${record.id}/confirm`,body)).status).toBe(409);
    expect(await counts()).toEqual({students:1,payments:1,attendance:4});
  });
  test('cancelled reservations never enroll; concurrent old revision is rejected',async()=>{
    const record=await add();const scheduled=await approve(record.id);
    expect((await http('post',`/${record.id}/cancel`,{revision:record.revision})).status).toBe(409);
    expect((await http('post',`/${record.id}/cancel`,{revision:scheduled.body.revision})).body.status).toBe('cancelled');
    mockToday='2026-10-20';await service.activateDue();expect(await counts()).toEqual({students:0,payments:0,attendance:0});
  });
  test('duplicate students created after approval are held for review',async()=>{
    const first=await add('동일 학생');await approve(first.id);
    const second=await add('동일 학생');await approve(second.id);
    mockToday='2026-10-20';const result=await service.activateDue();expect(result).toEqual({enrolled:1,review:1});
    expect(await counts()).toEqual({students:1,payments:1,attendance:4});
    const preview=await http('post',`/${second.id}/preview`,terms());expect(preview.body.duplicate_student_ids).toHaveLength(1);
    expect((await approve(second.id)).status).toBe(409);
  });
  test('storage failure rolls back student, bill, attendance and approval together',async()=>{
    const record=await add();
    await mockPool.query("CREATE TRIGGER reject_admission_attendance BEFORE INSERT ON attendance FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
    try{expect((await approve(record.id,terms(mockToday))).status).toBe(500);expect(await counts()).toEqual({students:0,payments:0,attendance:0});const [[row]]=await mockPool.query('SELECT status FROM ilsan_admission_applications WHERE id=?',[record.id]);expect(row.status).toBe('submitted');}
    finally{await mockPool.query('DROP TRIGGER reject_admission_attendance');}
  });
  test('zero remaining lessons create no bill; missed registration month requires new approval',async()=>{
    const record=await add();const value={...terms('2026-10-31'),class_days:[1]};await approve(record.id,value);
    mockToday='2026-10-31';await service.activateDue();expect(await counts()).toEqual({students:1,payments:0,attendance:0});
    mockToday='2026-10-16';const overdue=await add('지연 학생');await approve(overdue.id);
    mockToday='2026-11-01';expect(await service.activateDue()).toEqual({enrolled:0,review:1});
    const [[row]]=await mockPool.query('SELECT review_code FROM ilsan_admission_applications WHERE id=?',[overdue.id]);expect(row.review_code).toBe('ENROLLMENT_OVERDUE');
  });
  test('existing enrollment only fills blanks, preserves all other columns and supports later intake',async()=>{
    const original=await add('기존 학생');const registered=await approve(original.id,terms(mockToday));const studentId=registered.body.student_id;
    await mockPool.execute('UPDATE students SET father_name=NULL,father_phone=?,mother_name=?,school=NULL WHERE id=?',[seal('  '),seal('기존 어머니'),studentId]);
    const [[before]]=await mockPool.query('SELECT * FROM students WHERE id=?',[studentId]);const beforeCounts=await counts();
    const application=await add('기존 학생');
    const matches=await http('get',`/${application.id}/existing-students`);expect(matches.body.students).toHaveLength(1);expect(matches.body.students[0].exact_phone).toBe(true);
    const preview=await http('post',`/${application.id}/existing-preview`,{student_id:studentId});expect(preview.status).toBe(200);
    expect(preview.body.fields.filter(f=>f.action==='fill').map(f=>f.field).sort()).toEqual(['father_name','father_phone','school']);
    const body={student_id:studentId,preview_hash:preview.body.preview_hash};
    const result=await http('post',`/${application.id}/existing-confirm`,body);expect(result.status).toBe(200);expect(result.body.completion_kind).toBe('fill_missing');expect(result.body.student_id).toBe(studentId);
    const [[after]]=await mockPool.query('SELECT * FROM students WHERE id=?',[studentId]);
    expect(open(after.father_name)).toBe('합성아버지');expect(open(after.father_phone)).toBe('010-1111-2222');expect(after.school).toBe('합성고');
    for(const key of Object.keys(before).filter(k=>!['father_name','father_phone','school','updated_at'].includes(k)))expect(after[key]).toEqual(before[key]);
    expect(await counts()).toEqual(beforeCounts);expect((await http('post',`/${application.id}/existing-confirm`,body)).status).toBe(409);
    const later=await add('기존 학생'),next=await http('post',`/${later.id}/existing-preview`,{student_id:studentId});
    expect(next.body.fields.every(f=>f.action==='keep')).toBe(true);
    const completed=await http('post',`/${later.id}/existing-confirm`,{student_id:studentId,preview_hash:next.body.preview_hash});expect(completed.status).toBe(200);expect(completed.body.filled_fields).toEqual([]);
    expect(await counts()).toEqual(beforeCounts);
  });
  test('concurrent manual edits invalidate existing-student preview and never overwrite them',async()=>{
    const original=await add('변경 학생'),registered=await approve(original.id,terms(mockToday)),studentId=registered.body.student_id;
    await mockPool.execute('UPDATE students SET mother_phone=NULL WHERE id=?',[studentId]);
    const record=await add('변경 학생'),preview=await http('post',`/${record.id}/existing-preview`,{student_id:studentId});
    await mockPool.execute('UPDATE students SET mother_phone=? WHERE id=?',[seal('010-7777-8888'),studentId]);
    expect((await http('post',`/${record.id}/existing-confirm`,{student_id:studentId,preview_hash:preview.body.preview_hash})).status).toBe(409);
    const [[student]]=await mockPool.query('SELECT mother_phone FROM students WHERE id=?',[studentId]);expect(open(student.mother_phone)).toBe('010-7777-8888');
    const [[row]]=await mockPool.query('SELECT status FROM ilsan_admission_applications WHERE id=?',[record.id]);expect(row.status).toBe('submitted');
  });
  test('existing enrichment blocks foreign academies, deleted students, names and insufficient permissions',async()=>{
    const record=await add('범위 학생');
    const [other]=await fixture.insert('students',{academy_id:1,name:seal('범위 학생'),phone:seal('01012345678'),status:'active'});
    const [wrong]=await fixture.insert('students',{academy_id:2,name:seal('다른 이름'),phone:seal('01012345678'),status:'active'});
    const [deleted]=await fixture.insert('students',{academy_id:2,name:seal('범위 학생'),phone:seal('01012345678'),deleted_at:'2026-10-01',status:'active'});
    expect((await http('get',`/${record.id}/existing-students`)).body.students).toEqual([]);
    for(const [student_id,status] of [[other.insertId,404],[wrong.insertId,409],[deleted.insertId,404]])expect((await http('post',`/${record.id}/existing-preview`,{student_id})).status).toBe(status);
    for(const user of [1,3]){
      expect((await http('get',`/${record.id}/existing-students`,undefined,user)).status).toBe(403);
      expect((await http('post',`/${record.id}/existing-confirm`,{student_id:wrong.insertId,preview_hash:'x'},user)).status).toBe(403);
    }
    expect((await request(server).post(`/paca/ilsan-admissions/${record.id}/existing-confirm`).send({})).status).toBe(401);
  });
  test.each(['paused','withdrawn'])('missing-phone %s student can be selected explicitly without re-enrollment',async status=>{
    const [created]=await fixture.insert('students',{academy_id:2,name:seal('상태 학생'),phone:null,parent_phone:null,father_name:null,mother_name:null,father_phone:null,mother_phone:null,status,monthly_tuition:450000,class_days:'[1,3]'});
    const record=await add('상태 학생'),studentId=created.insertId;
    const candidates=await http('get',`/${record.id}/existing-students`);expect(candidates.body.students[0].exact_phone).toBe(false);
    const preview=await http('post',`/${record.id}/existing-preview`,{student_id:studentId});
    expect((await http('post',`/${record.id}/existing-confirm`,{student_id:studentId,preview_hash:preview.body.preview_hash})).status).toBe(200);
    const [[student]]=await mockPool.query('SELECT * FROM students WHERE id=?',[studentId]);expect(student.status).toBe(status);expect(Number(student.monthly_tuition)).toBe(450000);expect(typeof student.class_days==='string'?JSON.parse(student.class_days):student.class_days).toEqual([1,3]);expect(open(student.phone)).toBe('010-1234-5678');expect(open(student.parent_phone)).toBe('010-3333-4444');
    expect(await counts()).toEqual({students:1,payments:0,attendance:0});
  });
  test('enriching a previously scheduled application stops its future new enrollment',async()=>{
    const record=await add('예약 보완학생');expect((await approve(record.id)).status).toBe(200);
    const [created]=await fixture.insert('students',{academy_id:2,name:seal('예약 보완학생'),phone:null,status:'active'});
    const studentId=created.insertId,preview=await http('post',`/${record.id}/existing-preview`,{student_id:studentId});
    expect((await http('post',`/${record.id}/existing-confirm`,{student_id:studentId,preview_hash:preview.body.preview_hash})).status).toBe(200);
    mockToday='2026-10-20';expect(await service.activateDue()).toEqual({enrolled:0,review:0});
    expect(await counts()).toEqual({students:1,payments:0,attendance:0});
  });
  test('failed completion rolls back the existing-student changes too',async()=>{
    const [created]=await fixture.insert('students',{academy_id:2,name:seal('원복 학생'),phone:null,status:'active'});
    const record=await add('원복 학생'),studentId=created.insertId,preview=await http('post',`/${record.id}/existing-preview`,{student_id:studentId});
    await mockPool.query("CREATE TRIGGER reject_admission_completion BEFORE UPDATE ON ilsan_admission_applications FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
    try{expect((await http('post',`/${record.id}/existing-confirm`,{student_id:studentId,preview_hash:preview.body.preview_hash})).status).toBe(500);const [[student]]=await mockPool.query('SELECT phone FROM students WHERE id=?',[studentId]);expect(student.phone).toBeNull();}
    finally{await mockPool.query('DROP TRIGGER reject_admission_completion');}
  });
  test('downloaded tablet HTML submits to the real isolated API and safely retries a lost response',async()=>{
    const {chromium}=require('playwright'),path=require('path'),{pathToFileURL}=require('url');
    const server=await new Promise(resolve=>{const listener=app.listen(0,'127.0.0.1',()=>resolve(listener));});
    let browser;
    try {
      browser=await chromium.launch({executablePath:'/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',headless:true});
      const context=await browser.newContext({viewport:{width:800,height:1100},serviceWorkers:'block'});
      let ready=false,lost=false;const keys=[];
      await context.route('**/*',async route=>{
        const url=new URL(route.request().url());
        if(url.protocol==='file:'||url.protocol==='data:')return route.continue();
        if(url.origin!=='https://supermax.kr'||!url.pathname.startsWith('/paca/ilsan-admissions/'))return route.abort();
        // All configured production URLs terminate at this disposable loopback server.
        if(!ready)return route.fulfill({status:503,headers:{'access-control-allow-origin':'null'},json:{message:'합성 서버 준비 중'}});
        const response=await route.fetch({url:`http://127.0.0.1:${server.address().port}${url.pathname}`,
          headers:{...route.request().headers(),origin:'null','x-forwarded-for':'192.0.2.200'}});
        if(url.pathname.endsWith('/submit')&&route.request().method()==='POST'){
          keys.push(route.request().headers()['idempotency-key']);
          if(!lost){lost=true;expect(response.status()).toBe(200);return route.abort('failed');}
        }
        return route.fulfill({response});
      });
      const page=await context.newPage();
      await page.clock.install({time:new Date('2026-10-16T03:00:00Z')});
      await page.goto(pathToFileURL(path.resolve(__dirname,'../../../public/admissions/일산맥스_입학원서_접수용.html')).href);
      await page.getByRole('status').filter({hasText:'현재는 원서가 저장되지 않습니다.'}).waitFor();
      expect(await page.getByRole('button',{name:'입학원서 제출',exact:true}).isDisabled()).toBe(true);
      ready=true;await page.getByRole('button',{name:'연결 다시 확인',exact:true}).click();
      await page.getByRole('status').filter({hasText:'일산 교육원 접수 연결됨'}).waitFor();
      await page.locator('#admission-name').fill('합성 태블릿학생');await page.locator('#admission-school').fill('합성고');
      await page.getByLabel('학년',{exact:true}).selectOption('고2');await page.getByLabel('성별',{exact:true}).selectOption('female');
      await page.locator('#admission-birth').fill('080229');await page.locator('#admission-phone').fill('01012345678');
      await page.locator('#admission-mother-name').fill('합성 보호자');await page.locator('#admission-mother-phone').fill('01033334444');
      await page.locator('#admission-date').fill('2026-10-20');await page.locator('input[type="checkbox"]').check();
      await page.getByRole('button',{name:'입학원서 제출',exact:true}).click();
      await page.getByRole('alert').filter({hasText:'접수 여부가 확정되지 않습니다.'}).waitFor();
      expect(await page.locator('#admission-success').isVisible()).toBe(false);
      expect(await page.locator('#admission-name').inputValue()).toBe('합성 태블릿학생');
      await page.getByRole('button',{name:'입학원서 제출',exact:true}).click();
      await page.getByRole('heading',{name:'입학원서를 접수했습니다',exact:true}).waitFor();
      expect(keys).toHaveLength(2);expect(keys[0]).toBe(keys[1]);
      const [[row]]=await mockPool.query('SELECT COUNT(*) count FROM ilsan_admission_applications');expect(row.count).toBe(1);
      expect(await counts()).toEqual({students:0,payments:0,attendance:0});
      expect(await page.locator('#admission-name').inputValue()).toBe('');
      expect(await page.evaluate(()=>localStorage.length)).toBe(0);
      await page.getByRole('button',{name:'다음 학생 원서 작성',exact:true}).click();
      expect(await page.locator('#admission-name').inputValue()).toBe('');
      await page.getByRole('status').filter({hasText:'일산 교육원 접수 연결됨'}).waitFor();
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1)).toBe(true);
    } finally {await browser?.close();await new Promise(resolve=>server.close(resolve));}
  },30000);
});
