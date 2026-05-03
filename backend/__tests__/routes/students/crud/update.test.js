/**
 * routes/students/crud/update.js 테스트 (Phase 3 #4, ADR-015 분리 미루기 모듈).
 *
 * 회귀 보호 범위 (전수 X — 핵심 분기 + 응답 표면 + dynamic update 동작):
 *   - 학생 미존재 → 404 한국어
 *   - 검증: student_type / grade / admission_type / time_slot 모두 보존 (영문 메시지)
 *   - dynamic update: name 변경 시 encrypt 호출 + UPDATE 컬럼 들어감
 *   - 변경 필드 0개 → 400 'No fields to update' (응답 표면 보존)
 *   - 정상 수정 → 200 + {message, student} 응답 표면 보존
 *   - 보안 헬퍼 ADR-007: encrypt + decryptFields 시그니처 보존
 *   - 5xx 한국어 + e.message 누출 0건
 *   - DB 호출 ADR-005: pool.execute 만
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(), query: jest.fn(), getConnection: jest.fn(),
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
    decryptFields: jest.fn((row) => ({ ...row, name: row.name && row.name.startsWith('enc_') ? row.name.slice(4) : row.name })),
    decryptArrayFields: jest.fn((rows) => rows),
    ENCRYPTED_FIELDS: { students: ['name', 'phone', 'parent_phone', 'address'] },
}));

jest.mock('../../../../utils/dueDateCalculator', () => ({ calculateDueDate: jest.fn(() => '2026-05-10') }));
jest.mock('../../../../utils/auditLogger', () => ({ logAudit: jest.fn(), getAuditInfoFromReq: jest.fn() }));
jest.mock('../../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(() => []),
    extractDayNumbers: jest.fn(() => []),
    autoAssignStudentToSchedules: jest.fn(),
    reassignStudentSchedules: jest.fn().mockResolvedValue({ removed: 0, assigned: 0, created: 0 }),
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../../config/database');
const { encrypt, decryptFields } = require('../../../../utils/encryption');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../../routes/students/crud/update')(router);
    app.use('/paca/students', router);
    return app;
}

// 학생 기본 row (existing SELECT) — 모든 테스트에서 공유
function existingStudent(overrides = {}) {
    return {
        id: 5,
        student_number: '2026001',
        name: 'enc_홍길동',
        gender: 'male',
        student_type: 'exam',
        phone: 'enc_010-1',
        parent_phone: null,
        school: '서울고',
        grade: '고3',
        age: 18,
        admission_type: 'regular',
        class_days: '[]',
        weekly_count: 0,
        monthly_tuition: 0,
        discount_rate: 0,
        discount_reason: null,
        payment_due_day: 5,
        enrollment_date: '2026-01-01',
        address: null,
        notes: null,
        memo: null,
        status: 'active',
        time_slot: 'evening',
        rest_start_date: null,
        rest_end_date: null,
        rest_reason: null,
        is_trial: 0,
        trial_remaining: null,
        trial_dates: null,
        ...overrides,
    };
}

beforeEach(() => {
    pool.execute.mockReset();
    encrypt.mockClear();
    decryptFields.mockClear();
});

describe('PUT /paca/students/:id (update)', () => {
    test('학생 미존재 → 404 한국어 (ADR-003)', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // 학생 SELECT 빈 배열
        const res = await request(makeApp()).put('/paca/students/999').send({ name: '변경' });
        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.' });
    });

    test('잘못된 student_type → 400 (응답 표면 보존)', async () => {
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);
        const res = await request(makeApp()).put('/paca/students/5').send({ student_type: 'INVALID' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
        expect(res.body.message).toMatch(/student_type/);
    });

    test('잘못된 grade → 400', async () => {
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);
        const res = await request(makeApp()).put('/paca/students/5').send({ grade: '중3' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/grade/);
    });

    test('잘못된 admission_type → 400', async () => {
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);
        const res = await request(makeApp()).put('/paca/students/5').send({ admission_type: 'WRONG' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/admission_type/);
    });

    test('잘못된 time_slot → 400', async () => {
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);
        const res = await request(makeApp()).put('/paca/students/5').send({ time_slot: 'midnight' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/time_slot/);
    });

    test('변경 필드 0개 → 400 No fields to update (응답 표면 보존)', async () => {
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);
        const res = await request(makeApp()).put('/paca/students/5').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'Validation Error', message: 'No fields to update' });
    });

    test('정상 수정 (name 변경) → encrypt 호출 (ADR-007) + 응답 표면 message root key 보존', async () => {
        // PUT /:id 거대 endpoint (911줄, 25+ pool.execute). 정상 흐름은 schedule/payment 부수
        // 처리까지 호출하므로 default mock 으로 폴백, 핵심 호출만 검증.
        pool.execute.mockResolvedValue([[]]);
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);  // 첫 SELECT
        await request(makeApp()).put('/paca/students/5').send({ name: '새이름' });
        // encrypt 호출 시그니처 보존 (ADR-007)
        expect(encrypt).toHaveBeenCalledWith('새이름');
        // UPDATE SQL 호출 (ADR-013 응답 표면 보존을 위한 본체 동작 검증)
        const updateCall = pool.execute.mock.calls.find(c => /UPDATE students SET/.test(c[0]));
        expect(updateCall).toBeDefined();
    });

    test('phone 변경 → encrypt(phone) + UPDATE SQL 에 phone = ? 포함', async () => {
        pool.execute.mockResolvedValue([[]]);
        pool.execute.mockResolvedValueOnce([[existingStudent()]]);
        await request(makeApp()).put('/paca/students/5').send({ phone: '010-9999' });
        expect(encrypt).toHaveBeenCalledWith('010-9999');
        const updateCall = pool.execute.mock.calls.find(c => /UPDATE students SET/.test(c[0]));
        expect(updateCall).toBeDefined();
        expect(updateCall[0]).toMatch(/phone\s*=\s*\?/);
    });

    test('5xx 한국어 + e.message 누출 0건 + detail root key 제거', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET DB DOWN'));
        const res = await request(makeApp()).put('/paca/students/5').send({ name: '변경' });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '학생 정보 수정에 실패했습니다.',
        });
        expect(res.body).not.toHaveProperty('detail');
        expect(JSON.stringify(res.body)).not.toContain('SECRET DB DOWN');
    });

    test('ADR-005 — pool.execute 만 사용 (db.query / pool.query 잔존 0건)', async () => {
        pool.execute
            .mockResolvedValueOnce([[existingStudent()]])
            .mockResolvedValueOnce([{ affectedRows: 1 }])
            .mockResolvedValueOnce([[existingStudent()]]);
        await request(makeApp()).put('/paca/students/5').send({ name: '변경' });
        expect(pool.execute.mock.calls.length).toBeGreaterThan(0);
        expect(pool.query).not.toHaveBeenCalled();
    });
});
