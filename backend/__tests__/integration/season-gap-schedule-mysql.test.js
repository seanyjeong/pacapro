/** All writes use a dedicated disposable loopback MySQL; no production credentials. */
jest.mock('../../config/database', () => global.__gap.paca);
jest.mock('../../config/peak-database', () => global.__gap.peak);
jest.mock('../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../middleware/auth', () => ({
  verifyToken: (req, _res, next) => { req.user = { academyId: 1, userId: 1, role: 'owner' }; next(); },
  checkPermission: () => (_req, _res, next) => next(),
  requireRole: () => (_req, _res, next) => next(),
}));
const express = require('express');
const request = require('supertest');
const { fixture } = require('./max-engine-efficient-fixture');
const run = process.env.RUN_MAX_ENGINE_MYSQL === '1' ? describe : describe.skip;
// 시즌 등록생(4)은 비시즌 종강 다음 날~시즌 시작 전날 정규 수업에 들어가지 않고, 일반 학생(5)은 그대로 들어간다
run('regular schedules skip the season gap for enrolled students', () => {
  let f, app;
  const day = (offset, base = new Date()) => new Date(base.getTime() + offset * 86400000).toISOString().slice(0, 10);
  beforeAll(async () => {
    f = await fixture(); global.__gap = f;
    app = express(); app.use(express.json());
    app.use('/paca/schedules', require('../../routes/schedules'));
  });
  afterAll(async () => { await f?.close(); });
  async function reset({ nonSeasonEnd, seasonStart, weekday, cancelled = 0 }) {
    for (const table of ['student_seasons', 'seasons']) await f.paca.query(`DELETE FROM ${table}`);
    await f.paca.query('DELETE FROM attendance WHERE student_id IN (4, 5)');
    await f.paca.query("UPDATE students SET class_days='[]'");
    await f.paca.query("UPDATE students SET class_days=?, time_slot='evening', status='active', enrollment_date=NULL WHERE id IN (4, 5)", [JSON.stringify([weekday])]);
    await f.insert('paca', 'seasons', { id: 900, academy_id: 1, season_name: '합성 정시', season_type: 'regular', status: 'upcoming',
      non_season_end_date: nonSeasonEnd, season_start_date: seasonStart, season_end_date: day(60, new Date(seasonStart)), operating_days: '[1,2,3,4,5,6]', default_season_fee: 1000000 });
    await f.insert('paca', 'student_seasons', { id: 901, student_id: 4, season_id: 900, season_fee: 1000000, registration_date: nonSeasonEnd, payment_status: 'pending', is_cancelled: cancelled });
  }
  const assigned = async date => (await f.paca.query(`SELECT a.student_id FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
    WHERE cs.academy_id = 1 AND cs.class_date = ? AND a.student_id IN (4, 5) ORDER BY a.student_id`, [date]))[0].map(r => r.student_id);
  async function openSlot(date) {
    await f.paca.query('INSERT IGNORE INTO class_schedules (academy_id, class_date, time_slot) VALUES (1, ?, ?)', [date, 'evening']);
    expect((await request(app).get('/paca/schedules/slot').query({ date, time_slot: 'evening' })).status).toBe(200);
    return assigned(date);
  }

  test('opening a slot adds only students outside the gap; season start day and cancelled enrollments are regular', async () => {
    const gapDate = '2099-03-10', weekday = new Date(gapDate + 'T00:00:00Z').getUTCDay();
    await reset({ nonSeasonEnd: '2099-03-01', seasonStart: '2099-03-17', weekday });
    expect(await openSlot(gapDate)).toEqual([5]);
    expect(await openSlot('2099-03-03')).toEqual([5]);
    expect(await openSlot('2099-02-24')).toEqual([4, 5]);
    expect(await openSlot('2099-03-17')).toEqual([4, 5]);
    await reset({ nonSeasonEnd: '2099-03-01', seasonStart: '2099-03-17', weekday, cancelled: 1 });
    expect(await openSlot(gapDate)).toEqual([4, 5]);
  });
  test('class-day change reassignment skips the gap for this month', async () => {
    const { reassignStudentSchedules } = require('../../routes/students/_utils');
    const today = new Date(), weekday = (today.getDay() + 1) % 7;
    await reset({ nonSeasonEnd: day(-1), seasonStart: day(40), weekday });
    for (const id of [4, 5]) await reassignStudentSchedules(f.paca, id, 1, [], [weekday]);
    const rows = (await f.paca.query(`SELECT a.student_id, COUNT(*) n FROM attendance a JOIN class_schedules cs ON cs.id = a.class_schedule_id
      WHERE a.student_id IN (4, 5) GROUP BY a.student_id ORDER BY a.student_id`))[0];
    const lastDay = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const expected = Array.from({ length: lastDay - today.getDate() + 1 }, (_, i) => new Date(today.getFullYear(), today.getMonth(), today.getDate() + i))
      .filter(d => d.getDay() === weekday).length;
    expect(rows.map(r => [r.student_id, r.n])).toEqual(expected ? [[5, expected]] : []);
  });
});
