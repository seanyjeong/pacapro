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
const {open}=require('../../services/ilsanAdmissionCodec');
const router=require('../../routes/ilsanAdmissions');
const run=process.env.RUN_ILSAN_MYSQL==='1'?describe:describe.skip;

run('Ilsan admission HTTP and scheduled enrollment on isolated MySQL',()=>{
  let fixture,app,service;
  const token=id=>`Bearer ${jwt.sign({userId:id},process.env.JWT_SECRET)}`;
  const form=(name='합성 신규학생')=>({name,school:'합성고',grade:'고2',gender:'female',birth_six:'080229',phone:'01012345678',father_name:'합성아버지',father_phone:'01011112222',mother_name:'합성어머니',mother_phone:'01033334444',primary_parent:'mother',enrollment_date:'2026-10-20',consent:true});
  const terms=(date='2026-10-20')=>({enrollment_date:date,monthly_tuition:300000,discount_rate:10,class_days:[2,4],time_slot:'evening'});
  const http=(method,url,body,user=2)=>request(app)[method](`/paca/ilsan-admissions${url}`).set('Authorization',token(user)).send(body);
  const submit=(profile=form(),key=crypto.randomUUID())=>request(app).post('/paca/ilsan-admissions/submit').set('Idempotency-Key',key).send(profile);
  async function add(name) {const response=await submit(form(name));expect(response.status).toBe(200);const list=await http('get','/');return list.body.applications[0];}
  async function approve(id,value=terms()) {const preview=await http('post',`/${id}/preview`,value);expect(preview.status).toBe(200);return http('post',`/${id}/confirm`,{...value,preview_hash:preview.body.preview_hash});}
  async function counts(){const [[row]]=await mockPool.query('SELECT (SELECT COUNT(*) FROM students) students,(SELECT COUNT(*) FROM student_payments) payments,(SELECT COUNT(*) FROM attendance) attendance');return row;}
  beforeAll(async()=>{fixture=await createFixture();mockPool=fixture.pool;service=createAdmissionService(mockPool,()=>mockToday);app=express();app.use(express.json());app.use('/paca/ilsan-admissions',router);},30000);
  afterAll(async()=>{await fixture?.close();});
  beforeEach(async()=>{mockToday='2026-10-16';for(const table of ['ilsan_admission_applications','attendance','class_schedules','student_payments','students'])await mockPool.query(`DELETE FROM ${table}`);});

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
    expect((await request(app).get('/paca/ilsan-admissions')).status).toBe(401);
    expect((await http('get','/',undefined,1)).status).toBe(403);
    expect((await http('get','/',undefined,3)).status).toBe(403);
    expect((await http('get','/')).headers['cache-control']).toBe('no-store');
  });
  test('validates birth digits, consent, dates and staff identity without any write',async()=>{
    for(const change of [{birth_six:'0802291234567'},{consent:false},{enrollment_date:'2026-02-30'},{father_phone:'',mother_phone:''}])expect((await submit({...form(),...change})).status).toBe(422);
    await mockPool.query("UPDATE academies SET name='다른 교육원' WHERE id=2");
    expect((await submit()).status).toBe(503);
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
});
