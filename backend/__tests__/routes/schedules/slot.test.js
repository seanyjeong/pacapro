/**
 * routes/schedules/slot.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - GET    /paca/schedules/slot         → schedule null + students[] 분기
 *   - POST   /paca/schedules/slot/student → 검증 / 중복 / 보안(validateAttendance) / 정상
 *   - DELETE /paca/schedules/slot/student → 검증 / 스케줄 미존재 / 정상
 *   - POST   /paca/schedules/slot/move    → 검증 / 출발 미존재 / 정상
 *   - 5xx 한국어 메시지 (ADR-003)
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
const { validateAttendance } = require('../../../utils/attendanceValidator');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/schedules/slot')(router);
    app.use('/paca/schedules', router);
    return app;
}

beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[]]);
    validateAttendance.mockReset();
});

describe('GET /paca/schedules/slot', () => {
    test('date / time_slot 누락 → 400 한국어', async () => {
        const res = await request(makeApp()).get('/paca/schedules/slot');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('date 와 time_slot 은 필수입니다.');
    });

    test('스케줄 없음 + 다음 달 이후 → schedule null + students[] (자동 생성 X)', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[]]); // schedules
        pool.query.mockResolvedValueOnce([[]]); // eligibleStudents
        const future = '2099-12-31'; // 다음 달 이후
        const res = await request(makeApp()).get(`/paca/schedules/slot?date=${future}&time_slot=morning`);
        expect(res.status).toBe(200);
        expect(res.body).toEqual({ schedule: null, students: [] });
    });

    test('5xx 한국어 메시지', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/slot?date=2026-01-01&time_slot=morning');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('슬롯 정보를 불러오지 못했습니다.');
    });
});

describe('POST /paca/schedules/slot/student', () => {
    test('필수 필드 누락 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules/slot/student').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('date, time_slot, student_id 는 필수입니다.');
    });

    test('이미 배정된 학생 → 400 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 50 }]]); // schedules.length > 0
        pool.query.mockResolvedValueOnce([[{ id: 100 }]]); // existing.length > 0
        const res = await request(makeApp())
            .post('/paca/schedules/slot/student')
            .send({ date: '2026-01-01', time_slot: 'morning', student_id: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('이미 해당 수업에 배정된 학생입니다.');
    });

    test('학생-학원 소속 위반 (validateAttendance) → 403 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 50 }]]); // schedules
        pool.query.mockResolvedValueOnce([[]]); // existing empty
        validateAttendance.mockResolvedValueOnce({ valid: false, error: 'wrong academy' });
        const res = await request(makeApp())
            .post('/paca/schedules/slot/student')
            .send({ date: '2026-01-01', time_slot: 'morning', student_id: 5 });
        expect(res.status).toBe(403);
        expect(res.body.message).toBe('해당 학생은 이 학원 소속이 아닙니다.');
    });

    test('정상: is_makeup=1 → 보충 메시지', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 50 }]]); // schedules
        pool.query.mockResolvedValueOnce([[]]); // existing empty
        validateAttendance.mockResolvedValueOnce({ valid: true });
        pool.query.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT attendance
        const res = await request(makeApp())
            .post('/paca/schedules/slot/student')
            .send({ date: '2026-01-01', time_slot: 'morning', student_id: 5, is_makeup: true });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('보충 학생이 추가되었습니다.');
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/paca/schedules/slot/student')
            .send({ date: '2026-01-01', time_slot: 'morning', student_id: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('학생 배정에 실패했습니다.');
    });
});

describe('DELETE /paca/schedules/slot/student', () => {
    test('필수 필드 누락 → 400', async () => {
        const res = await request(makeApp()).delete('/paca/schedules/slot/student');
        expect(res.status).toBe(400);
    });

    test('스케줄 미존재 → 404 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .delete('/paca/schedules/slot/student?date=2026-01-01&time_slot=morning&student_id=5');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('해당 수업을 찾을 수 없습니다.');
    });

    test('정상 → message', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 50 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp())
            .delete('/paca/schedules/slot/student?date=2026-01-01&time_slot=morning&student_id=5');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('학생이 제거되었습니다.');
    });
});

describe('POST /paca/schedules/slot/move', () => {
    test('필수 필드 누락 → 400', async () => {
        const res = await request(makeApp()).post('/paca/schedules/slot/move').send({});
        expect(res.status).toBe(400);
    });

    test('출발 슬롯 미존재 → 404 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/schedules/slot/move')
            .send({ date: '2026-01-01', from_slot: 'morning', to_slot: 'evening', student_id: 5 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('출발 수업을 찾을 수 없습니다.');
    });

    test('정상 (도착 슬롯 자동 생성)', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 50 }]]); // from
        pool.query.mockResolvedValueOnce([[]]); // to empty
        pool.query.mockResolvedValueOnce([{ insertId: 60 }]); // INSERT to
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE attendance
        const res = await request(makeApp())
            .post('/paca/schedules/slot/move')
            .send({ date: '2026-01-01', from_slot: 'morning', to_slot: 'evening', student_id: 5 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('학생이 이동되었습니다.');
    });
});
