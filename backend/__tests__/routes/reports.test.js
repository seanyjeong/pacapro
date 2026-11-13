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
        expect(db.query.mock.calls[0][0]).toContain("status <> 'prospect'");

        const unpaidCall = db.query.mock.calls.find(([sql]) => sql.includes('unpaid_count'));
        expect(unpaidCall).toBeDefined();
        expect(unpaidCall[0]).toContain('GREATEST');
        expect(unpaidCall[0]).toContain('p.paid_amount');
        expect(unpaidCall[0]).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");
        expect(unpaidCall[0]).not.toContain('SUM(final_amount)');
    });

    test('지점을 주면 학생 수와 학원비 매출·미납만 그 지점으로 가르고, 안 주면 조회가 그대로다', async () => {
        const rows = () => db.query
            .mockResolvedValueOnce([[{ total_students: 3, active_students: 3, paused_students: 0, withdrawn_students: 0 }]])
            .mockResolvedValueOnce([[{ count: 0 }]])
            .mockResolvedValueOnce([[{ total_instructors: 2, active_instructors: 2 }]])
            .mockResolvedValueOnce([[{ count: 1, amount: 100000 }]])
            .mockResolvedValueOnce([[{ count: 0, amount: 0 }]])
            .mockResolvedValueOnce([[{ count: 0, amount: 0 }]])
            .mockResolvedValueOnce([[{ unpaid_count: 1, unpaid_amount: 200000 }]]);

        rows();
        expect((await request(makeApp()).get('/paca/reports/dashboard?branch_ids=3,0')).status).toBe(200);
        const [students, restEnded, instructors, revenue, otherIncome, expenses, unpaid] = db.query.mock.calls;
        expect(students[0]).toContain('COALESCE(students.branch_id, 0) IN (?,?)');
        expect(students[1].slice(-2)).toEqual([3, 0]);
        expect(restEnded[1].slice(-2)).toEqual([3, 0]);
        for (const call of [revenue, unpaid]) {
            expect(call[0]).toContain('JOIN students s ON s.id = p.student_id');
            expect(call[0]).toContain('COALESCE(p.branch_id, s.branch_id, 0) IN (?,?)');
            expect(call[1].slice(-2)).toEqual([3, 0]);
        }
        for (const call of [instructors, otherIncome, expenses]) expect(call[0]).not.toContain('branch_id');

        db.query.mockReset();
        rows();
        await request(makeApp()).get('/paca/reports/dashboard');
        expect(db.query.mock.calls.every(([sql]) => !sql.includes('branch_id'))).toBe(true);

        db.query.mockReset();
        expect((await request(makeApp()).get('/paca/reports/dashboard?branch_ids=3%20OR%201')).status).toBe(400);
        expect(db.query).not.toHaveBeenCalled();
    });
});

test('학생 보고서 총원도 예비생을 제외하고 학년·전형 분포는 기존 재원·휴원 범위를 유지한다', async () => {
    db.query.mockResolvedValueOnce([[{ total_students: 2, active: 1, paused: 1, graduated: 0, withdrawn: 0 }]])
        .mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);
    const res = await request(makeApp()).get('/paca/reports/students');
    expect(res.status).toBe(200);
    expect(db.query.mock.calls[0][0]).toContain("status <> 'prospect'");
    expect(db.query.mock.calls[1][0]).toContain("status IN ('active', 'paused')");
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
