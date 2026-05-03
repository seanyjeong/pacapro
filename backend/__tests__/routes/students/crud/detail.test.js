/**
 * routes/students/crud/detail.js 테스트 (Phase 3 #4).
 *
 * 회귀 보호 범위:
 *   - GET /paca/students/:id 응답 표면 (ADR-013): {student, performances, payments} (message root key 없음)
 *   - 학생 미존재 → 404 한국어 (ADR-003)
 *   - DB 호출 3건: students (JOIN academies) / student_performance / student_payments — pool.execute (ADR-005)
 *   - decryptFields(students[0], ENCRYPTED_FIELDS.students) 시그니처 보존 (ADR-007)
 *   - 5xx 한국어 + e.message 누출 0건
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => `enc_${v}`),
    decrypt: jest.fn((v) => v),
    decryptFields: jest.fn((row) => ({ ...row, name: '복호화_홍길동' })),
    decryptArrayFields: jest.fn((rows) => rows),
    ENCRYPTED_FIELDS: { students: ['name', 'phone'] },
}));

jest.mock('../../../../utils/dueDateCalculator', () => ({ calculateDueDate: jest.fn() }));
jest.mock('../../../../utils/auditLogger', () => ({ logAudit: jest.fn(), getAuditInfoFromReq: jest.fn() }));
jest.mock('../../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(),
    extractDayNumbers: jest.fn(),
    autoAssignStudentToSchedules: jest.fn(),
    reassignStudentSchedules: jest.fn(),
    truncateToThousands: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../../config/database');
const { decryptFields } = require('../../../../utils/encryption');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../../routes/students/crud/detail')(router);
    app.use('/paca/students', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    decryptFields.mockClear();
});

describe('GET /paca/students/:id (detail)', () => {
    test('학생 미존재 → 404 한국어', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // students 빈 배열
        const res = await request(makeApp()).get('/paca/students/999');
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.' });
    });

    test('정상 → {student, performances, payments} 응답 표면 보존 (message root 없음)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5, name: 'enc_홍길동', academy_id: 1 }]])  // students
            .mockResolvedValueOnce([[{ id: 1, record_date: '2026-01-01' }]])           // performances
            .mockResolvedValueOnce([[{ id: 10, year_month: '2026-01', final_amount: 300000 }]]);  // payments
        const res = await request(makeApp()).get('/paca/students/5');
        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('student');
        expect(res.body).toHaveProperty('performances');
        expect(res.body).toHaveProperty('payments');
        expect(res.body).not.toHaveProperty('message'); // 원본 응답 표면 (message root 없음)
        expect(res.body.student.name).toBe('복호화_홍길동');
        expect(res.body.performances).toHaveLength(1);
        expect(res.body.payments).toHaveLength(1);
    });

    test('DB 호출 3건 (ADR-005 pool.execute) — students JOIN academies / student_performance / student_payments', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 5, name: 'enc_홍' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students/5');
        expect(pool.execute).toHaveBeenCalledTimes(3);
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM students s\s+LEFT JOIN academies/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/FROM student_performance/);
        expect(pool.execute.mock.calls[2][0]).toMatch(/FROM student_payments/);
    });

    test('학원 격리: SELECT 첫 번째 호출 params = [studentId, academyId]', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 7 }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students/7');
        const [, params] = pool.execute.mock.calls[0];
        expect(params).toEqual([7, 1]);
    });

    test('decryptFields(students[0], ENCRYPTED_FIELDS.students) 시그니처 보존 (ADR-007)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ id: 7, name: 'enc_홍' }]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]]);
        await request(makeApp()).get('/paca/students/7');
        expect(decryptFields).toHaveBeenCalledTimes(1);
        expect(decryptFields).toHaveBeenCalledWith(
            { id: 7, name: 'enc_홍' },
            ['name', 'phone']
        );
    });

    test('5xx 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_INFO'));
        const res = await request(makeApp()).get('/paca/students/5');
        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Server Error', message: '학생 정보를 불러오지 못했습니다.' });
        expect(JSON.stringify(res.body)).not.toContain('SECRET_INFO');
    });
});
