/** 일회용 루프백 MySQL 전용 — 운영 자격 증명·실제 학생 없음. RUN_MAX_ENGINE_MYSQL=1 TEST_MYSQL_PORT=<10000 이상> 일 때만 돈다. */
jest.mock('../../config/database', () => global.__slotMove.paca);
jest.mock('../../config/peak-database', () => global.__slotMove.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../middleware/auth', () => ({
  verifyToken: (req, _res, next) => { req.user = { academyId: 1, userId: 1, role: 'owner' }; next(); },
  checkPermission: () => (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
}));
const fs = require('fs');
const path = require('path');
const express = require('express');
const request = require('supertest');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;

// 저녁 학생을 오후로 옮긴 뒤 저녁 시간대 창을 다시 열어도 저녁에 다시 생기지 않는다 (QA D08)
run('time slot move keeps the student in one slot for the day', () => {
  let f, app;
  const date = '2099-03-10', weekday = new Date(date + 'T00:00:00Z').getUTCDay();
  beforeAll(async () => {
    f = await fixture(); global.__slotMove = f;
    // 시간대 창 조회가 지점·반을 함께 읽으므로 지점 마이그레이션을 그대로 적용한다
    const connection = await f.paca.getConnection();
    const sql = fs.readFileSync(path.join(__dirname, '../../migrations/20261112_add_branches_and_student_class.mysql'), 'utf8');
    for (const statement of sql.replace(/^--.*$/gm, '').split(';').filter(s => s.trim())) await connection.query(statement);
    connection.release();
    app = express(); app.use(express.json());
    app.use('/paca/schedules', require('../../routes/schedules'));
  });
  // 지점 표는 학원 표를 외래 키로 물고 있어 남겨 두면 다음 실행의 공용 픽스처가 학원 표를 지우지 못한다
  afterAll(async () => { await f?.paca.query('DROP TABLE IF EXISTS branches'); await f?.close(); });

  const slotsOf = async studentId => (await f.paca.query(`SELECT cs.time_slot FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
    WHERE cs.academy_id = 1 AND cs.class_date = ? AND a.student_id = ? ORDER BY cs.time_slot`, [date, studentId]))[0].map(r => r.time_slot);
  const openSlot = async timeSlot => {
    const res = await request(app).get('/paca/schedules/slot').query({ date, time_slot: timeSlot });
    expect(res.status).toBe(200);
    return res.body.schedule.students.map(s => s.student_id);
  };

  test('저녁 → 오후 이동 뒤 저녁·오후 창을 다시 열어도 오후에만 있다', async () => {
    await f.paca.query("UPDATE students SET class_days='[]'");
    await f.paca.query("UPDATE students SET class_days=?, time_slot='evening', status='active', enrollment_date=NULL WHERE id = 4", [JSON.stringify([weekday])]);
    for (const slot of ['afternoon', 'evening']) {
      await f.paca.query('INSERT IGNORE INTO class_schedules (academy_id, class_date, time_slot) VALUES (1, ?, ?)', [date, slot]);
    }

    expect(await openSlot('evening')).toEqual([4]);
    expect(await slotsOf(4)).toEqual(['evening']);

    const moved = await request(app).post('/paca/schedules/slot/move')
      .send({ date, from_slot: 'evening', to_slot: 'afternoon', student_id: 4 });
    expect(moved.status).toBe(200);

    expect(await openSlot('evening')).toEqual([]);
    expect(await openSlot('afternoon')).toEqual([4]);
    expect(await slotsOf(4)).toEqual(['afternoon']);
  });

  // 개별 수업 출석 화면에서 보충 학생을 추가하면 그 수업 출석 화면에도 바로 나온다 (QA P03)
  test('오전 수업에 보충 학생을 추가하면 수업 출석 조회와 시간대 창에 같은 학생이 나온다', async () => {
    await f.paca.query("UPDATE students SET class_days='[]'");
    await f.paca.query('INSERT IGNORE INTO class_schedules (academy_id, class_date, time_slot, title) VALUES (1, ?, ?, ?)', [date, 'morning', '개별 수업']);
    const [[{ id: scheduleId }]] = await f.paca.query("SELECT id FROM class_schedules WHERE academy_id = 1 AND class_date = ? AND time_slot = 'morning'", [date]);

    const added = await request(app).post('/paca/schedules/slot/student')
      .send({ date, time_slot: 'morning', student_id: 4, is_makeup: true });
    expect(added.status).toBe(200);

    const attendance = await request(app).get(`/paca/schedules/${scheduleId}/attendance`);
    expect(attendance.status).toBe(200);
    expect(attendance.body.students.map(s => [s.student_id, s.is_makeup, s.attendance_status])).toEqual([[4, true, null]]);
    expect(await openSlot('morning')).toEqual([4]);
  });
});
