/**
 * routes/schedules/crud.js 테스트 (Phase 3 #7).
 *
 * 회귀 보호 범위:
 *   - GET    /:id                    → 미존재 404 / 정상 {message, schedule}
 *   - POST   /                       → validation / duplicate / 정상 201 {message, schedule}
 *   - PUT    /:id/assign-instructor  → 미존재 404 / 강사 미존재 404 / 정상
 *   - PUT    /:id                    → 필드 0개 400 / 정상 dynamic update
 *   - DELETE /:id                    → 미존재 404 / 정상
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

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/schedules/crud')(router);
    app.use('/paca/schedules', router);
    return app;
}

beforeEach(() => {
    pool.query.mockReset();
    pool.query.mockResolvedValue([[]]);
});

describe('GET /paca/schedules/:id', () => {
    test('미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/schedules/999');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
    });

    test('정상 → {message, schedule}', async () => {
        pool.query.mockResolvedValueOnce([[{ id: 1, instructor_name: 'enc-i', instructor_phone: 'enc-p' }]]);
        const res = await request(makeApp()).get('/paca/schedules/1');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('schedule');
        expect(res.body.schedule.id).toBe(1);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).get('/paca/schedules/1');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('수업 정보를 불러오지 못했습니다.');
    });
});

describe('POST /paca/schedules', () => {
    test('class_date / time_slot 누락 → 400 한국어', async () => {
        const res = await request(makeApp()).post('/paca/schedules').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('class_date 와 time_slot 은 필수입니다.');
    });

    test('잘못된 time_slot → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules')
            .send({ class_date: '2026-01-01', time_slot: 'bad' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/morning, afternoon, evening/);
    });

    test('잘못된 날짜 형식 → 400 한국어', async () => {
        const res = await request(makeApp())
            .post('/paca/schedules')
            .send({ class_date: '2026/01/01', time_slot: 'morning' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('class_date 는 YYYY-MM-DD 형식이어야 합니다.');
    });

    test('중복 스케줄 → 409 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 50 }]]); // existing
        const res = await request(makeApp())
            .post('/paca/schedules')
            .send({ class_date: '2026-01-01', time_slot: 'morning' });
        expect(res.status).toBe(409);
        expect(res.body.message).toBe('해당 날짜와 시간대에 이미 수업이 있습니다.');
    });

    test('정상 → 201 {message, schedule}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[]]); // existing empty
        pool.query.mockResolvedValueOnce([{ insertId: 99 }]); // INSERT
        pool.query.mockResolvedValueOnce([[{ id: 99, class_date: '2026-01-01' }]]); // SELECT
        const res = await request(makeApp())
            .post('/paca/schedules')
            .send({ class_date: '2026-01-01', time_slot: 'morning' });
        expect(res.status).toBe(201);
        expect(res.body.schedule.id).toBe(99);
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp())
            .post('/paca/schedules')
            .send({ class_date: '2026-01-01', time_slot: 'morning' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('수업 생성에 실패했습니다.');
    });
});

describe('PUT /paca/schedules/:id/assign-instructor', () => {
    test('스케줄 미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).put('/paca/schedules/1/assign-instructor').send({});
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
    });

    test('강사 미존재 → 404 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-01', time_slot: 'morning' }]]);
        pool.query.mockResolvedValueOnce([[]]); // instructors empty
        const res = await request(makeApp())
            .put('/paca/schedules/1/assign-instructor')
            .send({ instructor_id: 999 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('강사를 찾을 수 없습니다.');
    });

    test('정상 (instructor + time_slots upsert) → {message, schedule}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 1, class_date: '2026-01-01', time_slot: 'morning' }]]); // schedules
        pool.query.mockResolvedValueOnce([[{ id: 5, name: 'enc' }]]); // instructors
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE class_schedules
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPSERT instructor_attendance
        pool.query.mockResolvedValueOnce([[{ id: 1, instructor_name: 'enc' }]]); // SELECT updated
        const res = await request(makeApp())
            .put('/paca/schedules/1/assign-instructor')
            .send({ instructor_id: 5, time_slots: ['morning'] });
        expect(res.status).toBe(200);
        expect(res.body.schedule.id).toBe(1);
    });
});

describe('PUT /paca/schedules/:id', () => {
    test('스케줄 미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).put('/paca/schedules/1').send({ title: 'x' });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
    });

    test('필드 0개 → 400 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
        const res = await request(makeApp()).put('/paca/schedules/1').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('수정할 필드가 없습니다.');
    });

    test('정상 dynamic update → {message, schedule}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.query.mockResolvedValueOnce([[{ id: 1, title: 'NewTitle' }]]);
        const res = await request(makeApp()).put('/paca/schedules/1').send({ title: 'NewTitle' });
        expect(res.status).toBe(200);
        expect(res.body.schedule.title).toBe('NewTitle');
        const updateSql = pool.query.mock.calls[1][0];
        expect(updateSql).toMatch(/UPDATE class_schedules SET title = \?/);
    });
});

describe('DELETE /paca/schedules/:id', () => {
    test('미존재 → 404 한국어', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).delete('/paca/schedules/1');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('수업을 찾을 수 없습니다.');
    });

    test('정상 → {message}', async () => {
        pool.query.mockReset();
        pool.query.mockResolvedValueOnce([[{ id: 1 }]]);
        pool.query.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp()).delete('/paca/schedules/1');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Schedule deleted successfully');
    });

    test('5xx 한국어', async () => {
        pool.query.mockReset();
        pool.query.mockRejectedValueOnce(new Error('boom'));
        const res = await request(makeApp()).delete('/paca/schedules/1');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('수업 삭제에 실패했습니다.');
    });
});
