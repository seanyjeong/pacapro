/**
 * routes/schedules/instructor-schedules.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - GET  /date/:date/instructor-schedules → 잘못된 날짜 / 정상 {date, instructors, schedules}
 *   - POST /date/:date/instructor-schedules → validation / 트랜잭션 / 정상
 *   - GET  /instructor-schedules/month      → year/month 누락 / 정상 {year_month, schedules}
 *   - 5xx 한국어 메시지 (ADR-003)
 */

jest.mock('../../../config/database', () => {
    const fakeConn = {
        query: jest.fn(),
        beginTransaction: jest.fn(),
        commit: jest.fn(),
        rollback: jest.fn(),
        release: jest.fn(),
    };
    return {
        execute: jest.fn(),
        query: jest.fn(),
        getConnection: jest.fn(() => Promise.resolve(fakeConn)),
        __conn: fakeConn,
    };
});

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, id: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/attendanceValidator', () => ({
    validateAttendance: jest.fn(),
}));

jest.mock('../../../utils/salaryCalculator', () => ({
    updateSalaryFromAttendance: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const fakeConn = pool.__conn;

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/schedules/instructor-schedules')(router);
    app.use('/paca/schedules', router);
    return app;
}

beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[]]);
    fakeConn.query.mockReset();
    fakeConn.query.mockResolvedValue([[]]);
    fakeConn.beginTransaction.mockReset().mockResolvedValue();
    fakeConn.commit.mockReset().mockResolvedValue();
    fakeConn.rollback.mockReset().mockResolvedValue();
    fakeConn.release.mockReset();
});

describe('GET /paca/schedules/date/:date/instructor-schedules', () => {
    test('잘못된 날짜 → 400 한국어', async () => {
        const res = await request(makeApp()).get('/paca/schedules/date/bad/instructor-schedules');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('날짜는 YYYY-MM-DD 형식이어야 합니다.');
    });

    test('정상 → {date, instructors, schedules: { morning, afternoon, evening }}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 5, name: 'enc' }]]); // instructors
        pool.query.mockResolvedValueOnce([[{ id: 1, instructor_id: 5, time_slot: 'evening', instructor_name: 'enc' }]]); // schedules
        const res = await request(makeApp()).get('/paca/schedules/date/2026-01-15/instructor-schedules');
        expect(res.status).toBe(200);
        expect(res.body.date).toBe('2026-01-15');
        expect(res.body.schedules.evening.length).toBe(1);
        expect(res.body.schedules.morning).toEqual([]);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/date/2026-01-15/instructor-schedules');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('강사 근무 일정을 불러오지 못했습니다.');
    });
});

describe('POST /paca/schedules/date/:date/instructor-schedules', () => {
    test('잘못된 날짜 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/date/bad/instructor-schedules')
            .send({ schedules: [] });
        expect(res.status).toBe(400);
    });

    test('schedules 가 배열 아님 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-schedules')
            .send({ schedules: 'not-array' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('schedules 는 배열이어야 합니다.');
    });

    test('정상 (1건 추가) → commit + {date, schedules}', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE
        fakeConn.query.mockResolvedValueOnce([[{ id: 5, name: 'enc' }]]); // instructors lookup
        fakeConn.query.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-schedules')
            .send({ schedules: [{ instructor_id: 5, time_slot: 'evening' }] });
        expect(res.status).toBe(200);
        expect(fakeConn.commit).toHaveBeenCalled();
        expect(res.body.schedules.length).toBe(1);
    });

    test('잘못된 time_slot → 400 + rollback + release', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-schedules')
            .send({ schedules: [{ instructor_id: 5, time_slot: 'bad' }] });
        expect(res.status).toBe(400);
        expect(fakeConn.rollback).toHaveBeenCalled();
        expect(fakeConn.release).toHaveBeenCalled();
    });

    test('강사 미존재 → 404 + rollback', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 0 }]); // DELETE
        fakeConn.query.mockResolvedValueOnce([[]]); // instructors empty
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-schedules')
            .send({ schedules: [{ instructor_id: 999, time_slot: 'evening' }] });
        expect(res.status).toBe(404);
        expect(fakeConn.rollback).toHaveBeenCalled();
    });
});

describe('GET /paca/schedules/instructor-schedules/month', () => {
    test('year/month 누락 → 400 한국어', async () => {
        const res = await request(makeApp()).get('/paca/schedules/instructor-schedules/month');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('year 와 month 는 필수입니다.');
    });

    test('정상 → {year_month, schedules: Record<dateStr, slots>}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ work_date: '2026-01-15', time_slot: 'evening', scheduled_count: 2 }]]); // scheduledCounts
        pool.query.mockResolvedValueOnce([[{ work_date: '2026-01-15', time_slot: 'evening', attended_count: 1 }]]); // attendedCounts
        const res = await request(makeApp()).get('/paca/schedules/instructor-schedules/month?year=2026&month=1');
        expect(res.status).toBe(200);
        expect(res.body.year_month).toBe('2026-01');
        expect(res.body.schedules['2026-01-15'].evening.scheduled).toBe(2);
        expect(res.body.schedules['2026-01-15'].evening.attended).toBe(1);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/instructor-schedules/month?year=2026&month=1');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('월별 강사 일정을 불러오지 못했습니다.');
    });
});
