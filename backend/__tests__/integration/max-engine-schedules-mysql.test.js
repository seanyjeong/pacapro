const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
jest.mock('../../config/database', () => global.__schedulePaca);
jest.mock('../../config/peak-database', () => global.__schedulePeak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), error: jest.fn() }));
const fs = require('fs');
const express = require('express');
const request = require('supertest');

run('schedule commands through native HTTP and isolated MySQL', () => {
  let f, app, token;
  const day = '2030-05-01', next = '2030-05-02';
  const post = (path, body) => request(app).post('/full/paca/' + path).auth(token, { type: 'bearer' }).send(body);
  const preview = (operation, id, changes) => post('preview', { operation, resource_id: id, changes });
  const confirm = body => post('confirm', { preview_token: body.preview_token, idempotency_key: body.idempotency_key, confirm: true });
  const row = async (table, id) => (await f.paca.query(`SELECT * FROM ${table} WHERE id = ?`, [id]))[0][0];
  const insert = (table, values) => f.insert('paca', table, values);
  const count = async table => (await f.paca.query(`SELECT COUNT(*) n FROM ${table}`))[0][0].n;
  beforeAll(async () => {
    f = await require('./max-engine-efficient-fixture').fixture();
    global.__schedulePaca = f.paca; global.__schedulePeak = f.peak;
    await f.paca.query('DROP TABLE IF EXISTS max_engine_commands');
    await f.paca.query(fs.readFileSync(require.resolve('../../migrations/20260927_max_engine_commands.sql'), 'utf8'));
    app = express(); app.use(express.json()); app.use('/full', require('../../routes/integrations/full'));
    const login = await request(app).post('/full/token').send({ email: 'a@example.invalid', password: 'synthetic' });
    expect(login.status).toBe(200); token = login.body.access_token;
  });
  afterAll(async () => { await f?.close(); });
  beforeEach(async () => {
    for (const table of ['max_engine_commands', 'attendance', 'instructor_attendance', 'attendance_notification_queue',
      'class_schedules', 'academy_events', 'consultation_blocked_slots', 'instructor_schedules', 'consultations', 'consultation_settings']) {
      await f.paca.query(`DELETE FROM ${table}`);
    }
    await insert('class_schedules', { id: 501, academy_id: 1, class_date: day, time_slot: 'afternoon', instructor_id: 1, title: '원래 수업', notes: '보존', is_closed: 0 });
    await insert('academy_events', { id: 502, academy_id: 1, title: '원래 행사', event_date: day, is_all_day: 1, is_holiday: 0, description: '보존' });
    await insert('instructor_schedules', { id: 504, academy_id: 1, instructor_id: 1, work_date: day, time_slot: 'afternoon', scheduled_start_time: '14:00', scheduled_end_time: '18:00' });
    await insert('consultations', { id: 505, academy_id: 1, linked_student_id: 1, preferred_date: day, preferred_time: '14:00', status: 'confirmed', admin_notes: '보존', reminder_sent: 1 });
  });
  test.each([
    ['class_schedule_update', 'class_schedules', 501, { class_date: next }, 'notes'],
    ['academy_event_update', 'academy_events', 502, { event_date: next }, 'description'],
    ['instructor_schedule_update', 'instructor_schedules', 504, { work_date: next }, 'instructor_id'],
    ['consultation_reschedule', 'consultations', 505, { preferred_date: next, preferred_time: '15:30' }, 'admin_notes'],
  ])('%s: preview is read-only, confirm is partial and concurrent retries apply once', async (op, table, id, changes, preserved) => {
    const before = await row(table, id);
    const p = await preview(op, id, changes);
    expect({ status: p.status, error: p.body.error }).toEqual({ status: 200, error: undefined });
    expect(await row(table, id)).toEqual(before); expect(await count('max_engine_commands')).toBe(0);
    const results = await Promise.all([confirm(p.body), confirm(p.body)]);
    expect(results.map(result => result.status)).toEqual([200, 200]);
    expect(results[0].body).toEqual(results[1].body);
    const after = await row(table, id);
    expect(after[preserved]).toEqual(before[preserved]);
    for (const [key, value] of Object.entries(changes)) expect(after[key]).toBe(key.endsWith('_time') ? value + ':00' : value);
    expect(await count('max_engine_commands')).toBe(1);
    expect(await count('attendance_notification_queue')).toBe(0);
    expect((await row('consultations', 505)).reminder_sent).toBe(1);
  });
  test.each([
    ['class_schedule_update', 'class_schedules', 501, { title: '외부 수정' }],
    ['academy_event_update', 'academy_events', 502, { title: '외부 수정' }],
    ['instructor_schedule_update', 'instructor_schedules', 504, { work_date: next }],
    ['consultation_reschedule', 'consultations', 505, { preferred_date: next }],
  ])('%s rejects other academy and detects edits after preview', async (op, table, id, changes) => {
    const p = await preview(op, id, changes); expect(p.status).toBe(200);
    await f.paca.query(`UPDATE ${table} SET updated_at = '2030-01-01' WHERE id = ?`, [id]);
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    await f.paca.query(`UPDATE ${table} SET academy_id = 2 WHERE id = ?`, [id]);
    expect((await preview(op, id, changes)).status).toBe(404);
    expect(await count('max_engine_commands')).toBe(0);
  });
  test('class and instructor duplicate slots, foreign instructor and recorded attendance are rejected', async () => {
    await insert('class_schedules', { id: 506, academy_id: 1, class_date: next, time_slot: 'afternoon' });
    expect((await preview('class_schedule_update', 501, { class_date: next })).body.error.code).toBe('SCHEDULE_CONFLICT');
    expect((await preview('class_schedule_update', 501, { instructor_id: 999 })).status).toBe(404);
    await insert('instructors', { id: 99, academy_id: 2, name: f.encrypt('외부강사') });
    expect((await preview('class_schedule_update', 501, { instructor_id: 99 })).status).toBe(404);
    await insert('instructor_schedules', { id: 507, academy_id: 1, instructor_id: 1, work_date: next, time_slot: 'afternoon' });
    expect((await preview('instructor_schedule_update', 504, { work_date: next })).status).toBe(409);
    await insert('attendance', { id: 601, class_schedule_id: 501, student_id: 1, attendance_status: 'present' });
    expect((await preview('class_schedule_update', 501, { time_slot: 'morning' })).status).toBe(409);
    expect((await preview('class_schedule_update', 501, { title: '제목만 수정' })).status).toBe(200);
    await insert('instructor_attendance', { id: 602, instructor_id: 1, class_schedule_id: 501, work_date: day, time_slot: 'afternoon', attendance_status: 'present' });
    expect((await preview('instructor_schedule_update', 504, { time_slot: 'morning' })).status).toBe(409);
    expect((await preview('class_schedule_update', 501, { instructor_id: null })).status).toBe(409);
  });
  test('consultation move checks linked student, status, capacity and manual blocked hours', async () => {
    await f.paca.query('UPDATE consultations SET linked_student_id = 90 WHERE id = 505');
    expect((await preview('consultation_reschedule', 505, { preferred_date: next })).status).toBe(404);
    await f.paca.query("UPDATE consultations SET linked_student_id = 1, status = 'completed' WHERE id = 505");
    expect((await preview('consultation_reschedule', 505, { preferred_date: next })).status).toBe(409);
    await f.paca.query("UPDATE consultations SET status = 'confirmed' WHERE id = 505");
    await insert('consultation_blocked_slots', { id: 610, academy_id: 1, blocked_date: next, start_time: '14:00', end_time: '15:00' });
    expect((await preview('consultation_reschedule', 505, { preferred_date: next })).status).toBe(409);
    expect((await preview('consultation_reschedule', 505, { preferred_date: next, preferred_time: '15:00' })).status).toBe(200);
    await insert('consultations', { id: 611, academy_id: 1, preferred_date: next, preferred_time: '15:00', status: 'confirmed' });
    expect((await preview('consultation_reschedule', 505, { preferred_date: next, preferred_time: '15:00' })).status).toBe(409);
    await insert('consultation_settings', { academy_id: 1, max_reservations_per_slot: 2 });
    expect((await preview('consultation_reschedule', 505, { preferred_date: next, preferred_time: '15:00' })).status).toBe(200);
  });
  test('new attendance after preview invalidates a move; trial, makeup and foreign links are guarded', async () => {
    const p = await preview('class_schedule_update', 501, { class_date: next }); expect(p.status).toBe(200);
    await insert('attendance', { id: 601, class_schedule_id: 501, student_id: 1, attendance_status: 'present' });
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    await f.paca.query('UPDATE attendance SET attendance_status = NULL, student_id = 8 WHERE id = 601');
    expect((await preview('class_schedule_update', 501, { class_date: next })).status).toBe(409);
    await f.paca.query('UPDATE attendance SET student_id = 1, is_makeup = 1 WHERE id = 601');
    expect((await preview('class_schedule_update', 501, { class_date: next })).status).toBe(409);
    await f.paca.query('UPDATE attendance SET student_id = 90, is_makeup = 0 WHERE id = 601');
    expect((await preview('class_schedule_update', 501, { class_date: next })).status).toBe(404);
    expect((await row('class_schedules', 501)).class_date).toBe(day);
  });
  test('partial scheduled time validates merged range and preserves the other instructor shifts', async () => {
    await insert('instructor_schedules', { id: 507, academy_id: 1, instructor_id: 1, work_date: day, time_slot: 'morning' });
    const other = await row('instructor_schedules', 507);
    expect((await preview('instructor_schedule_update', 504, { scheduled_start_time: '19:00' })).status).toBe(422);
    const p = await preview('instructor_schedule_update', 504, { scheduled_end_time: '19:00' }); expect(p.status).toBe(200);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await row('instructor_schedules', 504)).scheduled_start_time).toBe('14:00:00');
    expect(await row('instructor_schedules', 507)).toEqual(other);
  });
  async function holiday() {
    await f.paca.query('UPDATE academy_events SET is_holiday = 1 WHERE id = 502');
    await f.paca.query("UPDATE class_schedules SET is_closed = 1, close_reason = '휴일: 원래 행사', academy_event_id = 502 WHERE id = 501");
    await insert('class_schedules', { id: 503, academy_id: 1, class_date: next, time_slot: 'afternoon', is_closed: 0 });
    for (const time_slot of ['morning', 'afternoon', 'evening']) await insert('consultation_blocked_slots', { academy_id: 1, blocked_date: day, time_slot, academy_event_id: 502 });
  }
  test('moving holiday atomically reopens old classes, closes new classes, moves only owned blocks', async () => {
    await holiday();
    await insert('consultation_blocked_slots', { id: 650, academy_id: 2, blocked_date: next, time_slot: 'afternoon' });
    const p = await preview('academy_event_update', 502, { event_date: next });
    expect(p.status).toBe(200); expect(p.body.after.related.classes.map(c => c.id)).toEqual([501, 503]);
    expect((await row('class_schedules', 501)).is_closed).toBe(1);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await row('class_schedules', 501)).academy_event_id).toBeNull();
    expect((await row('class_schedules', 503)).academy_event_id).toBe(502);
    expect((await f.paca.query('SELECT blocked_date FROM consultation_blocked_slots WHERE academy_event_id = 502'))[0]).toEqual(Array(3).fill({ blocked_date: next }));
    expect((await row('consultation_blocked_slots', 650)).academy_id).toBe(2);
  });
  test('manual closures/blocks are not overwritten; related edits invalidate preview', async () => {
    await holiday();
    await f.paca.query("UPDATE class_schedules SET is_closed = 1, close_reason = '수동 휴강' WHERE id = 503");
    expect((await preview('academy_event_update', 502, { event_date: next })).status).toBe(409);
    await f.paca.query('UPDATE class_schedules SET is_closed = 0 WHERE id = 503');
    const p = await preview('academy_event_update', 502, { event_date: next }); expect(p.status).toBe(200);
    await insert('consultation_blocked_slots', { academy_id: 1, blocked_date: next, start_time: '13:00', end_time: '14:00' });
    expect((await confirm(p.body)).body.error.code).toBe('SOURCE_CHANGED');
    expect((await preview('academy_event_update', 502, { event_date: next })).status).toBe(409);
    expect((await row('academy_events', 502)).event_date).toBe(day);
  });
  test('side-effect failure rolls back event, linked classes, blocks and receipt; same confirmation can retry', async () => {
    await holiday();
    const p = await preview('academy_event_update', 502, { event_date: next }); expect(p.status).toBe(200);
    await f.paca.query("CREATE TRIGGER reject_schedule_block BEFORE INSERT ON consultation_blocked_slots FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'synthetic failure'");
    try {
      expect((await confirm(p.body)).status).toBe(503);
      expect((await row('academy_events', 502)).event_date).toBe(day);
      expect((await row('class_schedules', 501)).is_closed).toBe(1);
      expect((await row('class_schedules', 503)).is_closed).toBe(0);
      expect(await count('consultation_blocked_slots')).toBe(3); expect(await count('max_engine_commands')).toBe(0);
    } finally { await f.paca.query('DROP TRIGGER reject_schedule_block'); }
    expect((await confirm(p.body)).status).toBe(200);
  });
  test('equal HH:MM time does not unexpectedly rebuild existing consultation blocks', async () => {
    await holiday();
    await f.paca.query("UPDATE academy_events SET start_time = '14:00', end_time = '15:00' WHERE id = 502");
    const blocks = (await f.paca.query('SELECT * FROM consultation_blocked_slots ORDER BY id'))[0];
    const p = await preview('academy_event_update', 502, { start_time: '14:00' }); expect(p.status).toBe(200);
    expect(p.body.after.related.consultation_blocks).toEqual([]);
    expect((await confirm(p.body)).status).toBe(200);
    expect((await f.paca.query('SELECT * FROM consultation_blocked_slots ORDER BY id'))[0]).toEqual(blocks);
  });
  test('event patch preserves omitted NULL/empty metadata rather than filling defaults', async () => {
    await f.paca.query("UPDATE academy_events SET event_type = NULL, color = NULL, description = '', is_holiday = NULL WHERE id = 502");
    const before = await row('academy_events', 502);
    const p = await preview('academy_event_update', 502, { title: '행사 제목 수정' }); expect(p.status).toBe(200);
    expect(p.body.after.is_holiday).toBeNull();
    expect((await confirm(p.body)).status).toBe(200);
    const after = await row('academy_events', 502);
    for (const field of ['event_type', 'color', 'description', 'is_holiday']) expect(after[field]).toEqual(before[field]);
    expect(after.title).toBe('행사 제목 수정');
  });
});
