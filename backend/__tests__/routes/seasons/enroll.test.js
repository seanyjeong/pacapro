/**
 * routes/seasons/enroll.js 테스트 (Phase 3 #5).
 *
 * 회귀 보호 범위:
 *   - POST /paca/seasons/:id/enroll   → 201 {message, enrollment, proRatedCalculation, midSeasonProRated, schedule_assignment}
 *   - GET  /paca/seasons/:id/preview  → {message, preview} 또는 409 {error, message, enrolled}
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 일할계산 헬퍼 (calculateProRatedFee / calculateMidSeasonFee) 호출 인자 셰이프 보존
 *   - autoAssignStudentToSeasonSchedules / removeStudentFromRegularSchedules 호출 (active 시)
 *   - 거대 dynamic 분리 미루기 (ADR-015) — lesson #206: default mock + 핵심 호출만 검증
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
    calculateProRatedFee: jest.fn(() => ({
        proRatedFee: 30000,
        totalMonthlyClasses: 12,
        classCountUntilEnd: 8,
        perClassFee: 5000,
        proRatedDays: 8,
    })),
    calculateSeasonRefund: jest.fn(),
    calculateMidSeasonFee: jest.fn(() => ({
        proRatedFee: 80000,
        originalFee: 100000,
        discount: 20000,
        totalDays: 30,
        remainingDays: 24,
        details: '24/30',
        isProRated: true,
    })),
    parseWeeklyDays: jest.fn(() => [1, 3, 5]),
    previewSeasonTransition: jest.fn(),
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
}));

jest.mock('../../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const { calculateProRatedFee, calculateMidSeasonFee } = require('../../../utils/seasonCalculator');

function getInsertColumnsAndValues(sql) {
    const match = sql.match(/INSERT INTO student_payments\s*\(([\s\S]*?)\)\s*VALUES\s*\(([\s\S]*?)\)/i);
    if (!match) return { columns: [], values: [] };
    return {
        columns: match[1].split(',').map(v => v.replace(/`/g, '').trim()),
        values: match[2].split(',').map(v => v.trim()),
    };
}

function makeApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    require('../../../routes/seasons/enroll')(router);
    require('../../../routes/seasons/preview')(router);
    app.use('/paca/seasons', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    // lesson #206: default = 빈 배열 → 거대 endpoint 정상 케이스 검증 시 누락된 mock 회피
    pool.execute.mockResolvedValue([[]]);
    calculateProRatedFee.mockClear();
    calculateMidSeasonFee.mockClear();
});

describe('POST /paca/seasons/:id/enroll', () => {
    test('400: required 필드 누락', async () => {
        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/student_id, season_fee/);
    });

    test('404: 시즌 미존재 또는 ended', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]); // SELECT seasons → 0건
        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000
        });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Season not found or ended');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'active', non_season_end_date: '2026-02-28', operating_days: '["월"]', season_start_date: '2026-03-01', season_end_date: '2026-08-31' }]]);
        pool.execute.mockResolvedValueOnce([[]]); // 학생 없음
        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000
        });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Student not found');
    });

    test('400: 이미 등록 + 시즌비 청구가 있으면 중복 차단', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'active', non_season_end_date: '2026-02-28', operating_days: '["월"]', season_start_date: '2026-03-01', season_end_date: '2026-08-31' }]]);
        pool.execute.mockResolvedValueOnce([[{ id: 10, name: 'enc_x', class_days: '월수', monthly_tuition: 100000, discount_rate: 0, grade: '고2', student_type: 'regular' }]]);
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]); // existing > 0
        pool.execute.mockResolvedValueOnce([[{ id: 77 }]]); // existing season payment
        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Student already enrolled in this season');
        const insertPaymentCall = pool.execute.mock.calls.find(c => c[0].includes('INSERT INTO student_payments'));
        expect(insertPaymentCall).toBeUndefined();
    });

    test('400: invalid time_slots', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, status: 'active', non_season_end_date: '2026-02-28', operating_days: '["월"]', season_start_date: '2026-03-01', season_end_date: '2026-08-31', continuous_discount_type: 'none' }]]);
        pool.execute.mockResolvedValueOnce([[{ id: 10, name: 'enc_x', class_days: '월수', monthly_tuition: 100000, discount_rate: 0, grade: '고2', student_type: 'regular' }]]);
        pool.execute.mockResolvedValueOnce([[]]); // not enrolled
        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, time_slots: ['invalid_slot']
        });
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/Invalid time_slots/);
    });

    test('201: 정상 등록 — 응답 표면 + 핵심 SQL 호출 (lesson #206 default mock)', async () => {
        // ❶ SELECT seasons (status='upcoming' — schedule 자동배정 없음 분기)
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, status: 'upcoming', non_season_end_date: '2026-02-28',
            operating_days: '["월"]', season_start_date: '2026-03-01',
            season_end_date: '2026-08-31', continuous_discount_type: 'none',
            continuous_discount_rate: 0, season_name: '2026 봄',
            payment_due_date: '2026-02-25'
        }]]);
        // ❷ SELECT students
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수', monthly_tuition: 100000,
            discount_rate: 0, grade: '고2', student_type: 'regular'
        }]]);
        // ❸ SELECT existing (not enrolled)
        pool.execute.mockResolvedValueOnce([[]]);
        // ❹ SELECT existing season payment
        pool.execute.mockResolvedValueOnce([[]]);
        // ❺ INSERT student_seasons
        pool.execute.mockResolvedValueOnce([{ insertId: 99 }]);
        // ❻ UPDATE students
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // ❼ INSERT student_payments
        pool.execute.mockResolvedValueOnce([{ insertId: 50 }]);
        // ❽ DELETE replaced monthly payments
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        // ❾ SELECT enrollment 재조회
        pool.execute.mockResolvedValueOnce([[{
            id: 99, student_name: 'enc_홍길동', season_name: '2026 봄', season_type: 'regular'
        }]]);

        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, registration_date: '2026-02-15'
        });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Student enrolled in season successfully');
        expect(res.body.enrollment).toBeDefined();
        expect(res.body.enrollment.student_name).toBe('홍길동');
        expect(res.body.proRatedCalculation).toBeDefined();
        expect(res.body.schedule_assignment).toEqual({
            removed_from_regular: null,
            assigned_to_season: null
        });
        // 핵심 SQL 호출 확인
        const insertSeasonsCall = pool.execute.mock.calls.find(c => c[0].includes('INSERT INTO student_seasons'));
        const insertPaymentsCall = pool.execute.mock.calls.find(c => c[0].includes('INSERT INTO student_payments'));
        expect(insertSeasonsCall).toBeDefined();
        expect(insertPaymentsCall).toBeDefined();
        expect(insertPaymentsCall[0]).toContain('season_id');
        const { columns, values } = getInsertColumnsAndValues(insertPaymentsCall[0]);
        expect(values).toHaveLength(columns.length);
        expect(values[columns.indexOf('due_date')]).toBe('?');
        expect(values[columns.indexOf('payment_status')]).toBe("'pending'");
        expect(insertPaymentsCall[1]).toContain(5);
        expect(insertPaymentsCall[1][2]).toBe('2026-03');
        expect(insertPaymentsCall[1]).toContain('2026-02-25');
        const deleteMonthlyCall = pool.execute.mock.calls.find(c => c[0].includes('DELETE FROM student_payments') && c[0].includes("payment_type = 'monthly'"));
        expect(deleteMonthlyCall).toBeDefined();
        expect(deleteMonthlyCall[0]).toContain('payment_status IN (');
        expect(deleteMonthlyCall[0]).toContain("'unpaid'");
        expect(deleteMonthlyCall[0]).toContain("COALESCE(paid_amount, 0) = 0");
        expect(deleteMonthlyCall[1]).toEqual([10, 1, '2026-03', '2026-08']);
    });

    test('201: 시즌비가 월납부를 대체하지 않는 시즌은 기존 월회비를 삭제하지 않는다', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, status: 'upcoming', non_season_end_date: '2026-02-28',
            operating_days: '["월"]', season_start_date: '2026-03-01',
            season_end_date: '2026-08-31', continuous_discount_type: 'none',
            continuous_discount_rate: 0, season_name: '2026 봄',
            season_monthly_policy: 'season_plus_monthly'
        }]]);
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수', monthly_tuition: 100000,
            discount_rate: 0, grade: '고2', student_type: 'regular'
        }]]);
        pool.execute.mockResolvedValueOnce([[]]);
        pool.execute.mockResolvedValueOnce([[]]);
        pool.execute.mockResolvedValueOnce([{ insertId: 99 }]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.execute.mockResolvedValueOnce([{ insertId: 50 }]);
        pool.execute.mockResolvedValueOnce([[{
            id: 99, student_name: 'enc_홍길동', season_name: '2026 봄', season_type: 'regular'
        }]]);

        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, registration_date: '2026-02-15'
        });

        expect(res.status).toBe(201);
        const deleteMonthlyCall = pool.execute.mock.calls.find(c => c[0].includes('DELETE FROM student_payments') && c[0].includes("payment_type = 'monthly'"));
        expect(deleteMonthlyCall).toBeUndefined();
    });

    test('409: 같은 월 시즌비 청구가 이미 있으면 등록 전 차단', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, status: 'upcoming', non_season_end_date: '2026-02-28',
            operating_days: '["월"]', season_start_date: '2026-03-01',
            season_end_date: '2026-08-31', continuous_discount_type: 'none',
            continuous_discount_rate: 0, season_name: '2026 봄'
        }]]);
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수', monthly_tuition: 100000,
            discount_rate: 0, grade: '고2', student_type: 'regular'
        }]]);
        pool.execute.mockResolvedValueOnce([[]]); // same season not enrolled
        pool.execute.mockResolvedValueOnce([[{ id: 77 }]]); // existing season payment for month

        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, registration_date: '2026-02-15'
        });
        expect(res.status).toBe(409);
        expect(res.body.message).toContain('이미 존재합니다');

        const insertCall = pool.execute.mock.calls.find(c => c[0].includes('INSERT INTO student_seasons'));
        expect(insertCall).toBeUndefined();
    });

    test('201: 기존 등록만 있고 시즌비 청구가 빠진 학생은 시즌비와 월회비 정리를 복구', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, status: 'upcoming', non_season_end_date: '2026-02-28',
            operating_days: '["월"]', season_start_date: '2026-03-01',
            season_end_date: '2026-08-31', continuous_discount_type: 'none',
            continuous_discount_rate: 0, season_name: '2026 봄',
            payment_due_date: '2026-02-25'
        }]]);
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수', monthly_tuition: 100000,
            discount_rate: 0, grade: '고2', student_type: 'regular'
        }]]);
        pool.execute.mockResolvedValueOnce([[{ id: 88 }]]); // existing enrollment from failed 500
        pool.execute.mockResolvedValueOnce([[]]); // missing season payment
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE students
        pool.execute.mockResolvedValueOnce([{ insertId: 50 }]); // INSERT student_payments
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE replaced monthly payments
        pool.execute.mockResolvedValueOnce([[{
            id: 88, student_name: 'enc_홍길동', season_name: '2026 봄', season_type: 'regular'
        }]]);

        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, registration_date: '2026-02-15'
        });

        expect(res.status).toBe(201);
        expect(res.body.enrollment.id).toBe(88);
        const insertSeasonCall = pool.execute.mock.calls.find(c => c[0].includes('INSERT INTO student_seasons'));
        const insertPaymentCall = pool.execute.mock.calls.find(c => c[0].includes('INSERT INTO student_payments'));
        const deleteMonthlyCall = pool.execute.mock.calls.find(c => c[0].includes('DELETE FROM student_payments') && c[0].includes("payment_type = 'monthly'"));
        expect(insertSeasonCall).toBeUndefined();
        expect(insertPaymentCall).toBeDefined();
        expect(deleteMonthlyCall).toBeDefined();
        expect(pool.execute.mock.calls.at(-1)[1]).toEqual([88]);
    });

    test('201: student_payments.season_id 컬럼이 없는 DB에서는 fallback INSERT로 등록 성공', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, status: 'upcoming', non_season_end_date: '2026-02-28',
            operating_days: '["월"]', season_start_date: '2026-03-01',
            season_end_date: '2026-08-31', continuous_discount_type: 'none',
            continuous_discount_rate: 0, season_name: '2026 봄',
            payment_due_date: '2026-02-25'
        }]]);
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수', monthly_tuition: 100000,
            discount_rate: 0, grade: '고2', student_type: 'regular'
        }]]);
        pool.execute.mockResolvedValueOnce([[]]); // same season not enrolled
        pool.execute.mockResolvedValueOnce([[]]); // no existing season payment
        pool.execute.mockResolvedValueOnce([{ insertId: 99 }]); // INSERT student_seasons
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE students
        const missingSeasonId = new Error("Unknown column 'season_id' in 'field list'");
        missingSeasonId.code = 'ER_BAD_FIELD_ERROR';
        missingSeasonId.errno = 1054;
        pool.execute.mockRejectedValueOnce(missingSeasonId); // INSERT student_payments with season_id
        pool.execute.mockResolvedValueOnce([{ insertId: 50 }]); // fallback INSERT without season_id
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE replaced monthly payments
        pool.execute.mockResolvedValueOnce([[{
            id: 99, student_name: 'enc_홍길동', season_name: '2026 봄', season_type: 'regular'
        }]]);

        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, registration_date: '2026-02-15'
        });

        expect(res.status).toBe(201);
        expect(res.body.message).toBe('Student enrolled in season successfully');
        const paymentInserts = pool.execute.mock.calls.filter(c => c[0].includes('INSERT INTO student_payments'));
        expect(paymentInserts).toHaveLength(2);
        expect(paymentInserts[0][0]).toContain('season_id');
        expect(paymentInserts[1][0]).not.toContain('season_id');
        expect(paymentInserts[1][1]).toContain('2026-02-25');
    });

    test('201: student_payments.season_id FK가 운영 스키마와 맞지 않아도 fallback INSERT로 등록 성공', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, status: 'upcoming', non_season_end_date: '2026-02-28',
            operating_days: '["월"]', season_start_date: '2026-03-01',
            season_end_date: '2026-08-31', continuous_discount_type: 'none',
            continuous_discount_rate: 0, season_name: '2026 봄'
        }]]);
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수', monthly_tuition: 100000,
            discount_rate: 0, grade: '고2', student_type: 'regular'
        }]]);
        pool.execute.mockResolvedValueOnce([[]]);
        pool.execute.mockResolvedValueOnce([[]]);
        pool.execute.mockResolvedValueOnce([{ insertId: 99 }]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const invalidSeasonIdReference = new Error('Cannot add or update a child row: CONSTRAINT `student_payments_ibfk_3` FOREIGN KEY (`season_id`)');
        invalidSeasonIdReference.code = 'ER_NO_REFERENCED_ROW_2';
        pool.execute.mockRejectedValueOnce(invalidSeasonIdReference);
        pool.execute.mockResolvedValueOnce([{ insertId: 50 }]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.execute.mockResolvedValueOnce([[{
            id: 99, student_name: 'enc_홍길동', season_name: '2026 봄', season_type: 'regular'
        }]]);

        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000, registration_date: '2026-02-15'
        });

        expect(res.status).toBe(201);
        const paymentInserts = pool.execute.mock.calls.filter(c => c[0].includes('INSERT INTO student_payments'));
        expect(paymentInserts).toHaveLength(2);
        expect(paymentInserts[0][0]).toContain('season_id');
        expect(paymentInserts[1][0]).not.toContain('season_id');
    });

    test('5xx: 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error xyz'));
        const res = await request(makeApp()).post('/paca/seasons/5/enroll').send({
            student_id: 10, season_fee: 100000
        });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 학생 등록에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB error xyz/);
    });
});

describe('GET /paca/seasons/:id/preview', () => {
    test('400: student_id 누락', async () => {
        const res = await request(makeApp()).get('/paca/seasons/5/preview');
        expect(res.status).toBe(400);
        expect(res.body.message).toMatch(/student_id/);
    });

    test('404: 시즌 미존재', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).get('/paca/seasons/5/preview?student_id=10');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Season not found');
    });

    test('409: 이미 등록 — 한국어 메시지 + enrolled:true', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, season_name: '2026 봄', non_season_end_date: '2026-02-28', season_start_date: '2026-03-01', season_end_date: '2026-08-31', operating_days: '["월"]', default_season_fee: 100000 }]]);
        pool.execute.mockResolvedValueOnce([[{ id: 1, season_name: '2026 봄' }]]);
        const res = await request(makeApp()).get('/paca/seasons/5/preview?student_id=10');
        expect(res.status).toBe(409);
        expect(res.body.error).toBe('Already Enrolled');
        expect(res.body.message).toMatch(/이미.*등록되어 있습니다/);
        expect(res.body.enrolled).toBe(true);
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 5, season_name: '2026 봄', non_season_end_date: '2026-02-28', season_start_date: '2026-03-01', season_end_date: '2026-08-31', operating_days: '["월"]', default_season_fee: 100000 }]]);
        pool.execute.mockResolvedValueOnce([[]]); // existing 없음
        pool.execute.mockResolvedValueOnce([[]]); // students 없음
        const res = await request(makeApp()).get('/paca/seasons/5/preview?student_id=10');
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('Student not found');
    });

    test('200: preview 응답 표면 + calculateProRatedFee 호출 인자 셰이프 보존', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 5, season_name: '2026 봄', non_season_end_date: '2026-02-28',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            operating_days: '["월","수"]', default_season_fee: 100000,
            allows_continuous: true, continuous_discount_type: 'rate',
            continuous_discount_rate: 10
        }]]);
        pool.execute.mockResolvedValueOnce([[]]); // existing 없음
        pool.execute.mockResolvedValueOnce([[{
            id: 10, name: 'enc_홍길동', class_days: '월수',
            monthly_tuition: 100000, discount_rate: 0, student_number: 'S001'
        }]]);
        const res = await request(makeApp()).get('/paca/seasons/5/preview?student_id=10');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season transition preview calculated');
        expect(res.body.preview).toBeDefined();
        expect(res.body.preview.student.name).toBe('홍길동');
        expect(res.body.preview.season).toBeDefined();
        expect(res.body.preview.prorated).toBeDefined();
        expect(res.body.preview.continuous_discount).toBeDefined();
        expect(res.body.preview.final_calculation).toBeDefined();
        // calculateProRatedFee 호출 인자 셰이프
        expect(calculateProRatedFee).toHaveBeenCalledTimes(1);
        const callArg = calculateProRatedFee.mock.calls[0][0];
        expect(callArg).toHaveProperty('monthlyFee');
        expect(callArg).toHaveProperty('weeklyDays');
        expect(callArg).toHaveProperty('nonSeasonEndDate');
        expect(callArg).toHaveProperty('discountRate');
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).get('/paca/seasons/5/preview?student_id=10');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 미리보기 계산에 실패했습니다.');
    });
});
