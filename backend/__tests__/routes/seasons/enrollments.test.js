/**
 * routes/seasons/enrollments.js 테스트 (Phase 3 #5).
 *
 * 회귀 보호 범위:
 *   - POST /paca/seasons/enrollments/:id/pay              → {message, enrollment}
 *   - PUT  /paca/seasons/enrollments/:id                  → {message, enrollment}
 *   - POST /paca/seasons/enrollments/:id/refund-preview   → {enrollment, cancellation_date, refund, academy}
 *   - POST /paca/seasons/enrollments/:id/cancel           → {message, refundCalculation}
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - decrypt 시그니처 보존 (ADR-007)
 *   - calculateSeasonRefund 호출 인자 셰이프 보존
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
        finalRefundAmount: 50000,
        refundAmount: 50000,
    })),
    calculateMidSeasonFee: jest.fn(),
    parseWeeklyDays: jest.fn(() => [1, 3, 5]),
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
    require('../../../routes/seasons/enrollments')(router);
    app.use('/paca/seasons', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    decrypt.mockClear();
    calculateSeasonRefund.mockClear();
});

describe('POST /paca/seasons/enrollments/:id/pay', () => {
    test('404: 미존재 enrollment', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp()).post('/paca/seasons/enrollments/99/pay').send({});
        expect(res.status).toBe(404);
    });

    test('403: 다른 학원 enrollment', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1, academy_id: 2, payment_status: 'pending' }]]);
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/pay').send({});
        expect(res.status).toBe(403);
    });

    test('400: 이미 paid', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1, academy_id: 1, payment_status: 'paid' }]]);
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/pay').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Season fee already paid');
    });

    test('200: 정상 — UPDATE + revenues INSERT + decrypt 호출 + 응답 표면', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 1, payment_status: 'pending', season_fee: 100000,
            student_id: 10, student_name: 'enc_홍길동', season_name: '2026 봄'
        }]]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
        pool.execute.mockResolvedValueOnce([{ insertId: 99 }]); // INSERT revenues
        pool.execute.mockResolvedValueOnce([[{ id: 1, student_name: 'enc_홍길동', season_name: '2026 봄' }]]);
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/pay').send({
            paid_date: '2026-05-02', paid_amount: 100000, payment_method: 'cash'
        });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season fee payment recorded successfully');
        expect(res.body.enrollment).toBeDefined();
        expect(res.body.enrollment.student_name).toBe('홍길동');
        // INSERT revenues 가 호출됨
        expect(pool.execute.mock.calls[2][0]).toMatch(/INSERT INTO revenues/);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error'));
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/pay').send({});
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌비 납부 처리에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB error/);
    });
});

describe('PUT /paca/seasons/enrollments/:id', () => {
    test('400: updates 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1, academy_id: 1 }]]);
        const res = await request(makeApp()).put('/paca/seasons/enrollments/1').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('No fields to update');
    });

    test('200: dynamic update + 응답 표면 {message, enrollment}', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1, academy_id: 1, student_name: 'enc_x', season_name: 'S' }]]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        pool.execute.mockResolvedValueOnce([[{ id: 1, student_name: 'enc_x', season_name: 'S' }]]);
        const res = await request(makeApp()).put('/paca/seasons/enrollments/1').send({
            registration_date: '2026-05-01', season_fee: 200000, time_slots: ['evening']
        });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season enrollment updated successfully');
        expect(res.body.enrollment).toBeDefined();
        // UPDATE SQL 에 dynamic SET 절 포함
        expect(pool.execute.mock.calls[1][0]).toMatch(/UPDATE student_seasons SET/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/registration_date = \?/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/season_fee = \?/);
        expect(pool.execute.mock.calls[1][0]).toMatch(/time_slots = \?/);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).put('/paca/seasons/enrollments/1').send({ season_fee: 1 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 등록 정보 수정에 실패했습니다.');
    });
});

describe('POST /paca/seasons/enrollments/:id/refund-preview', () => {
    test('200: refund 계산 + {enrollment, cancellation_date, refund, academy} 표면', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 1, payment_status: 'paid',
            student_name: 'enc_홍길동', class_days: '월수금', season_name: 'S',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            operating_days: '["월","수","금"]', default_season_fee: 100000,
            season_fee: 100000, discount_amount: 0
        }]]);
        pool.execute.mockResolvedValueOnce([[{ academy_name: 'A', phone: '010', address: 'addr' }]]);
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/refund-preview').send({
            cancellation_date: '2026-05-02', include_vat: false
        });
        expect(res.status).toBe(200);
        expect(res.body.enrollment).toBeDefined();
        expect(res.body.enrollment.student_name).toBe('홍길동');
        expect(res.body.cancellation_date).toBe('2026-05-02');
        expect(res.body.refund).toBeDefined();
        expect(res.body.academy).toBeDefined();
        // calculateSeasonRefund 호출 인자 셰이프 보존
        expect(calculateSeasonRefund).toHaveBeenCalledTimes(1);
        const callArg = calculateSeasonRefund.mock.calls[0][0];
        expect(callArg).toHaveProperty('paidAmount');
        expect(callArg).toHaveProperty('originalFee');
        expect(callArg).toHaveProperty('seasonStartDate');
        expect(callArg).toHaveProperty('cancellationDate');
        expect(callArg).toHaveProperty('weeklyDays');
        expect(callArg).toHaveProperty('includeVat');
    });

    test('부분납부 결제 레코드가 있으면 실제 기납부액으로 refund를 계산한다', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 2, academy_id: 1, payment_status: 'pending',
            payment_paid_amount: '1000000', payment_final_amount: '3300000', payment_record_status: 'partial',
            student_name: 'enc_기아림', class_days: '월수금', season_name: 'S',
            season_start_date: '2026-07-01', season_end_date: '2026-09-30',
            operating_days: '["월","수","금"]', default_season_fee: 3300000,
            season_fee: 3300000, discount_amount: 0
        }]]);
        pool.execute.mockResolvedValueOnce([[{ academy_name: 'A', phone: '010', address: 'addr' }]]);

        const res = await request(makeApp()).post('/paca/seasons/enrollments/2/refund-preview').send({
            cancellation_date: '2026-07-20', include_vat: false
        });

        expect(res.status).toBe(200);
        expect(res.body.enrollment).toMatchObject({
            student_name: '기아림',
            paid_amount: 1000000,
            payment_status: 'partial'
        });
        expect(calculateSeasonRefund.mock.calls[0][0].paidAmount).toBe(1000000);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/refund-preview').send({});
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('환불 금액 계산에 실패했습니다.');
    });
});

describe('POST /paca/seasons/enrollments/:id/cancel', () => {
    test('400: 이미 cancelled', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 1, payment_status: 'cancelled',
            student_name: 'enc_x', class_days: '월', season_name: 'S',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31'
        }]]);
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/cancel').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('Enrollment already cancelled');
    });

    test('200: refund expense INSERT + DELETE student_seasons + 응답 {message, refundCalculation}', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{
            id: 1, academy_id: 1, payment_status: 'paid', student_id: 10,
            student_name: 'enc_홍길동', class_days: '월수', season_name: 'S',
            season_start_date: '2026-03-01', season_end_date: '2026-08-31',
            season_fee: 100000, discount_amount: 0, season_id: 5
        }]]);
        pool.execute.mockResolvedValueOnce([[{ operating_days: '["월","수"]' }]]);
        pool.execute.mockResolvedValueOnce([{ insertId: 1 }]);   // expenses INSERT
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE student_seasons
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE students
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // DELETE student_payments
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/cancel').send({
            cancellation_date: '2026-05-02'
        });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Season enrollment deleted successfully');
        expect(res.body.refundCalculation).toBeDefined();
        // DELETE student_seasons 호출 (원본 동작 보존)
        const deleteCall = pool.execute.mock.calls.find(c => c[0].includes('DELETE FROM student_seasons'));
        expect(deleteCall).toBeDefined();
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB'));
        const res = await request(makeApp()).post('/paca/seasons/enrollments/1/cancel').send({});
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('시즌 등록 취소에 실패했습니다.');
    });
});
