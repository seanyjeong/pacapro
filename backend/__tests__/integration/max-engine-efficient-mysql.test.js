jest.mock('../../config/database', () => global.__efficient.paca);
jest.mock('../../config/peak-database', () => global.__efficient.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const express = require('express');
const request = require('supertest');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
run('efficient read workflows: isolated MySQL and authenticated HTTP', () => {
  let f, app, server, token;
  beforeAll(async () => {
    f = await fixture(); global.__efficient = f;
    app = express(); app.use(express.json()); app.use('/full', require('../../routes/integrations/full'));
    await new Promise(resolve => { server = app.listen(0, '127.0.0.1', resolve); });
    const login = await request(server).post('/full/token').send({ email: 'a@example.invalid', password: 'synthetic' });
    expect(login.status).toBe(200); token = login.body.access_token;
  });
  afterAll(async () => { if (server) await new Promise(resolve => server.close(resolve)); await f?.close(); });
  const get = (path, query = {}) => request(server).get('/full' + path).auth(token, { type: 'bearer' }).query(query);
  const workflow = async (name, params = {}, provider = 'paca') => {
    const r = await get(`/${provider}/workflows/${name}`, { params: JSON.stringify(params) });
    expect({ name, error: r.body.error, status: r.status }).toEqual({ name, error: undefined, status: 200 });
    return r.body;
  };
  test('IDs and expansions preserve scope, aliases and private field allowlist', async () => {
    const r = await get('/paca/resources/attendance', { ids: '[1,2,90]', expand: '["student","schedule"]' });
    expect(r.status).toBe(200); expect(r.body.items.map(r => r.id)).toEqual([1, 2]);
    expect(r.body.items[0].expanded.student).toEqual({ id: 1, name: '합성01', grade: '고3', school: '합성고' });
    expect(r.body.items[0].expanded.schedule.time_slot).toBe('afternoon');
    const alias = await get('/peak/resources/paca_attendance', { ids: '[1]', expand: '["student"]' });
    expect(alias.body.items[0].expanded.student.name).toBe('합성01');
    const peak = await get('/peak/resources/student_records', { ids: '[11,90]', expand: '["student","event"]' });
    expect(peak.body.items.map(r => r.id)).toEqual([11]); expect(peak.body.items[0].expanded.event.direction).toBe('higher');
    for (const q of [{ ids: '[]' }, { ids: '[true]' }, { ids: '[1.5]' }, { ids: JSON.stringify(Array(201).fill(1)) }, { expand: '["phone"]' }, { expand: '["__proto__"]' }, { filters: '{"academy_id":2}' }, { ids: { nested: 1 } }]) expect((await get('/paca/resources/attendance', q)).status).toBe(422);
  });
  test('afternoon roster joins class/instructor/student; time range uses actual academy settings', async () => {
    const r = await workflow('classes_with_students', { date: f.date, time_slot: 'afternoon' });
    expect(r.total).toBe(1); expect(r.items[0].students.total).toBe(8);
    expect(r.items[0].class_name).toBe('합성 수업'); expect(r.items[0].instructor_name).toBe('합성강사');
    expect(r.items[0].students.items[0].name).toBe('합성01');
    expect((await workflow('classes_with_students', { date: f.date, start_time: '13:00', end_time: '14:30' })).items.map(r => r.id)).toEqual([1]);
    expect((await workflow('classes_with_students', { date: f.date, start_time: '12:00', end_time: '14:00' })).total).toBe(0);
  });
  test('attendance nulls, encrypted search, ambiguous names and complete overview', async () => {
    expect((await workflow('attendance_summary', { date: f.date })).by_status).toEqual({ present: 6, absent: 1, unmarked: 1 });
    expect((await workflow('attendance_summary', { date: f.date, status: 'absent' })).details.items[0].student.name).toBe('합성02');
    const found = await workflow('student_search', { phone_last4: '0001', school: '합성', grade: '고3' });
    expect(found.items.map(s => s.name)).toEqual(['합성01']); expect(found.items[0].phone).toBeUndefined();
    const ambiguous = await workflow('student_overview', { name: '동명이인' });
    expect(ambiguous.needs_selection).toBe(true); expect(ambiguous.candidates.total).toBe(2); expect(ambiguous.unpaid).toBeUndefined();
    const summary = await workflow('student_overview', { name: '합성01' });
    expect(summary.student.id).toBe(1); expect(summary.classes.items[0].class_name).toBe('합성 수업');
    expect(summary.attendance.total).toBe(1); expect(summary.recent_consultations.items[0].general_memo).toBe('합성 상담'); expect(summary.unpaid.unpaid).toBe('80.05');
    expect((await get('/paca/workflows/student_overview', { params: '{"student_id":90}' })).status).toBe(404);
  });
  test('partial/cancelled payments, consultation stale links, trial and today brief', async () => {
    const unpaid = await workflow('unpaid_list', { month: f.month }); expect(unpaid.total).toBe(8); expect(unpaid.unpaid).toBe('760.70');
    const paid = await workflow('payment_status', { month: f.month });
    expect(paid.billed).toBe('800.80'); expect(paid.paid).toBe('40.10'); expect(paid.cancelled_count).toBe(1);
    expect((await workflow('consultation_schedule', { start_date: f.date, end_date: f.date })).items.map(r => r.student.name)).toEqual(['합성01']);
    expect((await workflow('trial_students', { status: 'trial' })).items.map(s => s.id)).toEqual([8]);
    const brief = await workflow('today_brief'); expect(brief.date).toBe(f.date); expect(brief.classes.total).toBe(3);
    expect(brief.unpaid.unpaid).toBe('760.70'); expect(brief.attendance.total).toBe(8); expect(brief.consultations.total).toBe(1);
  });
  test('PEAK latest active student, deterministic ties, direction and current PACA membership', async () => {
    const p = { start_date: f.start, end_date: f.date };
    await f.peak.query("UPDATE students SET name='stale cache',gender='F' WHERE id=1");
    await f.peak.query('UPDATE student_records SET value=999 WHERE id=1');
    const recent = await workflow('recent_records', { ...p, name: '합성01' }, 'peak'); expect(recent.total).toBe(4); expect(recent.items[0].date).toBe(f.date);
    expect(recent.items[0].student.name).toBe('합성01'); expect(recent.items[0].student.gender).toBe('male');
    const ranking = await workflow('event_ranking', { ...p, event: '제자리멀리뛰기' }, 'peak');
    expect(ranking.total).toBe(7); expect(ranking.items.map(r => r.rank)).toEqual([1, 2, 3, 4, 5, 6, 7]); expect(ranking.items[0].student.id).toBe(6);
    const lower = await workflow('event_ranking', { ...p, event: '100m', gender: 'male' }, 'peak'); expect(lower.items.map(r => r.student.id)).toEqual([7, 5, 3, 1]);
    const progress = await workflow('student_progress', { ...p, student_id: 1, event: '100m' }, 'peak');
    expect(progress.first).toBe(15); expect(progress.latest).toBe(13.9); expect(progress.best).toBe(13.9); expect(progress.improvement).toBe(1.1);
    await f.paca.query('UPDATE students SET academy_id=2 WHERE id=7');
    const moved = await workflow('event_ranking', { ...p, event: '제자리멀리뛰기' }, 'peak'); expect(moved.total).toBe(6); expect(moved.items.some(r => r.student.id === 7)).toBe(false);
    await f.paca.query('UPDATE students SET academy_id=1 WHERE id=7');
  });
  test('invalid inputs never broaden query, unauthenticated/revoked callers fail', async () => {
    for (const [name, params] of [
      ['attendance_summary', {}], ['student_search', {}], ['student_overview', { student_id: 1, name: '합성01' }],
      ['classes_with_students', { date: '2026-02-30' }], ['classes_with_students', { date: f.date, start_time: '14:00' }],
      ['attendance_summary', { start_date: f.date, end_date: f.start }], ['attendance_summary', { date: f.date, academy_id: 2 }],
      ['unpaid_list', { month: '2026-13' }], ['student_search', { phone_last4: '123' }], ['today_brief', { sql: 'select' }],
    ]) expect((await get('/paca/workflows/' + name, { params: JSON.stringify(params) })).status).toBe(422);
    expect((await get('/paca/workflows/event_ranking')).status).toBe(404);
    expect((await get('/paca/workflows/today_brief', { academy_id: 2 })).status).toBe(422);
    expect((await request(server).get('/full/paca/workflows/today_brief')).status).toBe(401);
    await f.paca.query('UPDATE users SET is_active=0 WHERE id=1'); expect((await get('/paca/workflows/today_brief')).status).toBe(403);
    await f.paca.query('UPDATE users SET is_active=1 WHERE id=1');
  });
  test('200 IDs return once and summaries include beyond page 100 with explicit detail truncation', async () => {
    for (let id = 1000; id <= 1200; id++) {
      await f.insert('paca', 'students', { id, academy_id: 1, name: f.encrypt('합성 추가'), status: 'active' });
      await f.insert('paca', 'student_payments', { id, academy_id: 1, student_id: id, year_month: f.month, final_amount: '0.10', paid_amount: 0, payment_status: 'pending' });
    }
    const batch = await get('/paca/resources/students', { ids: JSON.stringify(Array.from({ length: 200 }, (_, i) => i + 1000)) });
    expect(batch.body.items).toHaveLength(200); expect(batch.body.next_cursor).toBeNull();
    const all = await workflow('payment_status', { month: f.month });
    expect(all.total).toBe(209); expect(all.items).toHaveLength(200); expect(all.truncated).toBe(true); expect(all.unpaid).toBe('780.80');
  });
  test('PACA MCP exposes PEAK one-call workflows with the exact same scoped results', async () => {
    for (const [name, params] of [['recent_records', {date:f.date}], ['event_ranking', {event:'제자리멀리뛰기',date:f.date}], ['student_progress', {student_id:1,event:'제자리멀리뛰기',date:f.date}]]) {
      const direct = await workflow(name, params, 'peak');
      const alias = await workflow('peak_' + name, params, 'paca');
      expect({...alias,workflow:name}).toEqual(direct);
    }
    const catalog = await get('/paca/catalog');
    expect(catalog.body.workflows.map(w=>w.name)).toEqual(expect.arrayContaining(['peak_recent_records','peak_event_ranking','peak_student_progress']));
  });

});
