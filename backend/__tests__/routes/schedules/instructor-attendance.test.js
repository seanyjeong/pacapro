/**
 * routes/schedules/instructor-attendance.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - GET  /:id/instructor-attendance        → 미존재 404 / 정상 {message, schedule, attendances[]}
 *   - POST /:id/instructor-attendance        → validation / 트랜잭션 / 5xx + rollback
 *   - GET  /date/:date/instructor-attendance → 잘못된 날짜 / 정상 {date, attendances, instructors, instructors_by_slot}
 *   - POST /date/:date/instructor-attendance → validation / none 처리 / 정상
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
const { updateSalaryFromAttendance } = require('../../../utils/salaryCalculator');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/schedules/instructor-attendance')(router);
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
    updateSalaryFromAttendance.mockReset().mockResolvedValue();
});

describe('GET /paca/schedules/:id/instructor-attendance', () => {
    test('스케줄 미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/schedules/1/instructor-attendance');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
    });

    test('정상 → {message, schedule, attendances}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-15', time_slot: 'evening', instructor_id: 5, instructor_name: 'enc' }]]);
        pool.query.mockResolvedValueOnce([[{ id: 1, instructor_id: 5, instructor_name: 'enc', time_slot: 'evening', attendance_status: 'present' }]]);
        const res = await request(makeApp()).get('/paca/schedules/1/instructor-attendance');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('schedule');
        expect(res.body).toHaveProperty('attendances');
        expect(res.body.attendances.length).toBe(1);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/1/instructor-attendance');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('강사 출결 정보를 불러오지 못했습니다.');
    });
});

describe('POST /paca/schedules/:id/instructor-attendance', () => {
    test('빈 배열 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/1/instructor-attendance').send({ attendances: [] });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('attendances 는 비어있지 않은 배열이어야 합니다.');
    });

    test('스케줄 미존재 → 404 + release', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/schedules/1/instructor-attendance')
            .send({ attendances: [{ instructor_id: 5, attendance_status: 'present' }] });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
        expect(fakeConn.release).toHaveBeenCalled();
    });

    test('정상: 1건 처리 + commit + updateSalaryFromAttendance 호출', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-15', time_slot: 'evening' }]]); // schedules
        fakeConn.query.mockResolvedValueOnce([[{ id: 5, name: 'enc' }]]); // instructors
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPSERT
        const res = await request(makeApp())
            .post('/paca/schedules/1/instructor-attendance')
            .send({ attendances: [{ instructor_id: 5, attendance_status: 'present', time_slot: 'evening' }] });
        expect(res.status).toBe(200);
        expect(fakeConn.commit).toHaveBeenCalled();
        expect(fakeConn.release).toHaveBeenCalled();
        expect(updateSalaryFromAttendance).toHaveBeenCalledWith(fakeConn, 5, 1, '2026-01-15', 'present');
    });

    test('잘못된 status → 400 + rollback', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-15', time_slot: 'evening' }]]);
        const res = await request(makeApp())
            .post('/paca/schedules/1/instructor-attendance')
            .send({ attendances: [{ instructor_id: 5, attendance_status: 'invalid' }] });
        expect(res.status).toBe(400);
        expect(fakeConn.rollback).toHaveBeenCalled();
    });
});

describe('GET /paca/schedules/date/:date/instructor-attendance', () => {
    test('잘못된 날짜 형식 → 400 한국어', async () => {
        const res = await request(makeApp()).get('/paca/schedules/date/2026_01_01/instructor-attendance');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('날짜는 YYYY-MM-DD 형식이어야 합니다.');
    });

    test('정상 → {date, attendances, instructors, instructors_by_slot}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 5, name: 'enc', salary_type: 'monthly' }]]); // allActiveInstructors
        pool.query.mockResolvedValueOnce([[]]); // scheduledInstructors
        pool.query.mockResolvedValueOnce([[]]); // approvedExtraDays
        pool.query.mockResolvedValueOnce([[]]); // attendances
        const res = await request(makeApp()).get('/paca/schedules/date/2026-01-15/instructor-attendance');
        expect(res.status).toBe(200);
        expect(res.body.date).toBe('2026-01-15');
        expect(res.body).toHaveProperty('instructors_by_slot');
        expect(res.body.instructors_by_slot).toEqual({ morning: [], afternoon: [], evening: [] });
        expect(res.body.instructors.length).toBe(1);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/date/2026-01-15/instructor-attendance');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('강사 출결 정보를 불러오지 못했습니다.');
    });
});

describe('POST /paca/schedules/date/:date/instructor-attendance', () => {
    test('잘못된 날짜 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026_01_01/instructor-attendance')
            .send({ attendances: [{ instructor_id: 5, attendance_status: 'present', time_slot: 'evening' }] });
        expect(res.status).toBe(400);
    });

    test('빈 배열 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-attendance')
            .send({ attendances: [] });
        expect(res.status).toBe(400);
    });

    test("attendance_status='none' → cleared:true 응답 + UPDATE NULL", async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE NULL
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-attendance')
            .send({ attendances: [{ instructor_id: 5, time_slot: 'evening', attendance_status: 'none' }] });
        expect(res.status).toBe(200);
        expect(res.body.attendance_records[0]).toEqual({
            instructor_id: 5,
            time_slot: 'evening',
            attendance_status: null,
            cleared: true,
        });
    });

    test('정상 (1건 present) → commit + updateSalaryFromAttendance', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockResolvedValueOnce([[{ id: 5, name: 'enc' }]]); // instructors
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPSERT
        const res = await request(makeApp())
            .post('/paca/schedules/date/2026-01-15/instructor-attendance')
            .send({ attendances: [{ instructor_id: 5, time_slot: 'evening', attendance_status: 'present' }] });
        expect(res.status).toBe(200);
        expect(fakeConn.commit).toHaveBeenCalled();
        expect(updateSalaryFromAttendance).toHaveBeenCalledWith(fakeConn, 5, 1, '2026-01-15', 'present');
    });
});
