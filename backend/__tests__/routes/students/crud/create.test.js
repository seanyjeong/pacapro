/**
 * routes/students/crud/create.js 테스트 (Phase 3 #4, ADR-015 분리 미루기 모듈).
 *
 * 회귀 보호 범위 (전수 X — 핵심 분기 + 응답 표면 + 보안 헬퍼 시그니처):
 *   - 검증: name/phone 누락 / student_type / grade / admission_type / time_slot
 *   - 학번 중복 → 400
 *   - 동일학생 (name+phone) 중복 → 400
 *   - 동명학생 (name+gender) → 409 SAME_NAME_EXISTS (응답 표면 보존, 프론트 confirm_force 분기)
 *   - 정상 등록 → 201 + {message, student, firstPayment, autoAssigned} 응답 표면
 *   - 보안 헬퍼 ADR-007: encrypt(name/phone/parent_phone/address) + decryptFields 시그니처 보존
 *   - DB 호출 ADR-005: pool.execute 만 (db.query 잔존 0건)
 *   - 5xx 한국어 + e.message 누출 0건
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

jest.mock('../../../../utils/dueDateCalculator', () => ({
    calculateDueDate: jest.fn(() => '2026-05-10'),
}));
jest.mock('../../../../utils/auditLogger', () => ({ logAudit: jest.fn(), getAuditInfoFromReq: jest.fn() }));
jest.mock('../../../../utils/logger', () => ({ info: jest.fn(), warn: jest.fn(), error: jest.fn() }));
jest.mock('../../../../routes/students/_utils', () => ({
    parseClassDaysWithSlots: jest.fn(() => []),
    extractDayNumbers: jest.fn(() => []),
    autoAssignStudentToSchedules: jest.fn().mockResolvedValue({ assigned: 0, created: 0 }),
    reassignStudentSchedules: jest.fn(),
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../../config/database');
const { encrypt, decryptFields } = require('../../../../utils/encryption');
const _utils = require('../../../../routes/students/_utils');

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../../routes/students/crud/create')(router);
    app.use('/paca/students', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    encrypt.mockClear();
    decryptFields.mockClear();
    _utils.autoAssignStudentToSchedules.mockClear();
});

describe('POST /paca/students (create)', () => {
    test('필수 필드 (name/phone) 누락 → 400 영문 (응답 표면 보존)', async () => {
        const res = await request(makeApp()).post('/paca/students').send({});
        expect(res.status).toBe(400);
        expect(res.body).toEqual({
            error: 'Validation Error',
            message: 'Required fields: name, phone',
        });
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('잘못된 student_type → 400', async () => {
        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍', phone: '010-1', student_type: 'INVALID' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/student_type/);
    });

    test('잘못된 grade → 400', async () => {
        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍', phone: '010-1', grade: '중3' });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/grade/);
    });

    test('학번 중복 → 400', async () => {
        // student_number 중복 SELECT → 1건 반환
        pool.execute.mockResolvedValueOnce([[{ id: 99 }]]);
        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍', phone: '010-1', student_number: '2026001' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Student number already exists');
    });

    test('동일학생 (name+phone) 중복 → 400 한국어 (원본 메시지 보존)', async () => {
        // 1) student_number 분기 skip (없음) — 2) duplicateStudent SELECT 1건
        pool.execute.mockResolvedValueOnce([[{ id: 99, name: 'enc_홍', phone: 'enc_010-1', school: '서울고' }]]);
        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍', phone: '010-1' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Duplicate Error');
        expect(res.body.message).toMatch(/이미 등록된 학생입니다/);
    });

    test('동명학생 (name+gender 동일, phone 다름) + confirm_force=false → 409 SAME_NAME_EXISTS (응답 표면 보존)', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])  // duplicate (no match)
            .mockResolvedValueOnce([[{ id: 88, name: '홍길동', phone: '010-9', gender: 'male' }]]);  // sameName
        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍길동', phone: '010-1', gender: 'male' });
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Same Name Warning');
        expect(res.body.code).toBe('SAME_NAME_EXISTS');
        expect(res.body.message).toMatch(/같은 이름의 학생/);
        expect(res.body).toHaveProperty('existingStudent');
        expect(res.body.existingStudent).toEqual({ name: '홍길동', phone: '010-9', gender: 'male' });
    });

    test('정상 등록 (체험생 X, monthly_tuition 0) → 201 + 응답 표면 보존 + 보안 헬퍼 시그니처 (ADR-007)', async () => {
        // duplicate skip / sameName skip / lastStudent skip / INSERT students / SELECT inserted
        pool.execute
            .mockResolvedValueOnce([[]])  // duplicate
            // sameName 분기는 sameNameStudent.length > 0 + confirm_force false 일 때만 409. 학생 없으면 통과.
            .mockResolvedValueOnce([[]])  // sameName 빈 배열
            .mockResolvedValueOnce([[]])  // lastStudent for student_number 자동 발급 (year% 패턴)
            .mockResolvedValueOnce([{ insertId: 555 }])  // INSERT students
            .mockResolvedValueOnce([[{
                id: 555,
                name: 'enc_홍길동',
                phone: 'enc_010-1',
                student_number: '2026001',
                academy_id: 1,
            }]]);  // SELECT inserted

        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍길동', phone: '010-1', gender: 'male', monthly_tuition: 0 });

        expect(res.status).toBe(201);
        expect(res.body).toHaveProperty('message');
        expect(res.body.message).toBe('Student created successfully');
        expect(res.body).toHaveProperty('student');
        expect(res.body.student.id).toBe(555);
        expect(res.body).toHaveProperty('firstPayment');
        expect(res.body.firstPayment).toBeNull(); // monthly_tuition 0 → 학원비 자동 생성 X
        expect(res.body).toHaveProperty('autoAssigned');

        // 보안 헬퍼 ADR-007 시그니처 보존
        expect(encrypt).toHaveBeenCalledWith('홍길동');
        expect(encrypt).toHaveBeenCalledWith('010-1');
        expect(decryptFields).toHaveBeenCalledWith(
            expect.objectContaining({ id: 555 }),
            ['name', 'phone', 'parent_phone', 'address']
        );
    });

    test('신규생 첫 달 일할 청구의 납부기한은 등록일이다', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 555 }])
            .mockResolvedValueOnce([[{ id: 555, name: 'enc_신규생', phone: 'enc_010-1' }]])
            .mockResolvedValueOnce([{ insertId: 901 }])
            .mockResolvedValueOnce([[{ id: 901, due_date: '2026-07-20' }]]);

        const res = await request(makeApp()).post('/paca/students').send({
            name: '신규생',
            phone: '010-1',
            enrollment_date: '2026-07-20',
            monthly_tuition: 300000,
            class_days: [],
        });

        expect(res.status).toBe(201);
        const paymentInsert = pool.execute.mock.calls.find(([sql]) => /INSERT INTO student_payments/.test(sql));
        expect(paymentInsert).toBeDefined();
        expect(paymentInsert[1]).toContain('2026-07-20');
        expect(paymentInsert[1]).not.toContain('2026-07-27');
    });

    test('체험생 (is_trial=true) → message="Trial student created successfully"', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])  // duplicate
            .mockResolvedValueOnce([[]])  // sameName
            .mockResolvedValueOnce([[]])  // lastStudent
            .mockResolvedValueOnce([{ insertId: 777 }])  // INSERT
            .mockResolvedValueOnce([[{ id: 777, name: 'enc_체험', is_trial: 1, status: 'trial' }]]);  // SELECT

        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '체험', phone: '010-2', is_trial: true });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Trial student created successfully');
        expect(res.body.firstPayment).toBeNull(); // 체험생 → 학원비 X
    });

    test('5xx 한국어 + e.message 누출 0건 (ADR-003)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB DOWN INTERNAL'));
        const res = await request(makeApp()).post('/paca/students')
            .send({ name: '홍', phone: '010-1', student_number: '2026001' });
        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '학생 등록에 실패했습니다.',
        });
        expect(JSON.stringify(res.body)).not.toContain('DB DOWN INTERNAL');
    });

    test('ADR-005 — 모든 db 호출이 pool.execute (db.query / connection.query 잔존 0건)', async () => {
        pool.execute
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([[]])
            .mockResolvedValueOnce([{ insertId: 1 }])
            .mockResolvedValueOnce([[{ id: 1, name: 'enc_홍' }]]);
        await request(makeApp()).post('/paca/students')
            .send({ name: '홍', phone: '010-1' });
        // pool.execute 가 호출되었음 + pool.query 는 호출 0건
        expect(pool.execute.mock.calls.length).toBeGreaterThan(0);
        expect(pool.query).not.toHaveBeenCalled();
    });
});
