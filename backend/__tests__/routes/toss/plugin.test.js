/**
 * routes/toss/plugin.js 테스트 (Phase 3 #8).
 *
 * 회귀 보호 범위:
 *   - GET /paca/toss/unpaid       → {success, stats, payments}
 *   - GET /paca/toss/student/:id  → {success, payments}
 *   - DB 호출: pool.execute (ADR-005, db.query 잔존 0건)
 *   - 5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건
 *   - decrypt 시그니처 보존 (ADR-007) + maskName 호출
 *   - verifyTossPlugin (X-Toss-Plugin-Key) 무인증 보호
 *   - 응답 표면 보존 (ADR-013): 토스 플러그인 직접 소비 키 1:1
 */

jest.mock('../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
}));

jest.mock('../../../utils/encryption', () => ({
    encrypt: jest.fn((v) => v),
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
    require('../../../routes/toss/plugin')(router);
    app.use('/paca/toss', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    pool.execute.mockResolvedValue([[]]);
    process.env.TOSS_PLUGIN_API_KEY = 'test-global-key';
});

describe('GET /paca/toss/unpaid (verifyTossPlugin)', () => {
    test('401: API 키 없음', async () => {
        const res = await request(makeApp()).get('/paca/toss/unpaid');
        expect(res.status).toBe(401);
        expect(res.body.success).toBe(false);
        expect(res.body.message).toBe('API 키가 필요합니다.');
    });

    test('401: 잘못된 API 키 + academy_id 없음', async () => {
        const res = await request(makeApp())
            .get('/paca/toss/unpaid')
            .set('X-Toss-Plugin-Key', 'wrong-key');
        expect(res.status).toBe(401);
        expect(res.body.message).toBe('유효하지 않은 API 키입니다.');
    });

    test('401: 학원별 API 키 mismatch', async () => {
        // 학원별 API 키 SELECT — plugin_api_key 가 다름
        pool.execute.mockResolvedValueOnce([[{ plugin_api_key: 'expected-key', academy_id: 1 }]]);
        const res = await request(makeApp())
            .get('/paca/toss/unpaid?academy_id=1')
            .set('X-Toss-Plugin-Key', 'wrong-key');
        expect(res.status).toBe(401);
    });

    test('400: 전역 키 통과 + academy_id 없음', async () => {
        const res = await request(makeApp())
            .get('/paca/toss/unpaid')
            .set('X-Toss-Plugin-Key', 'test-global-key');
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('academy_id가 필요합니다.');
    });

    test('200: 응답 표면 {success, stats, payments} + ADR-005 pool.execute + 학생 이름 복호화/마스킹', async () => {
        pool.execute.mockResolvedValueOnce([[
            { payment_id: 1, student_id: 10, student_name: 'enc_홍길동', student_number: 'S001',
              grade: 'M3', school: '서울중', year_month: '2024-12', payment_type: 'monthly',
              base_amount: 200000, discount_amount: 0, final_amount: 200000, paid_amount: 50000,
              remaining_amount: 150000, due_date: '2024-12-25', payment_status: 'partial', description: '12월' },
            { payment_id: 2, student_id: 11, student_name: 'enc_김철수', student_number: 'S002',
              grade: 'M2', school: '서울중', year_month: '2024-12', payment_type: 'monthly',
              base_amount: 200000, discount_amount: 0, final_amount: 200000, paid_amount: 0,
              remaining_amount: 200000, due_date: '2024-12-25', payment_status: 'pending', description: '12월' },
        ]]);
        const res = await request(makeApp())
            .get('/paca/toss/unpaid?academy_id=5')
            .set('X-Toss-Plugin-Key', 'test-global-key');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('stats');
        expect(res.body).toHaveProperty('payments');
        expect(res.body.stats.totalCount).toBe(2);
        expect(res.body.stats.totalAmount).toBe(350000);
        expect(res.body.stats.pendingCount).toBe(1);
        expect(res.body.stats.partialCount).toBe(1);
        expect(res.body.payments[0].student_name).toBe('홍길동');
        expect(res.body.payments[0].display_name).toBe('홍*동'); // maskName(3) → 홍*동
        expect(res.body.payments[1].display_name).toBe('김*수');
    });

    test('5xx: 한국어 메시지 (ADR-003) + e.message 누출 0건', async () => {
        pool.execute.mockReset();
        pool.execute.mockRejectedValueOnce(new Error('DB connection refused'));
        const res = await request(makeApp())
            .get('/paca/toss/unpaid?academy_id=5')
            .set('X-Toss-Plugin-Key', 'test-global-key');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('미납 목록 조회에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toMatch(/DB connection refused/);
    });
});

describe('GET /paca/toss/student/:id (verifyTossPlugin)', () => {
    test('401: API 키 없음', async () => {
        const res = await request(makeApp()).get('/paca/toss/student/42');
        expect(res.status).toBe(401);
    });

    test('200: 응답 표면 {success, payments}', async () => {
        pool.execute.mockResolvedValueOnce([[
            { payment_id: 1, year_month: '2024-12', payment_type: 'monthly',
              final_amount: 200000, paid_amount: 50000, remaining_amount: 150000,
              payment_status: 'partial', due_date: '2024-12-25' },
        ]]);
        const res = await request(makeApp())
            .get('/paca/toss/student/42?academy_id=5')
            .set('X-Toss-Plugin-Key', 'test-global-key');
        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body).toHaveProperty('payments');
        expect(res.body.payments.length).toBe(1);
        // ADR-005: pool.execute 호출 + parameterized
        expect(pool.execute.mock.calls[0][0]).toMatch(/SELECT[\s\S]+student_payments[\s\S]+student_id = \?/);
        // verifyTossPlugin 의 전역 키 분기에서 req.tossAuth.academyId = parseInt(...) → number
        expect(pool.execute.mock.calls[0][1]).toEqual([42, 5]);
    });

    test('5xx: 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SQL syntax error'));
        const res = await request(makeApp())
            .get('/paca/toss/student/42?academy_id=5')
            .set('X-Toss-Plugin-Key', 'test-global-key');
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('학생 결제 정보 조회에 실패했습니다.');
    });
});
