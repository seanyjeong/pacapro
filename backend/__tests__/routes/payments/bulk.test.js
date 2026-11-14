/**
 * routes/payments/bulk.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - POST /paca/payments/bulk-monthly                  → { message, created, updated, skipped, withNonSeasonProrated, withCarryover, year, month, due_date }
 *     학생이 있으면 due_date = 마지막으로 계산한 납부기한 (예전 due_date ReferenceError → 5xx 는 2026-11-14 고침)
 *   - POST /paca/payments/generate-prorated             → { message, payment, proration } (201)
 *   - POST /paca/payments/generate-monthly-for-student  → { message, payment, nonSeasonProrated } (201)
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003)
 *   - 응답 표면 보존 (ADR-013)
 *   - lesson #206: 거대 endpoint 정상 케이스 = pool.execute.mockResolvedValue([[]]) default + 핵심 SQL 만 검증
 */

// 학생 잠금(SELECT … FOR UPDATE)은 실제 MySQL 시험(integration/pending-bill-mysql)에서 확인 — 여기선 호출 순서만 본다
jest.mock('../../../repositories/studentBillingLock', () => ({ lockStudentForBilling: jest.fn().mockResolvedValue({ id: 1 }) }));
jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 5, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/seasonCalculator', () => ({
    truncateToThousands: jest.fn((v) => Math.floor(v / 1000) * 1000),
    calculateProRatedFee: jest.fn(() => ({
        proRatedFee: 50000,
        classCountUntilEnd: 4,
        totalMonthlyClasses: 8,
        calculationDetails: { formula: '100000 × (4/8) = 50000' },
    })),
    parseWeeklyDays: jest.fn(() => [1, 3, 5]),
}));

jest.mock('../../../utils/dueDateCalculator', () => ({
    calculateDueDate: jest.fn(() => '2026-05-05'),
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
    require('../../../routes/payments/bulk')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    // 학생별 트랜잭션 연결: 같은 execute 대역을 써서 쿼리 순서를 그대로 확인한다
    pool.getConnection.mockResolvedValue({
        execute: pool.execute, query: pool.query,
        beginTransaction: jest.fn(), commit: jest.fn(), rollback: jest.fn(), release: jest.fn(),
    });
});

describe('POST /paca/payments/bulk-monthly', () => {
    test('400: 필수 누락', async () => {
        const res = await request(makeApp()).post('/paca/payments/bulk-monthly').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('필수 항목');
    });

    test('200: 활성 학생 0명 → early return (due_date 응답 X)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]]) // academy settings
            .mockResolvedValueOnce([[]]);                       // students = 0
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('활성 상태인 학생이 없습니다.');
        expect(res.body.created).toBe(0);
        expect(res.body.updated).toBe(0);
        expect(res.body.due_date).toBeUndefined();
    });

    test('200: 학생이 있으면 청구를 만들고 due_date 는 마지막으로 계산한 납부기한(예전 ReferenceError 500 고침)', async () => {
        pool.query.mockResolvedValue([[]]); // 비시즌 종강 일할 대상 없음
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, class_days: '[1,3]', payment_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]]) // pendingCredits
            .mockResolvedValueOnce([[]]) // existingPayment
            .mockResolvedValueOnce([{ insertId: 1 }]); // INSERT 새 결제
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ created: 1, updated: 0, skipped: 0, year: 2026, month: 5, due_date: '2026-05-05' });
        // 100,000원·할인 10% → 할인 10,000, 최종 90,000
        const insert = pool.execute.mock.calls.find(([sql]) => /INSERT INTO student_payments/.test(sql));
        expect([insert[1][3], insert[1][4], insert[1][8]]).toEqual([100000, 10000, 90000]);
    });

    test('낸 청구가 있는 학생은 크레딧을 건드리지 않고 건너뛴다(예전엔 크레딧을 먼저 빼서 사라졌다)', async () => {
        pool.query.mockResolvedValue([[]]); // 비시즌 종강 일할 대상 없음
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, class_days: '[1,3]', payment_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ id: 70, payment_status: 'paid', paid_amount: 100000 }]]) // 이미 낸 청구
            .mockResolvedValue([[{ id: 9, remaining_amount: 30000, credit_type: 'carryover' }]]); // 크레딧이 있어도
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ created: 0, updated: 0, skipped: 1, withCarryover: 0 });
        expect(pool.execute.mock.calls.some(([sql]) => /rest_credits/.test(sql))).toBe(false);
    });

    test('같은 달 미납 청구를 다시 돌리면 추가 금액을 지키고 최종 금액에 넣는다(예전엔 0으로 덮어썼다)', async () => {
        pool.query.mockResolvedValue([[]]); // 비시즌 종강 일할 대상 없음
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 450000, discount_rate: 0, class_days: '[1,3]', payment_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ id: 70, payment_status: 'pending', paid_amount: 0, base_amount: '450000.00', discount_amount: '0.00', additional_amount: '10000.00', carryover_amount: '0.00', final_amount: '460000.00', rest_credit_id: null, notes: null }]])
            .mockResolvedValueOnce([[]]) // 크레딧 없음
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ created: 0, updated: 1 });
        const update = pool.execute.mock.calls.find(([sql]) => /UPDATE student_payments SET/.test(sql));
        // [base, discount, additional, carryover, rest_credit_id, final, ...]
        expect(update[1].slice(0, 6)).toEqual([450000, 0, 10000, 0, null, 460000]);
    });

    test('같은 달 미납 청구에 크레딧·추가 금액이 있으면 둘 다 지키고 공통 식으로 최종 금액을 낸다', async () => {
        const { monthlyBillAmounts } = require('../../../utils/monthlyBillAmounts');
        pool.query.mockResolvedValue([[]]);
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 450000, discount_rate: 0, class_days: '[1,3]', payment_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ id: 70, payment_status: 'pending', paid_amount: 0, base_amount: '450000.00', discount_amount: '0.00', additional_amount: '10000.00', carryover_amount: '166500.00', final_amount: '293000.00', rest_credit_id: 9, notes: '[크레딧 차감]' }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        const update = pool.execute.mock.calls.find(([sql]) => /UPDATE student_payments SET/.test(sql));
        // 450,000 + 10,000 − 166,500 = 293,500 → 293,000
        expect(update[1].slice(0, 6)).toEqual([450000, 0, 10000, 166500, 9, 293000]);
        expect(update[1][5]).toBe(monthlyBillAmounts(450000, 0, 10000, 166500).final);
    });

    test('첫 달 일할·휴원 정산 등으로 금액을 따로 정한 미납 청구는 다시 돌려도 건너뛴다(skipped, 예전엔 정액으로 덮었다)', async () => {
        pool.query.mockResolvedValue([[]]);
        pool.execute
            .mockResolvedValueOnce([[{ tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 450000, discount_rate: 0, class_days: '[1,3]', payment_due_day: 5 },
                { id: 8, name: 'enc_김', monthly_tuition: 450000, discount_rate: 0, class_days: '[1,3]', payment_due_day: 5 },
            ]])
            // 7: 첫 달 일할 청구
            .mockResolvedValueOnce([[{ id: 70, payment_status: 'pending', paid_amount: 0, base_amount: '225000.00', discount_amount: '0.00', additional_amount: '0.00',
                carryover_amount: 0, final_amount: '225000.00', is_prorated: 1, description: '5월 학원비 (16일 등록, 일할계산)', rest_credit_id: null, notes: null }]])
            // 8: 휴원 정산(학원비 칸 그대로, 최종 금액만 줄임)
            .mockResolvedValueOnce([[{ id: 80, payment_status: 'pending', paid_amount: 0, base_amount: '450000.00', discount_amount: '0.00', additional_amount: '0.00',
                carryover_amount: 0, final_amount: '225000.00', is_prorated: 1, description: '5월 학원비', rest_credit_id: null, notes: null }]]);
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({ created: 0, updated: 0, skipped: 2 });
        expect(pool.execute.mock.calls.some(([sql]) => /UPDATE student_payments|rest_credits|INSERT INTO student_payments/.test(sql))).toBe(false);
    });

    test('500: SQL 에러 시 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Academy SQL fail'));
        const res = await request(makeApp())
            .post('/paca/payments/bulk-monthly')
            .send({ year: 2026, month: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('학원비 일괄 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Academy SQL fail');
    });
});

describe('POST /paca/payments/generate-prorated', () => {
    test('400: student_id 누락', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('학생을 선택해주세요.');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 999 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
    });

    test('400: 이미 해당 월 납부건 존재', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, enrollment_date: '2026-05-15', class_days: '[1,3,5]', tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ id: 1 }]]); // existing
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 7, enrollment_date: '2026-05-15' });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('이미 존재합니다');
    });

    test('201: 정상 생성 (lesson #206 — 핵심 SQL 호출만 검증)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, payment_due_day: 5, enrollment_date: '2026-05-15', class_days: '[1,3,5]', tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[]])                  // existing 없음
            .mockResolvedValueOnce([{ insertId: 42 }])    // INSERT student_payments
            .mockResolvedValueOnce([[
                { id: 42, student_name: 'enc_홍', final_amount: 90000, is_prorated: 1 },
            ]]);                                            // SELECT created
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 7, enrollment_date: '2026-05-15' });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('일할계산 납부건이 생성되었습니다.');
        expect(res.body.payment.id).toBe(42);
        expect(res.body.proration).toBeDefined();
        expect(res.body.proration.registration_day).toBe(15);
        // 실제 저장 형식(숫자 요일)으로 일할: 2026년 5월 월·수·금 13회 중 15일부터 7회
        expect([res.body.proration.total_class_days, res.body.proration.remaining_class_days]).toEqual([13, 7]);

        // 핵심 SQL: INSERT student_payments
        const insertCall = pool.execute.mock.calls[2];
        expect(insertCall[0]).toContain('INSERT INTO student_payments');
        expect(insertCall[0]).toContain('is_prorated, proration_details');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Student lookup fail'));
        const res = await request(makeApp())
            .post('/paca/payments/generate-prorated')
            .send({ student_id: 7 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('일할계산 납부건 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Student lookup fail');
    });
});

describe('POST /paca/payments/generate-monthly-for-student', () => {
    test('400: 필수 누락', async () => {
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('필수 항목');
    });

    test('404: 학생 미존재', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 999, year: 2026, month: 5 });
        expect(res.status).toBe(404);
        expect(res.body.message).toBe('학생을 찾을 수 없습니다.');
    });

    test('400: 이미 해당 월 납부건 존재', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 0, payment_due_day: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ allowed: 1 }]])
            .mockResolvedValueOnce([[{ id: 1 }]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toContain('이미 존재합니다');
    });

    test('201: 정상 생성 (비시즌 종강 일할 미적용)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, payment_due_day: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ allowed: 1 }]])
            .mockResolvedValueOnce([[]])                  // existing
            .mockResolvedValueOnce([[]])                  // 트랜잭션 안 existing (학생 잠근 뒤 다시 확인)
            .mockResolvedValueOnce([[]])                  // rest_credits SELECT (크레딧 없음)
            .mockResolvedValueOnce([{ insertId: 50 }])
            .mockResolvedValueOnce([[
                { id: 50, student_name: 'enc_홍', final_amount: 90000 },
            ]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(201);
        expect(res.body.message).toBe('월 납부건이 생성되었습니다.');
        expect(res.body.payment.id).toBe(50);
        expect(res.body.nonSeasonProrated).toBeNull();
        // 트랜잭션 처음에 학생을 잠그고, 그 뒤 청구 → 크레딧
        const { lockStudentForBilling } = require('../../../repositories/studentBillingLock');
        expect(lockStudentForBilling).toHaveBeenCalledWith(expect.anything(), 7, expect.anything());
        const sqls = pool.execute.mock.calls.map(([sql]) => sql);
        expect(sqls.findIndex(sql => /FROM student_payments[\s\S]*FOR UPDATE/.test(sql)))
            .toBeLessThan(sqls.findIndex(sql => /FROM rest_credits/.test(sql)));
    });

    test('트랜잭션 안에서 같은 달 청구가 보이면(동시에 두 번 누름) 400, 크레딧은 건드리지 않는다', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { id: 7, name: 'enc_홍', monthly_tuition: 100000, discount_rate: 10, payment_due_day: 5, tuition_due_day: 5 },
            ]])
            .mockResolvedValueOnce([[{ allowed: 1 }]])
            .mockResolvedValueOnce([[]])                  // 트랜잭션 전 existing: 아직 없음
            .mockResolvedValueOnce([[{ id: 49 }]]);       // 학생 잠근 뒤: 앞 요청이 만든 청구
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('2026-05 월 납부건이 이미 존재합니다.');
        expect(pool.execute.mock.calls.some(([sql]) => /rest_credits|INSERT INTO student_payments/.test(sql))).toBe(false);
    });

    test('409: 무료 수업 기간에는 개별 월 청구를 만들지 않는다', async () => {
        pool.query.mockResolvedValueOnce([[]]); // 비시즌 종강 일할 대상도 아님
        pool.execute
            .mockResolvedValueOnce([[{ id: 7, monthly_tuition: 100000 }]])
            .mockResolvedValueOnce([[{ allowed: 0 }]]);
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 11 });
        expect(res.status).toBe(409);
        expect(pool.execute).toHaveBeenCalledTimes(2);
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('Student fail'));
        const res = await request(makeApp())
            .post('/paca/payments/generate-monthly-for-student')
            .send({ student_id: 7, year: 2026, month: 5 });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('월 납부건 생성에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('Student fail');
    });
});
