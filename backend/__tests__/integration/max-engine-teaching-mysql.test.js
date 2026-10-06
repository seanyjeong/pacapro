/** Authenticated HTTP, actual MySQL, only synthetic fixtures on an explicitly isolated port. */
jest.mock('../../config/database', () => global.__teaching.paca);
jest.mock('../../config/peak-database', () => global.__teaching.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const express = require('express');
const request = require('supertest');
const fs = require('fs');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('lesson preparation, structured exercises and class assignment', () => {
  let f, server, token;
  const original = { ...process.env };
  beforeAll(async () => {
    f = await fixture(); global.__teaching = f;
    process.env.DB_NAME = 'max_engine_eff_test_paca';
    await f.paca.execute("UPDATE instructors SET status='active' WHERE id=1");
    await f.peak.execute('UPDATE record_types SET is_active=1');
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20260927_max_engine_commands.sql'), 'utf8'));
    for (const sql of fs.readFileSync(require.resolve('../../migrations/20261003_peak_max_engine_commands.sql'), 'utf8')
      .replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await f.peak.query(sql);
    await f.peak.query('ALTER TABLE class_instructors ADD UNIQUE KEY source_unique (date,time_slot,class_num,instructor_id)');
    await f.insert('paca', 'instructors', { id: 2, academy_id: 1, name: f.encrypt('합성보조'), status: 'active' });
    await f.insert('paca', 'instructors', { id: 3, academy_id: 2, name: f.encrypt('다른교육원'), status: 'active' });
    await f.insert('paca', 'instructors', { id: 4, academy_id: 1, name: f.encrypt('미등록'), status: 'active' });
    for (const id of [1, 2]) await f.insert('paca', 'instructor_schedules', { id, academy_id: 1,
      instructor_id: id, work_date: f.date, time_slot: 'afternoon', scheduled_start_time: '14:00:00', scheduled_end_time: '18:00:00' });
    for (const id of [1,2,3,8]) await f.insert('peak', 'daily_assignments', { id, academy_id: 1, date: f.date,
      time_slot: 'afternoon', student_id: id, paca_attendance_id: id, is_trial: id === 8 ? 1 : 0, status: id === 8 ? 'trial' : 'enrolled' });
    await f.insert('peak', 'daily_assignments', { id: 90, academy_id: 1, date: f.date, time_slot: 'afternoon', student_id: 90 });
    await f.paca.execute("UPDATE students SET status='pending' WHERE id=8");
    for (const [id, academy, name] of [[1, 1, '준비운동'],[2,null,'점프'],[3,2,'외부운동']]) {
      await f.insert('peak', 'exercises', { id, academy_id: academy, name, default_sets: 3, default_reps: 5, tags: '[]' });
    }
    const app = express(); app.use(express.json()); app.use('/full', require('../../routes/integrations/full'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const login = await request(server).post('/full/token').send({ email: 'a@example.invalid', password: 'synthetic' });
    expect(login.status).toBe(200); token = login.body.access_token;
  });
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await f?.close(); process.env = original; });
  const get = path => request(server).get('/full' + path).auth(token, { type: 'bearer' });
  const post = (path, body) => request(server).post('/full' + path).auth(token, { type: 'bearer' }).send(body);
  const preview = body => post('/peak/preview', body);
  const confirm = p => post('/peak/confirm', { preview_token: p.preview_token, idempotency_key: p.idempotency_key, confirm: true });
  const setup = extra => ({ operation: 'peak_class_setup_create', changes: { date: f.date, time_slot: 'afternoon', class_num: 1,
    instructor_id: 1, assistant_instructor_ids: [2], assignment_ids: [1,3,8], exercises: [{ exercise_id: 1 }, { exercise_id: 2, sets: 4 }], ...extra } });
  async function clear() {
    for (const table of ['class_instructors','daily_plans','max_engine_commands']) await f.peak.query(`DELETE FROM ${table}`);
    await f.paca.query('DELETE FROM max_engine_commands');
    await f.peak.query('UPDATE daily_assignments SET class_id=NULL');
  }
  beforeEach(clear);
  test('context shows real eligible teachers/roster/plans/actual exercise and measurement catalogs, without writes', async () => {
    const r = await get('/peak/workflows/teaching_context?params=' + encodeURIComponent(JSON.stringify({ date: f.date, time_slot: 'afternoon' })));
    expect(r.status).toBe(200); expect(r.body.next_class_num).toBe(1);
    expect(r.body.instructors.items.filter(i => i.available).map(i => i.instructor_id)).toEqual([-1,1,2]);
    expect(r.body.instructors.items.find(i => i.instructor_id === 4).unavailable_reason).toMatch('근무 일정');
    expect(r.body.students.items.map(s => s.assignment_id)).toEqual([1,2,3,8]);
    expect(r.body.students.items.find(s => s.assignment_id === 2).assignable).toBe(false);
    expect(r.body.students.items.find(s => s.assignment_id === 8).assignable).toBe(true);
    expect(r.body.exercises.items.map(e => e.id)).toEqual([1,2]); expect(r.body.record_types.items[0].unit).toBe('cm');
    expect(JSON.stringify(r.body)).not.toMatch(/ENC:|bank_name|salary|phone|birth_date/);
    expect((await f.peak.query('SELECT COUNT(*) n FROM daily_plans'))[0][0].n).toBe(0);
    expect((await get('/peak/workflows/teaching_context?params=%7B%7D')).status).toBe(422);
    expect((await get('/paca/workflows/peak_teaching_context?params=' + encodeURIComponent(JSON.stringify({ date:f.date,time_slot:'afternoon' })))).status).toBe(200);
  });
  test('one preview and confirmation atomically saves teachers, selected students and ordered actual exercises; retry applies once', async () => {
    const snapshot = (await f.paca.query('SELECT * FROM instructor_schedules ORDER BY id'))[0];
    const p = await preview(setup()); expect(p.status).toBe(200);
    expect(p.body.after.plan.exercises.map(e => e.name)).toEqual(['준비운동','점프']);
    expect((await f.peak.query('SELECT COUNT(*) n FROM class_instructors'))[0][0].n).toBe(0);
    const result = await confirm(p.body); expect(result.status).toBe(200);
    expect((await confirm(p.body)).body).toEqual(result.body);
    const [teachers] = await f.peak.query('SELECT instructor_id,is_main FROM class_instructors ORDER BY order_num');
    expect(teachers).toEqual([{ instructor_id:1,is_main:1 },{ instructor_id:2,is_main:0 }]);
    const [plans] = await f.peak.query('SELECT * FROM daily_plans'); expect(plans).toHaveLength(1);
    const exercises = typeof plans[0].exercises === 'string' ? JSON.parse(plans[0].exercises) : plans[0].exercises;
    expect(exercises).toHaveLength(2); expect(exercises[1]).toMatchObject({ exercise_id:2,name:'점프',sets:4,reps:5 });
    expect((await f.peak.query('SELECT id FROM daily_assignments WHERE class_id=1 ORDER BY id'))[0].map(r=>r.id)).toEqual([1,3,8]);
    expect((await f.paca.query('SELECT * FROM instructor_schedules ORDER BY id'))[0]).toEqual(snapshot);
  });
  test('missing schedule, foreign ids, absent students, nonempty target and duplicate roles fail safely', async () => {
    for (const changes of [{ instructor_id:4 },{ instructor_id:3 },{ assignment_ids:[90] },{ assignment_ids:[2] },
      { assistant_instructor_ids:[1] },{ exercises:[{ exercise_id:3 }] }]) {
      const r = await preview(setup(changes)); expect([404,409,422]).toContain(r.status);
    }
    await f.insert('peak','class_instructors',{academy_id:1,date:f.date,time_slot:'afternoon',class_num:1,instructor_id:-1,is_main:1});
    expect((await preview(setup())).body.error.code).toBe('PEAK_CLASS_EXISTS');
  });
  test('source changes between preview and confirm invalidate the whole proposal', async () => {
    const p = await preview(setup()); expect(p.status).toBe(200);
    await f.paca.query("UPDATE attendance SET attendance_status='absent' WHERE id=1");
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    expect((await f.peak.query('SELECT COUNT(*) n FROM class_instructors'))[0][0].n).toBe(0);
    await f.paca.query("UPDATE attendance SET attendance_status='present' WHERE id=1");
  });
  test('failure writing a plan rolls back all teacher/student assignment and command ledger', async () => {
    const p = await preview(setup()); expect(p.status).toBe(200);
    await f.peak.query("CREATE TRIGGER synthetic_plan_failure BEFORE INSERT ON daily_plans FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT='synthetic failure'");
    try {
      expect((await confirm(p.body)).status).toBe(503);
      for (const table of ['class_instructors','daily_plans','max_engine_commands']) expect((await f.peak.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n).toBe(0);
      expect((await f.peak.query('SELECT COUNT(*) n FROM daily_assignments WHERE class_id IS NOT NULL'))[0][0].n).toBe(0);
    } finally { await f.peak.query('DROP TRIGGER synthetic_plan_failure'); }
  });
  test('empty description-only plan accepts ordered additions/partial edit while retaining completion and other metadata', async () => {
    await f.insert('peak','daily_plans',{id:50,academy_id:1,date:f.date,time_slot:'afternoon',instructor_id:1,trainer_id:1,
      description:'원래 설명',tags:'["보존"]',exercises:'[]',completed_exercises:'[]',extra_exercises:'[{"id":99}]',exercise_times:'{}'});
    let p = await preview({operation:'peak_plan_exercises_update',resource_id:50,changes:{description:'짧은 목표',steps:[
      {action:'add',exercise_id:2,weight:'맨몸'},{action:'add',exercise_id:1,position:1},{action:'update',exercise_id:2,reps:8}]}});
    expect(p.status).toBe(200); expect(p.body.after.exercises.map(e=>e.exercise_id)).toEqual([1,2]);
    expect((await confirm(p.body)).status).toBe(200);
    await f.peak.query('UPDATE daily_plans SET completed_exercises=\'[1,2]\',exercise_times=\'{"1":"first","2":"second"}\' WHERE id=50');
    p = await preview({operation:'peak_plan_exercises_update',resource_id:50,changes:{steps:[{action:'move',exercise_id:2,position:1},{action:'update',exercise_id:1,note:'준비'}]}});
    expect(p.status).toBe(200); expect((await confirm(p.body)).status).toBe(200);
    const row=(await f.peak.query('SELECT * FROM daily_plans WHERE id=50'))[0][0];
    const value=x=>typeof x==='string'?JSON.parse(x):x;
    expect(value(row.exercises).map(e=>e.exercise_id)).toEqual([2,1]);
    expect(value(row.exercises)[0]).toMatchObject({weight:'맨몸',reps:8});
    expect(value(row.completed_exercises)).toEqual([1,2]); expect(value(row.exercise_times)).toEqual({1:'first',2:'second'});
    expect(row.description).toBe('짧은 목표'); expect(value(row.tags)).toEqual(['보존']); expect(value(row.extra_exercises)).toEqual([{id:99}]);
    expect((await confirm(p.body)).status).toBe(200);
  });
  test('new exercise registers only in own academy and complete plan creation resolves real names and defaults', async () => {
    const p=await preview({operation:'peak_exercise_create',changes:{name:'합성착지',default_sets:2,default_reps:6}});
    expect(p.status).toBe(200); const result=await confirm(p.body); expect(result.status).toBe(200);
    const id=result.body.resource_id;
    expect((await f.peak.query('SELECT academy_id,is_system FROM exercises WHERE id=?',[id]))[0][0]).toEqual({academy_id:1,is_system:0});
    expect((await preview({operation:'peak_exercise_create',changes:{name:'합성착지'}})).body.error.code).toBe('PEAK_DUPLICATE');
    const plan=await preview({operation:'peak_plan_create',changes:{date:f.date,time_slot:'afternoon',instructor_id:1,exercises:[{exercise_id:id}]}});
    expect(plan.status).toBe(200); expect(plan.body.after.exercises[0]).toMatchObject({name:'합성착지',sets:2,reps:6});
    expect((await confirm(plan.body)).status).toBe(200);
  });
  test('teacher assignment preserves students and plan while explicit main assignment demotes prior main', async () => {
    await f.insert('peak','class_instructors',{academy_id:1,date:f.date,time_slot:'afternoon',class_num:1,instructor_id:-1,is_main:1});
    const p=await preview({operation:'peak_instructor_assignment_create',changes:{date:f.date,time_slot:'afternoon',class_num:1,instructor_id:1,is_main:true}});
    expect(p.status).toBe(200); expect(p.body.after.previous_main_becomes_assistant).toEqual([-1]);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await f.peak.query('SELECT instructor_id,is_main FROM class_instructors ORDER BY order_num'))[0]).toEqual([{instructor_id:1,is_main:1},{instructor_id:-1,is_main:0}]);
    expect((await preview({operation:'peak_instructor_assignment_create',changes:{date:f.date,time_slot:'afternoon',class_num:2,instructor_id:1,is_main:true}})).body.error.code).toBe('PEAK_TEACHER_CONFLICT');
  });
  test('unscheduled active teacher can receive an explicitly confirmed PACA work schedule then a PEAK class plan', async () => {
    const c={instructor_id:4,work_date:f.date,time_slot:'afternoon',scheduled_start_time:'14:00',scheduled_end_time:'18:00'};
    let p=await preview({operation:'instructor_schedule_create',changes:c});
    expect(p.status).toBe(200); expect((await confirm(p.body)).status).toBe(200);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await f.paca.query('SELECT COUNT(*) n FROM instructor_schedules WHERE instructor_id=4'))[0][0].n).toBe(1);
    expect((await preview({operation:'instructor_schedule_create',changes:c})).body.error.code).toBe('SCHEDULE_CONFLICT');
    const context=await get('/peak/workflows/teaching_context?params='+encodeURIComponent(JSON.stringify({date:f.date,time_slot:'afternoon'})));
    expect(context.body.instructors.items.find(row=>row.instructor_id===4).available).toBe(true);
    p=await preview(setup({instructor_id:4,assistant_instructor_ids:[]}));expect(p.status).toBe(200);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await f.peak.query('SELECT instructor_id FROM daily_plans'))[0][0].instructor_id).toBe(4);
    expect((await f.paca.query('SELECT COUNT(*) n FROM instructor_attendance'))[0][0].n).toBe(0);
  });
});
