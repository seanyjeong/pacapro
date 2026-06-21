/**
 * routes/seasons/students.js 테스트 (Phase 3 #5).
 *
 * 회귀 보호 범위:
 *   - GET    /paca/seasons/:id/students                → {message, enrolled_students}
 *   - DELETE /paca/seasons/:id/students/:student_id    → {message, refundCalculation}
 *   - DB 호출: pool.execute (ADR-005)
 *   - 5xx: 한국어 메시지 (ADR-003)
 *   - decrypt 시그니처 보존 (ADR-007) — student_name / student_phone / parent_phone 3종
 *   - calculateSeasonRefund 호출 인자 (seasonFee + refundPolicy:'legal') — enrollments.cancel 과 의도된 차이
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => (v ? v.replace(/^enc_/, '') : v)),
}));

jest.mock('../../../utils/seasonCalculator', () => ({
    calculateProRatedFee: jest.fn(),
    calculateSeasonRefund: jest.fn(() => ({
        refundAmount: 30000,
    })),
    calculateMidSeasonFee: jest.fn(),
    parseWeeklyDays: jest.fn(() => [1, 3]),
    previewSeasonTransition: jest.fn(),
    truncateToThousands: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { decrypt } = require('../../../utils/encryption');
const { calculateSeasonRefund } = require('../../../utils/seasonCalculator');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/seasons/students')(router);
    app.use('/paca/seasons', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    decrypt.mockClear();
    calculateSeasonRefund.mockClear();
});

describe('GET /paca/seasons/:id/students', () => {
    test('200: 응답 표면 {message, enrolled_students} + decrypt 3종 호출', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[
            {
                id: 1, student_name: 'enc_홍길동',
                student_phone: 'enc_010-1111', parent_phone: 'enc_010-2222',
                student_number: 'S1', class_days: '월', student_grade: '고2'
            }
        ]]);
        const res = await request(makeApp()).get('/paca/seasons/5/students');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Found 1 enrolled students');
        expect(res.body).toHaveProperty('enrolled_students');
        expect(Array.isArray(res.body.enrolled_students)).toBe(true);
        expect(res.body.enrolled_students[0].student_name).toBe('홍길동');
        // decrypt 3건 (name + phone + parent_phone)
        expect(decrypt).toHaveBeenCalledTimes(3);
    });

    test('학원 격리: WHERE s.academy_id = ? + params 순서', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/seasons/5/students');
        const sql = pool.execute.mock.calls[0][0];
        expect(sql).toMatch(/WHERE ss\.season_id = \?/);
        expect(sql).toMatch(/AND s\.academy_id = \?/);
        expect(pool.execute.mock.calls[0][1]).toEqual([5, 1]);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).get('/paca/seasons/5/students');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 등록 학생 목록을 불러오지 못했습니다.');
    });
});

describe('DELETE /paca/seasons/:id/students/:student_id', () => {
    test('404: 미존재 enrollment', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).delete('/paca/seasons/5/students/10');
        expect(res.status).toBe(404);
    });

    test('403: 다른 학원 enrollment', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 2, payment_status: 'pending', student_name: 'enc_x',
            class_days: '월', season_name: 'S', season_start_date: '2026-03-01', season_end_date: '2026-08-31'
        }]]);
        const res = await request(makeApp()).delete('/paca/seasons/5/students/10');
        expect(res.status).toBe(403);
    });

    test('400: 이미 cancelled', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 1, payment_status: 'cancelled', student_name: 'enc_x',
            class_days: '월', season_name: 'S', season_start_date: '2026-03-01', season_end_date: '2026-08-31'
        }]]);
        const res = await request(makeApp()).delete('/paca/seasons/5/students/10');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Enrollment already cancelled');
    });

    test('200: 정상 — refund expense INSERT (paid 일 때) + DELETE student_seasons + UPDATE students + DELETE student_payments + 응답 {message, refundCalculation}', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 1, payment_status: 'paid',
            student_name: 'enc_홍길동', class_days: '월수',
            season_name: '2026 봄', season_fee: 100000,
            season_start_date: '2026-03-01', season_end_date: '2026-08-31'
        }]]);
        pool.execute.mockResolvedValueOnce([{ insertId: 1 }]);   // expenses INSERT
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE student_seasons
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE students
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE student_payments

        const res = await request(makeApp()).delete('/paca/seasons/5/students/10');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season enrollment deleted successfully');
        expect(res.body.refundCalculation).toBeDefined();
        // calculateSeasonRefund 호출 인자 셰이프 (seasonFee + refundPolicy:'legal' — enrollments.cancel 과 의도된 차이)
        expect(calculateSeasonRefund).toHaveBeenCalledTimes(1);
        const callArg = calculateSeasonRefund.mock.calls[0][0];
        expect(callArg).toHaveProperty('seasonFee');
        expect(callArg).toHaveProperty('refundPolicy', 'legal');
        // 핵심 SQL 호출
        const calls = pool.execute.mock.calls.map(c => c[0]);
        expect(calls.some(c => c.includes('INSERT INTO expenses'))).toBe(true);
        expect(calls.some(c => c.includes('DELETE FROM student_seasons'))).toBe(true);
        expect(calls.some(c => c.includes('UPDATE students SET is_season_registered = false'))).toBe(true);
        expect(calls.some(c => c.includes('DELETE FROM student_payments'))).toBe(true);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).delete('/paca/seasons/5/students/10');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 등록 취소에 실패했습니다.');
    });
});
