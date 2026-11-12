/**
 * routes/schedules/class-roster.js 테스트 — 반 명단 출석 조회.
 *   - 입력 검증 / 다른 학원 반 404 / 수업이 없을 때 / 수업이 있을 때 출결 상태 / 5xx 한국어 메시지
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
    require('../../../routes/schedules/class-roster')(router);
    app.use('/paca/schedules', router);
    return app;
}

const klass = { id: 8, class_name: '정시반', branch_id: 3, default_time_slot: 'evening' };
const row = (id, name, attendance = {}) => ({ student_id: id, student_name: name, grade: '고3', phone: null, parent_phone: null,
    attendance_id: null, attendance_status: null, notes: null, is_makeup: null, ...attendance });

beforeEach(() => {
    pool.query.mockReset();
});

describe('GET /paca/schedules/class-roster', () => {
    test('400: 날짜·반 번호·시간대 형식이 틀리면 DB 를 읽지 않는다', async () => {
        for (const query of [{}, { date: '2026-11-12' }, { class_id: '8' }, { date: '20261112', class_id: '8' },
            { date: '2026-11-12', class_id: 'x' }, { date: '2026-11-12', class_id: '8', time_slot: 'night' }]) {
            const res = await request(makeApp()).get('/paca/schedules/class-roster').query(query);
            expect(res.status).toBe(400);
        }
        expect(pool.query).not.toHaveBeenCalled();
    });

    test('404: 내 학원 반이 아니면 명단을 읽지 않는다', async () => {
        pool.query.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/schedules/class-roster').query({ date: '2026-11-12', class_id: '8' });
        expect(res.status).toBe(404);
        expect(pool.query).toHaveBeenCalledTimes(1);
        expect(pool.query.mock.calls[0][1]).toEqual([8, 1]);
    });

    test('200: 그날 수업이 없어도 반 전원이 가나다순으로 나오고, 아무것도 만들지 않는다', async () => {
        pool.query
            .mockResolvedValueOnce([[klass]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[row(2, '나학생'), row(1, '가학생')]]);
        const res = await request(makeApp()).get('/paca/schedules/class-roster').query({ date: '2026-11-12', class_id: '8' });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ class: { id: 8, class_name: '정시반', branch_id: 3 }, date: '2026-11-12',
            time_slot: 'evening', schedule: null });
        expect(res.body.students.map(s => [s.student_name, s.assigned, s.attendance_status])).toEqual([['가학생', false, null], ['나학생', false, null]]);
        expect(pool.query.mock.calls[1][1]).toEqual([1, '2026-11-12', 'evening']);
        expect(pool.query.mock.calls[2][1]).toEqual([null, 1, 8]);
        expect(pool.query.mock.calls.every(([sql]) => /^\s*SELECT/.test(sql))).toBe(true);
    });

    test('200: 수업이 있으면 이미 들어 있는 학생의 출결·보강 표시가 붙고, 시간대를 주면 그 시간대를 본다', async () => {
        pool.query
            .mockResolvedValueOnce([[klass]])
            .mockResolvedValueOnce([[{ id: 55, attendance_taken: 1 }]])
            .mockResolvedValueOnce([[row(1, '가학생', { attendance_id: 900, attendance_status: 'present', is_makeup: 1 }), row(2, '나학생')]]);
        const res = await request(makeApp()).get('/paca/schedules/class-roster')
            .query({ date: '2026-11-12', class_id: '8', time_slot: 'morning' });
        expect(res.status).toBe(200);
        expect(res.body.time_slot).toBe('morning');
        expect(res.body.schedule).toEqual({ id: 55, attendance_taken: 1 });
        expect(res.body.students).toEqual([
            expect.objectContaining({ student_id: 1, assigned: true, attendance_status: 'present', is_makeup: 1 }),
            expect.objectContaining({ student_id: 2, assigned: false, attendance_status: null, is_makeup: 0 }),
        ]);
        expect(res.body.students[0]).not.toHaveProperty('attendance_id');
        expect(pool.query.mock.calls[2][1]).toEqual([55, 1, 8]);
    });

    test('500: 한국어 메시지만 내주고 원본 오류는 숨긴다', async () => {
        pool.query.mockRejectedValueOnce(new Error('ER_SECRET detail'));
        const res = await request(makeApp()).get('/paca/schedules/class-roster').query({ date: '2026-11-12', class_id: '8' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('반 명단을 불러오지 못했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('ER_SECRET');
    });
});
