/**
 * routes/payments/list.js 테스트 (Phase 3 #6).
 *
 * 회귀 보호 범위:
 *   - GET /paca/payments         → { message, payments }
 *   - GET /paca/payments/unpaid  → { message, payments }
 *   - GET /paca/payments/unpaid-today → { message, date, day_of_week, day_name, count, payments }
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 응답 표면 보존 (ADR-013): 프론트 src/lib/api/payments.ts 직접 소비 키 1:1
 *   - ADR-007: decrypt 시그니처 무변경 (decryptPaymentArray 헬퍼)
 */

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
    decrypt: jest.fn((v) => (typeof v === 'string' && v.startsWith('enc_') ? v.replace(/^enc_/, '') : v)),
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
    require('../../../routes/payments/list')(router);
    app.use('/paca/payments', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
});

describe('GET /paca/payments', () => {
    test('200: { message, payments } + 학생 이름 복호화', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, student_id: 10, student_name: 'enc_홍길동', final_amount: 100000 },
            { id: 2, student_id: 11, student_name: 'enc_김철수', final_amount: 200000 },
        ]]);
        const res = await request(makeApp()).get('/paca/payments');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Found 2 payment records');
        expect(res.body.payments).toHaveLength(2);
        expect(res.body.payments[0].student_name).toBe('홍길동');
        expect(res.body.payments[1].student_name).toBe('김철수');
        expect(pool.execute).toHaveBeenCalledTimes(1);
        // academy_id binding
        expect(pool.execute.mock.calls[0][1][0]).toBe(5);
        const [sql] = pool.execute.mock.calls[0];
        expect(sql).toContain('p.paid_amount');
        expect(sql).toContain('remaining_amount');
    });

    test('200: 빈 배열', async () => {
        const res = await request(makeApp()).get('/paca/payments');
        expect(res.status).toBe(200);
        expect(res.body.payments).toEqual([]);
        expect(res.body.message).toBe('Found 0 payment records');
    });

    test('필터: student_id / payment_status / payment_type 모두 적용', async () => {
        await request(makeApp()).get('/paca/payments?student_id=7&payment_status=pending&payment_type=monthly');
        expect(pool.execute).toHaveBeenCalledTimes(1);
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain('AND p.student_id = ?');
        expect(sql).toContain('AND p.payment_status = ?');
        expect(sql).toContain('AND p.payment_type = ?');
        expect(params).toEqual([5, 7, 'pending', 'monthly']);
    });

    test('필터: year+month + include_previous_unpaid=true', async () => {
        await request(makeApp()).get('/paca/payments?year=2026&month=5&include_previous_unpaid=true');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain("p.year_month = ? OR (p.year_month < ? AND p.payment_status != 'paid')");
        expect(params).toEqual([5, '2026-05', '2026-05']);
    });

    test('필터: paid_year+paid_month → DATE_FORMAT(paid_date) 매칭', async () => {
        await request(makeApp()).get('/paca/payments?paid_year=2026&paid_month=4');
        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain("DATE_FORMAT(p.paid_date, '%Y-%m') = ?");
        expect(params).toEqual([5, '2026-04']);
    });

    test('500: 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB connection lost'));
        const res = await request(makeApp()).get('/paca/payments');
        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('납부 내역을 불러오는데 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB connection lost');
    });
});

describe('GET /paca/payments/unpaid', () => {
    test('200: { message, payments } + days_overdue 컬럼 SQL 포함', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 3, student_name: 'enc_박미납', days_overdue: 5, payment_status: 'pending' },
        ]]);
        const res = await request(makeApp()).get('/paca/payments/unpaid');
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('Found 1 unpaid payments');
        expect(res.body.payments[0].student_name).toBe('박미납');
        expect(res.body.payments[0].days_overdue).toBe(5);

        const [sql, params] = pool.execute.mock.calls[0];
        expect(sql).toContain("p.payment_status IN ('pending', 'partial')");
        expect(sql).toContain('DATEDIFF(CURDATE(), p.due_date)');
        expect(sql).toContain('p.paid_amount');
        expect(sql).toContain('remaining_amount');
        expect(sql).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");
        expect(sql).toContain('GREATEST');
        expect(params).toEqual([5]);
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SQL syntax error'));
        const res = await request(makeApp()).get('/paca/payments/unpaid');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('미납 내역을 불러오는데 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('SQL syntax');
    });
});

describe('GET /paca/payments/unpaid-today', () => {
    test('200: { message, date, day_of_week, day_name, count, payments }', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 4, student_name: 'enc_이학생', payment_status: 'pending', days_overdue: 2 },
        ]]);
        const res = await request(makeApp()).get('/paca/payments/unpaid-today');
        expect(res.status).toBe(200);
        expect(res.body.count).toBe(1);
        expect(res.body.payments[0].student_name).toBe('이학생');
        expect(['일', '월', '화', '수', '목', '금', '토']).toContain(res.body.day_name);
        expect(typeof res.body.date).toBe('string');
        expect(res.body.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof res.body.day_of_week).toBe('number');
    });

    test('SQL 호출: JSON_CONTAINS class_days + class_schedules.class_date 서브쿼리', async () => {
        await request(makeApp()).get('/paca/payments/unpaid-today');
        const [sql] = pool.execute.mock.calls[0];
        expect(sql).toContain("JSON_CONTAINS(COALESCE(s.class_days, '[]')");
        expect(sql).toContain('FROM attendance a');
        expect(sql).toContain('class_schedules cs');
        expect(sql).toContain('today_attendance');
        expect(sql).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");
        expect(sql).toContain('remaining_amount');
    });

    test('500: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('JSON_CONTAINS error'));
        const res = await request(makeApp()).get('/paca/payments/unpaid-today');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('오늘 미납 내역을 불러오는데 실패했습니다.');
    });
});
