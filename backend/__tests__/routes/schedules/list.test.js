/**
 * routes/schedules/list.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - GET /paca/schedules                          → {message, schedules[]} + decrypt 호출
 *   - GET /paca/schedules/instructor/:instructor_id → {message, instructor, schedules[]} (강사 미존재 404)
 *   - 5xx 한국어 메시지 (ADR-003)
 *   - 응답 표면 보존 (ADR-013): schedules / instructor root 키
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, id: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v ? `dec(${v})` : v),
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

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/schedules/list')(router);
    app.use('/paca/schedules', router);
    return app;
}

beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[]]);
});

describe('GET /paca/schedules', () => {
    test('응답 표면: {message, schedules} + 빈 결과', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/schedules');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('schedules');
        expect(Array.isArray(res.body.schedules)).toBe(true);
        expect(res.body.schedules.length).toBe(0);
    });

    test('필터 (start_date, end_date, instructor_id, time_slot) 모두 적용', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, instructor_name: 'enc1' }]]);
        const res = await request(makeApp())
            .get('/paca/schedules?start_date=2026-01-01&end_date=2026-01-31&instructor_id=5&time_slot=morning');
        expect(res.status).toBe(200);
        const sql = pool.query.mock.calls[0][0];
        const params = pool.query.mock.calls[0][1];
        expect(sql).toMatch(/cs\.class_date >= \?/);
        expect(sql).toMatch(/cs\.class_date <= \?/);
        expect(sql).toMatch(/cs\.instructor_id = \?/);
        expect(sql).toMatch(/cs\.time_slot = \?/);
        expect(params).toEqual([1, '2026-01-01', '2026-01-31', 5, 'morning']);
        expect(res.body.schedules[0].instructor_name).toBe('dec(enc1)');
    });

    test('잘못된 time_slot 무시', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/schedules?time_slot=invalid');
        const sql = pool.query.mock.calls[0][0];
        expect(sql).not.toMatch(/cs\.time_slot = \?/);
    });

    test('5xx 한국어 메시지 (ADR-003) + e.message 누출 0건', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('DB connection lost'));
        const res = await request(makeApp()).get('/paca/schedules');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('스케줄 목록을 불러오지 못했습니다.');
        expect(res.body.message).not.toMatch(/DB connection lost/);
    });
});

describe('GET /paca/schedules/instructor/:instructor_id', () => {
    test('강사 미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]); // instructors lookup empty
        const res = await request(makeApp()).get('/paca/schedules/instructor/999');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('강사를 찾을 수 없습니다.');
    });

    test('정상 응답: {message, instructor, schedules}', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 5, name: 'enc-name' }]]); // instructors lookup
        pool.query.mockResolvedValueOnce([[{ id: 1, student_name: 'enc-stu' }]]); // schedules
        const res = await request(makeApp()).get('/paca/schedules/instructor/5');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('instructor');
        expect(res.body.instructor.name).toBe('dec(enc-name)');
        expect(res.body).toHaveProperty('schedules');
        expect(res.body.schedules[0].student_name).toBe('dec(enc-stu)');
    });

    test('5xx 한국어 메시지', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/instructor/5');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('강사 스케줄을 불러오지 못했습니다.');
    });
});
