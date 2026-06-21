/**
 * exports/payments.js — GET /paca/exports/payments 회귀 테스트
 */

const request = require('supertest');
const express = require('express');

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn()
}));
jest.mock('../../../middleware/auth', () => ({
    verifyToken: (req, res, next) => {
        req.user = { id: 1, academyId: 1, role: 'owner' };
        next();
    },
    requireRole: () => (req, res, next) => next(),
    checkPermission: () => (req, res, next) => next()
}));
jest.mock('../../../utils/encryption', () => ({
    decrypt: (v) => v ? `dec(${v})` : v,
    encrypt: (v) => v
}));
jest.mock('../../../utils/logger', () => ({
    error: jest.fn(),
    info: jest.fn(),
    warn: jest.fn()
}));

const pool = require('../../../config/database');

function binaryParser(res, callback) {
    res.setEncoding('binary');
    let data = '';
    res.on('data', chunk => { data += chunk; });
    res.on('end', () => callback(null, Buffer.from(data, 'binary')));
}

function buildApp() {
    const app = express();
    const router = express.Router();
    require('../../../routes/exports/payments')(router);
    app.use('/paca/exports', router);
    return app;
}

describe('GET /paca/exports/payments', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('200 + xlsx + 파일명 납부내역', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, year_month: '2026-01', payment_type: 'monthly',
              base_amount: 200000, discount_amount: 0, additional_amount: 0,
              final_amount: 200000, paid_amount: 200000,
              due_date: '2026-01-10', paid_date: '2026-01-08',
              payment_status: 'paid', payment_method: 'card',
              description: '1월', student_name: 'enc1', student_number: '0001', grade: 1 }
        ]]);

        const res = await request(buildApp())
            .get('/paca/exports/payments')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        // 납부내역 UTF-8 encode
        expect(res.headers['content-disposition']).toMatch(/%EB%82%A9%EB%B6%80%EB%82%B4%EC%97%AD/);
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(100);
    });

    test('pool.execute 1건 (ADR-005, student_payments JOIN students)', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/payments');

        expect(pool.execute).toHaveBeenCalledTimes(1);
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM student_payments p/);
        expect(pool.execute.mock.calls[0][0]).toMatch(/JOIN students s/);
    });

    test('status=pending → statusFilter 적용', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/payments?status=pending');

        expect(pool.execute.mock.calls[0][0]).toMatch(/AND p\.payment_status = \?/);
        // params 마지막 = 'pending'
        expect(pool.execute.mock.calls[0][1].slice(-1)[0]).toBe('pending');
    });

    test('status 잘못된 값 → statusFilter 미적용', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/payments?status=invalid');

        expect(pool.execute.mock.calls[0][0]).not.toMatch(/AND p\.payment_status = \?/);
        // params = [academyId] only
        expect(pool.execute.mock.calls[0][1]).toEqual([1]);
    });

    test('5xx + 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_ERROR_DO_NOT_LEAK'));

        const res = await request(buildApp()).get('/paca/exports/payments');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '납부 내역 엑셀을 생성하지 못했습니다.'
        });
        expect(JSON.stringify(res.body)).not.toMatch(/SECRET_DB_ERROR/);
    });
});
