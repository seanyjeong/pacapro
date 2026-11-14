/**
 * exports/expenses.js — GET /paca/exports/expenses 회귀 테스트
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
    require('../../../routes/exports/expenses')(router);
    app.use('/paca/exports', router);
    return app;
}

describe('GET /paca/exports/expenses', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('200 + xlsx + Content-Disposition + buffer ZIP magic', async () => {
        pool.execute.mockResolvedValueOnce([[
            { expense_date: '2026-01-15', category: 'salary', amount: 1500000,
              description: '강사 급여', payment_method: 'account', notes: null,
              instructor_name: 'enc1' }
        ]]);

        const res = await request(buildApp())
            .get('/paca/exports/expenses')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
        expect(Buffer.isBuffer(res.body)).toBe(true);
        expect(res.body.length).toBeGreaterThan(100);
        expect(res.body[0]).toBe(0x50);
        expect(res.body[1]).toBe(0x4B);
    });

    test('pool.execute 1건 (ADR-005, expenses LEFT JOIN instructors)', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/expenses');

        expect(pool.execute).toHaveBeenCalledTimes(1);
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM expenses e/);
        expect(pool.execute.mock.calls[0][0]).toMatch(/LEFT JOIN instructors i/);
    });

    test('year + month 쿼리 → dateFilter 적용 + params 정확', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/expenses?year=2026&month=1');

        expect(pool.execute.mock.calls[0][0]).toMatch(/BETWEEN \? AND \?/);
        // 월말은 서버 시간대와 상관없이 그 달 마지막 날이다 (KST 서버에서 하루 앞서던 문제 수정).
        expect(pool.execute.mock.calls[0][1]).toEqual([1, '2026-01-01', '2026-01-31']);
    });

    test('5xx + 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_ERROR_DO_NOT_LEAK'));

        const res = await request(buildApp()).get('/paca/exports/expenses');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '지출 내역 엑셀을 생성하지 못했습니다.'
        });
        expect(JSON.stringify(res.body)).not.toMatch(/SECRET_DB_ERROR/);
    });
});
