/**
 * routes/reports.js 결제 집계 회귀 테스트.
 *
 * 보호 범위:
 *   - dashboard 미납 금액은 final_amount 전체가 아니라 남은 금액 기준
 *   - 시즌비는 납부기한 전이면 미납/알림 대상에서 제외
 *   - payments/unpaid 리포트도 학생별 잔액 기준
 */

jest.mock('../../config/database', () => ({
    query: jest.fn(),
    execute: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 5, userId: 100, role: 'owner' };
        next();
    }),
    requireRole: jest.fn(() => (req, res, next) => next()),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../utils/encryption', () => ({
    decrypt: jest.fn((v) => (typeof v === 'string' && v.startsWith('enc_') ? v.replace(/^enc_/, '') : v)),
}));

jest.mock('../../utils/logger', () => ({
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const db = require('../../config/database');

function makeApp() {
    const app = express();
    app.use(express.json());
    app.use('/paca/reports', require('../../routes/reports'));
    return app;
}

beforeEach(() => {
    db.query.mockReset();
});

describe('GET /paca/reports/dashboard', () => {
    test('미납 집계 SQL은 부분납부 잔액 기준이며 납부기한 전 시즌비를 제외한다', async () => {
        db.query
            .mockResolvedValueOnce([[{ total_students: 3, active_students: 3, paused_students: 0, withdrawn_students: 0 }]])
            .mockResolvedValueOnce([[{ count: 0 }]])
            .mockResolvedValueOnce([[{ total_instructors: 2, active_instructors: 2 }]])
            .mockResolvedValueOnce([[{ count: 1, amount: 100000 }]])
            .mockResolvedValueOnce([[{ count: 0, amount: 0 }]])
            .mockResolvedValueOnce([[{ count: 0, amount: 0 }]])
            .mockResolvedValueOnce([[{ unpaid_count: 1, unpaid_amount: 200000 }]]);

        const res = await request(makeApp()).get('/paca/reports/dashboard');

        expect(res.status).toBe(200);
        expect(res.body.unpaid_payments.amount).toBe(200000);

        const unpaidCall = db.query.mock.calls.find(([sql]) => sql.includes('unpaid_count'));
        expect(unpaidCall).toBeDefined();
        expect(unpaidCall[0]).toContain('GREATEST');
        expect(unpaidCall[0]).toContain('p.paid_amount');
        expect(unpaidCall[0]).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");
        expect(unpaidCall[0]).not.toContain('SUM(final_amount)');
    });
});

describe('GET /paca/reports/payments/unpaid', () => {
    test('미납 리포트 SQL은 학생별 잔액 기준이며 납부예정 시즌비를 제외한다', async () => {
        db.query
            .mockResolvedValueOnce([[{ payment_status: 'partial', count: 1, total_amount: 200000 }]])
            .mockResolvedValueOnce([[
                {
                    student_id: 10,
                    student_name: 'enc_홍길동',
                    student_number: '2026001',
                    phone: 'enc_010',
                    parent_phone: 'enc_011',
                    unpaid_count: 1,
                    unpaid_amount: 200000,
                },
            ]]);

        const res = await request(makeApp()).get('/paca/reports/payments/unpaid');

        expect(res.status).toBe(200);
        expect(res.body.summary.total_unpaid_amount).toBe(200000);
        expect(res.body.by_student[0].student_name).toBe('홍길동');

        const [statsSql] = db.query.mock.calls[0];
        const [byStudentSql] = db.query.mock.calls[1];
        for (const sql of [statsSql, byStudentSql]) {
            expect(sql).toContain('GREATEST');
            expect(sql).toContain('p.paid_amount');
            expect(sql).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");
        }
        expect(statsSql).not.toContain('SUM(final_amount)');
        expect(byStudentSql).not.toContain('SUM(p.final_amount)');
    });
});
