/**
 * routes/toss/settings.js 테스트 (Phase 3 #8).
 *
 * 회귀 보호 범위:
 *   - GET /paca/toss/settings (있음) → {success, settings}
 *   - GET /paca/toss/settings (없음) → {success, settings:null, message}
 *   - PUT /paca/toss/settings (INSERT) → {success, message}
 *   - PUT /paca/toss/settings (UPDATE COALESCE) → {success, message}
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - 보안 (ADR-007): GET 응답 SELECT 절에 plugin_api_key / callback_secret 미포함
 *   - 응답 표면 보존 (ADR-013): 프론트 src/lib/api/toss.ts (getSettings/saveSettings) 직접 소비 키 1:1
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { id: 100, academy_id: 5, role: 'owner' };
        next();
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
    checkAcademyAccess: jest.fn((req, res, next) => next()),
}));

jest.mock('../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => v),
    decrypt: jest.fn((v) => v),
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
    require('../../../routes/toss/settings')(router);
    app.use('/paca/toss', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
});

describe('GET /paca/toss/settings', () => {
    test('200 (있음): {success, settings}', async () => {
        pool.execute.mockResolvedValueOnce([[
            { id: 1, academy_id: 5, merchant_id: 'M001', is_active: 1,
              auto_match_enabled: 1, auto_receipt_print: 1,
              created_at: '2024-01-01', updated_at: '2024-12-01' }
        ]]);
        const res = await request(makeApp()).get('/paca/toss/settings');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.settings).toMatchObject({ id: 1, academy_id: 5, merchant_id: 'M001' });
    });

    test('200 (없음): {success, settings:null, message}', async () => {
        const res = await request(makeApp()).get('/paca/toss/settings');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.settings).toBeNull();
        expect(res.body.message).toBe('토스 연동 설정이 없습니다.');
    });

    test('보안 (ADR-007): SELECT 절에 plugin_api_key / callback_secret 미포함', async () => {
        const res = await request(makeApp()).get('/paca/toss/settings');
        expect(res.status).toBe(200);
        const sql = pool.execute.mock.calls[0][0];
        expect(sql).not.toMatch(/plugin_api_key/);
        expect(sql).not.toMatch(/callback_secret/);
    });

    test('5xx: 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB connection lost'));
        const res = await request(makeApp()).get('/paca/toss/settings');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('설정 조회에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB connection lost/);
    });
});

describe('PUT /paca/toss/settings', () => {
    test('INSERT (없으면): {success, message} + INSERT SQL + boolean 정수 변환', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[]]); // SELECT existing 비어있음
        pool.execute.mockResolvedValueOnce([{ insertId: 1 }]); // INSERT
        const res = await request(makeApp())
            .put('/paca/toss/settings')
            .send({
                merchant_id: 'M002',
                plugin_api_key: 'pak-1',
                callback_secret: 'cb-1',
                is_active: true,
                auto_match_enabled: true,
                auto_receipt_print: false,
            });
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('설정이 저장되었습니다.');
        expect(pool.execute.mock.calls[1][0]).toMatch(/INSERT INTO toss_settings/);
        expect(pool.execute.mock.calls[1][1]).toEqual([5, 'M002', 'pak-1', 'cb-1', 1, 1, 0]);
    });

    test('UPDATE (있으면): COALESCE 로 NULL 입력 시 기존 값 유지', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]); // SELECT existing 있음
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE
        const res = await request(makeApp())
            .put('/paca/toss/settings')
            .send({
                is_active: true,
                auto_match_enabled: true,
                auto_receipt_print: true,
            });
        expect(res.status).toBe(200);
        const sql = pool.execute.mock.calls[1][0];
        expect(sql).toMatch(/UPDATE toss_settings SET/);
        expect(sql).toMatch(/merchant_id = COALESCE/);
        expect(sql).toMatch(/plugin_api_key = COALESCE/);
        expect(sql).toMatch(/callback_secret = COALESCE/);
        expect(pool.execute.mock.calls[1][1]).toEqual([null, null, null, 1, 1, 1, 5]);
    });

    test('UPDATE: auto_match_enabled / auto_receipt_print 미제공 시 기본 1 (≠ false 만 0)', async () => {
        pool.execute.mockReset();
        pool.execute.mockResolvedValueOnce([[{ id: 1 }]]);
        pool.execute.mockResolvedValueOnce([{ affectedRows: 1 }]);
        const res = await request(makeApp())
            .put('/paca/toss/settings')
            .send({ is_active: false }); // 다른 boolean 미제공
        expect(res.status).toBe(200);
        const params = pool.execute.mock.calls[1][1];
        // is_active=false → 0, auto_match_enabled=undefined → 1, auto_receipt_print=undefined → 1
        expect(params).toEqual([null, null, null, 0, 1, 1, 5]);
    });

    test('5xx: 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB error'));
        const res = await request(makeApp())
            .put('/paca/toss/settings')
            .send({});
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('설정 저장에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB error/);
    });
});
