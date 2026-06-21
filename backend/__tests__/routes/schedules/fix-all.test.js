/**
 * routes/schedules/fix-all.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - POST /fix-all → 정상 {message, results} + connection.release 호출
 *   - 5xx → 원본 동작 보존 (e.message 노출 — owner 전용 디버깅, 별도 트랙으로 fix)
 *   - 광역 미들웨어 추가 시 깨지지 않도록 owner 권한 검증 보존
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
    require('../../../routes/schedules/fix-all')(router);
    app.use('/paca/schedules', router);
    return app;
}

beforeEach(() => {
    fakeConn.query.mockReset();
    fakeConn.query.mockResolvedValue([[]]);
    fakeConn.release.mockReset();
});

describe('POST /paca/schedules/fix-all (owner only)', () => {
    test('정상 (잘못된 스케줄 0개 + 활성 학생 0명) → {message, results} + release 호출', async () => {
        fakeConn.query.mockReset();
        // 1. wrongSchedules — empty
        fakeConn.query.mockResolvedValueOnce([[]]);
        // 2. emptyScheduleResult
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 0 }]);
        // 3. activeStudents — empty
        fakeConn.query.mockResolvedValueOnce([[]]);

        const res = await request(makeApp()).post('/paca/schedules/fix-all').send({});
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('스케줄 정리 완료');
        expect(res.body.results.deleted_attendance).toBe(0);
        expect(res.body.results.deleted_empty_schedules).toBe(0);
        expect(res.body.results.created_schedules).toBe(0);
        expect(res.body.results.assigned_attendance).toBe(0);
        expect(res.body.results.details).toEqual(expect.arrayContaining([
            '발견된 잘못된 스케줄: 0개',
            '재배정 대상 학생: 0명',
        ]));
        expect(fakeConn.release).toHaveBeenCalled();
    });

    test('잘못된 스케줄 발견 시 DELETE attendance IN(?) 호출', async () => {
        fakeConn.query.mockReset();
        // 1. wrongSchedules — 2건
        fakeConn.query.mockResolvedValueOnce([[
            { attendance_id: 100, student_id: 1, schedule_id: 50, class_date: '2025-12-01', time_slot: 'morning' },
            { attendance_id: 101, student_id: 2, schedule_id: 51, class_date: '2025-12-02', time_slot: 'afternoon' },
        ]]);
        // 2. DELETE attendance IN
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 2 }]);
        // 3. emptyScheduleResult
        fakeConn.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // 4. activeStudents — empty
        fakeConn.query.mockResolvedValueOnce([[]]);

        const res = await request(makeApp()).post('/paca/schedules/fix-all').send({});
        expect(res.status).toBe(200);
        expect(res.body.results.deleted_attendance).toBe(2);
        expect(res.body.results.deleted_empty_schedules).toBe(1);
        // ADR-016 IN 절: 원본 db.query 자동 펼침 의존 — 분리 단계에서 동작 1:1 보존
        const deleteCall = fakeConn.query.mock.calls[1];
        expect(deleteCall[0]).toMatch(/DELETE FROM attendance WHERE id IN \(\?\)/);
        expect(deleteCall[1]).toEqual([[100, 101]]);
    });

    test('5xx (원본 동작 보존: e.message 노출, ADR-013 + lesson #228 변형) + release', async () => {
        fakeConn.query.mockReset();
        fakeConn.query.mockRejectedValueOnce(new Error('DB boom'));
        const res = await request(makeApp()).post('/paca/schedules/fix-all').send({});
        expect(res.status).toBe(500);
        // 원본 보존: e.message 노출 가능 (owner 전용 디버깅 의도, 별도 트랙으로 fix)
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBeDefined();
        expect(fakeConn.release).toHaveBeenCalled();
    });
});
