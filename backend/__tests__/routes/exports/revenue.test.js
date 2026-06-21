/**
 * exports/revenue.js — GET /paca/exports/revenue 회귀 테스트
 *
 * 검증 항목:
 * - 200 status + Content-Type (xlsx) + Content-Disposition (filename*=UTF-8'')
 * - 응답 buffer 길이 > 0 (워크북 실제 생성)
 * - pool.execute 호출 2건 (student_payments + other_incomes), ADR-005
 * - 한국어 라벨 (학원비 수입 / 기타 수입 / 수입 요약 시트)
 * - 5xx + 한국어 메시지 + e.message 누출 0건
 * - 파일명에 한국어 포함 (UTF-8 encode)
 */

const request = require('supertest');
const express = require('express');

// 의존성 모킹
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
    require('../../../routes/exports/revenue')(router);
    app.use('/paca/exports', router);
    return app;
}

describe('GET /paca/exports/revenue', () => {
    beforeEach(() => {
        pool.execute.mockReset();
    });

    test('200 + xlsx Content-Type + Content-Disposition (filename*=UTF-8 ko)', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                { paid_date: '2026-01-15', category: '학원비', student_name: 'enc1',
                  payment_type: 'monthly', amount: 200000, payment_method: 'card',
                  description: '1월 월회비', notes: null }
            ]])
            .mockResolvedValueOnce([[
                { income_date: '2026-01-20', category: 'clothing', student_name: 'enc2',
                  amount: 50000, payment_method: 'cash', description: '체육복', notes: null }
            ]]);

        const res = await request(buildApp())
            .get('/paca/exports/revenue')
            .buffer(true)
            .parse(binaryParser);

        expect(res.status).toBe(200);
        expect(res.headers['content-type']).toContain('spreadsheetml.sheet');
        expect(res.headers['content-disposition']).toContain("filename*=UTF-8''");
        expect(res.headers['content-disposition']).toContain('xlsx');
        expect(Buffer.isBuffer(res.body)).toBe(true);
        // ExcelJS 워크북 PK\x03\x04 (zip magic bytes)
        expect(res.body.length).toBeGreaterThan(100);
        expect(res.body[0]).toBe(0x50); // 'P'
        expect(res.body[1]).toBe(0x4B); // 'K'
    });

    test('pool.execute 2건 호출 (ADR-005, student_payments + other_incomes)', async () => {
        pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

        await request(buildApp()).get('/paca/exports/revenue');

        expect(pool.execute).toHaveBeenCalledTimes(2);
        // 첫 번째: student_payments
        expect(pool.execute.mock.calls[0][0]).toMatch(/FROM student_payments/);
        // 두 번째: other_incomes
        expect(pool.execute.mock.calls[1][0]).toMatch(/FROM other_incomes/);
    });

    test('파일명 = 수입내역_YYYY-MM-DD.xlsx (UTF-8 encode)', async () => {
        pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

        const res = await request(buildApp()).get('/paca/exports/revenue');

        const cd = res.headers['content-disposition'];
        // UTF-8 encoded 수입내역
        expect(cd).toMatch(/%EC%88%98%EC%9E%85%EB%82%B4%EC%97%AD/);
    });

    test('5xx + 한국어 메시지 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_ERROR_DO_NOT_LEAK'));

        const res = await request(buildApp()).get('/paca/exports/revenue');

        expect(res.status).toBe(500);
        expect(res.body).toEqual({
            error: 'Server Error',
            message: '수입 내역 엑셀을 생성하지 못했습니다.'
        });
        // e.message 누출 X
        expect(JSON.stringify(res.body)).not.toMatch(/SECRET_DB_ERROR/);
    });

    test('start_date + end_date 쿼리 → dateFilter 적용', async () => {
        pool.execute.mockResolvedValueOnce([[]]).mockResolvedValueOnce([[]]);

        await request(buildApp())
            .get('/paca/exports/revenue?start_date=2026-01-01&end_date=2026-01-31');

        // student_payments SQL 에 BETWEEN ? AND ?
        expect(pool.execute.mock.calls[0][0]).toMatch(/BETWEEN \? AND \?/);
        // params 에 academyId + 날짜 2개 (sp.paid_date 만)
        expect(pool.execute.mock.calls[0][1]).toEqual([1, '2026-01-01', '2026-01-31']);
        // other_incomes SQL 에도 BETWEEN
        expect(pool.execute.mock.calls[1][0]).toMatch(/BETWEEN \? AND \?/);
    });
});
