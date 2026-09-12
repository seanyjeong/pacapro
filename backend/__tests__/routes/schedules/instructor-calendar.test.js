jest.mock('../../../config/database', () => require('../../helpers/instructorCalendarDatabase').createInstructorCalendarDatabase());
jest.mock('../../../utils/logger', () => ({ error: jest.fn(), warn: jest.fn(), info: jest.fn() }));

const { randomBytes } = require('crypto');
process.env.JWT_SECRET = randomBytes(32).toString('hex');
process.env.DATA_ENCRYPTION_KEY = randomBytes(32).toString('hex');
const jwt = require('jsonwebtoken');
const express = require('express');
const request = require('supertest');
const db = require('../../../config/database');
const { encrypt } = require('../../../utils/encryption');
const app = express();
app.use(express.json());
app.use('/paca/schedules', require('../../../routes/schedules'));
const path = '/paca/schedules/instructor-schedules/calendar';
const auth = () => `Bearer ${jwt.sign({ userId: 20 }, process.env.JWT_SECRET, { expiresIn: '5m' })}`;
const read = (query = { year: 2026, month: 9 }) => request(app).get(path).query(query).set('Authorization', auth());

beforeEach(() => db.reset());
afterAll(() => db.close());

test.each(['staff', 'instructor'])('%s 계정은 권한 없이 해당 학원의 월간 배정을 볼 수 있다', async role => {
    await db.query('UPDATE users SET role = ?, permissions = ? WHERE id = 20', [role, '{}']);
    await db.query('UPDATE instructors SET name = ? WHERE id = 1', [encrypt('김강사')]);
    const result = await read({ year: 2026, month: 9, academy_id: 2 });
    expect(result.status).toBe(200);
    expect(result.body.year_month).toBe('2026-09');
    expect(result.body.schedules.map(row => row.id)).toEqual([1, 2, 7, 3]);
    expect(result.body.schedules[0]).toEqual({
        id: 1, instructor_id: 1, instructor_name: '김강사', work_date: '2026-09-01',
        time_slot: 'morning', scheduled_start_time: '09:00:00', scheduled_end_time: '12:00:00',
    });
    expect(result.body.instructors.map(row => row.id).sort()).toEqual([1, 2, 4]);
    expect(result.body.instructors.every(row => Object.keys(row).sort().join() === 'id,name')).toBe(true);
    expect(JSON.stringify(result.body)).not.toMatch(/hourly_rate|salary_type|ENC:|다른 학원|삭제 강사/);
});

test('빈 달과 연말 경계가 정확하다', async () => {
    expect((await read({ year: 2026, month: 12 })).body.schedules).toEqual([]);
    expect((await read({ year: 2026, month: 10 })).body.schedules.map(row => row.id)).toEqual([6]);
});

test('로그인·계정 승인이 필요하고 조회 공개가 근무 수정 권한을 주지 않는다', async () => {
    expect((await request(app).get(path).query({ year: 2026, month: 9 })).status).toBe(401);
    expect((await request(app).post('/paca/schedules/date/2026-09-01/instructor-schedules')
        .set('Authorization', auth()).send({ schedules: [] })).status).toBe(403);
    expect((await request(app).post('/paca/schedules/date/2026-09-01/instructor-attendance')
        .set('Authorization', auth()).send({ attendances: [] })).status).toBe(403);
    await db.query('UPDATE users SET approval_status = ? WHERE id = 20', ['pending']);
    expect((await read()).status).toBe(403);
});

test.each([{}, { year: 2026, month: 13 }, { year: 2026, month: 0 }, { year: '2026 OR 1=1', month: 9 }])('잘못된 월은 거부한다: %j', async query => {
    const result = await read(query);
    expect(result.status).toBe(400);
    expect(result.body.message).toBe('조회할 연도와 월을 확인해주세요.');
});

test('조회 실패에 기술 정보가 노출되지 않는다', async () => {
    db.exec('DROP TABLE instructor_schedules');
    const result = await read();
    expect(result.status).toBe(500);
    expect(result.body.message).toBe('강사 근무 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.');
    expect(JSON.stringify(result.body)).not.toMatch(/SQL|stack|HTTP|no such table/i);
});
