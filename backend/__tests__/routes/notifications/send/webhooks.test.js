/**
 * routes/notifications/send/webhooks.js 회귀 테스트.
 *
 * 4 endpoint (모두 verifyToken 미적용 + X-API-Key 헤더 검증):
 *  - POST /send-unpaid-today-auto-sens
 *  - POST /send-trial-today-auto-sens
 *  - POST /send-reminder-auto
 *  - POST /send-reminder-auto-sens
 *
 * ⛔ 핵심 검증: 4 endpoint 모두 verifyToken 없이 호출 가능 + X-API-Key 미일치 시 401.
 *  - 광역 미들웨어 (router.use(verifyToken)) 가 진입점에 추가되면 본 테스트가 깨짐 →
 *    webhook 인증 모델 회귀 즉시 감지.
 *
 * 검증 포인트:
 *  - X-API-Key 미일치 → 401 {error:'Unauthorized'} (4건 모두)
 *  - X-API-Key 일치 → 200 응답 표면 보존 (ADR-013): {message, results}
 *  - DB 호출 통일 (ADR-005): pool.execute 만
 *  - 외부 API mock (sendAlimtalk + sendAlimtalkSolapi)
 *  - ADR-007 시그니처 보존
 *  - send-trial-today-auto-sens: 원본 ReferenceError (decryptField) 동작 보존
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
}));

jest.mock('../../../../middleware/auth', () => ({
    // verifyToken 은 webhook endpoint 4건에 적용되지 않으므로,
    // 만약 잘못 적용되면 본 mock 의 401 분기로 즉시 깨짐을 확인.
    verifyToken: jest.fn((req, res, next) => {
        return res.status(401).json({ error: 'verifyToken should not be applied to webhook endpoints' });
    }),
    checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../../utils/naverSens', () => ({
    encryptApiKey: jest.fn(),
    decryptApiKey: jest.fn((cipher) => {
        if (!cipher) return null;
        if (cipher === 'BAD') return null;
        return 'decrypted-' + cipher;
    }),
    sendAlimtalk: jest.fn(),
    createUnpaidNotificationMessage: jest.fn(),
    isValidPhoneNumber: jest.fn((phone) => /^010-\d{4}-\d{4}$/.test(phone || '')),
}));

jest.mock('../../../../utils/encryption', () => ({ decrypt: jest.fn((v) => v) }));

jest.mock('../../../../utils/solapi', () => ({
    sendAlimtalkSolapi: jest.fn(),
    getBalanceSolapi: jest.fn(),
}));

jest.mock('../../../../utils/logger', () => ({
    info: jest.fn(), warn: jest.fn(), error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../../config/database');
const naverSens = require('../../../../utils/naverSens');
const solapi = require('../../../../utils/solapi');
const registerWebhooks = require('../../../../routes/notifications/send/webhooks');

const VALID_API_KEY = 'paca-n8n-api-key-2024';

function buildApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerWebhooks(router);
    app.use('/paca/notifications', router);
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
    pool.execute.mockReset();
    pool.query.mockReset();
    naverSens.decryptApiKey.mockImplementation((cipher) => {
        if (!cipher) return null;
        if (cipher === 'BAD') return null;
        return 'decrypted-' + cipher;
    });
    naverSens.isValidPhoneNumber.mockImplementation((phone) => /^010-\d{4}-\d{4}$/.test(phone || ''));
    naverSens.sendAlimtalk.mockReset();
    solapi.sendAlimtalkSolapi.mockReset();
});

const WEBHOOK_PATHS = [
    '/paca/notifications/send-unpaid-today-auto-sens',
    '/paca/notifications/send-trial-today-auto-sens',
    '/paca/notifications/send-reminder-auto',
    '/paca/notifications/send-reminder-auto-sens',
];

describe('webhook 4건 — verifyToken 무적용 + X-API-Key 검증 (ADR-014 핵심)', () => {
    test.each(WEBHOOK_PATHS)('%s — X-API-Key 헤더 누락 시 401', async (path) => {
        const app = buildApp();
        const res = await request(app).post(path).send({});

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
        // verifyToken mock 의 메시지가 떨어지면 안 됨 (verifyToken 적용 시도 시 즉시 fail)
        expect(res.body).not.toHaveProperty('error', 'verifyToken should not be applied to webhook endpoints');
        // DB 호출 0건
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test.each(WEBHOOK_PATHS)('%s — X-API-Key 잘못된 값 시 401', async (path) => {
        const app = buildApp();
        const res = await request(app).post(path).set('x-api-key', 'wrong-key').send({});

        expect(res.status).toBe(401);
        expect(res.body.error).toBe('Unauthorized');
        expect(pool.execute).not.toHaveBeenCalled();
    });
});

// =====================================================
// POST /send-unpaid-today-auto-sens
// =====================================================
describe('POST /send-unpaid-today-auto-sens (X-API-Key)', () => {
    test('200 — 학원 0건 시 {message, results:[]} 표면', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-unpaid-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'SENS 자동발송 완료',
            results: []
        });
    });

    test('200 — 학원 1건 + 미납자 발송 (ADR-005 + ADR-007)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A', academy_phone: '02-1',
                naver_access_key: 'AK', naver_secret_key: 'GOOD', naver_service_id: 'SID',
                kakao_channel_id: 'CH',
                template_code: 'TPL_CODE', template_content: 'CONTENT-#{이름}',
                sens_buttons: null,
                sens_overdue_auto_enabled: 0,
            }]])
            .mockResolvedValueOnce([[
                { id: 50, name: '학생A', phone: null, parent_phone: '010-1234-5678',
                  class_days: '[1]', payment_id: 100, amount: 200000, year_month: '2026-05',
                  sent_count: 0 },
            ]])
            .mockResolvedValueOnce([{ insertId: 999 }]); // INSERT log

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-1' });

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-unpaid-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('SENS 자동발송 완료');
        expect(res.body.results[0].academy).toBe('학원A');
        expect(res.body.results[0].sent).toBe(1);
        expect(res.body.results[0].failed).toBe(0);

        // ADR-005: pool.execute only
        expect(pool.execute).toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();

        // ADR-007: sendAlimtalk 첫 인자 객체 셰이프 보존
        const [sensConfig] = naverSens.sendAlimtalk.mock.calls[0];
        expect(sensConfig).toEqual({
            naver_access_key: 'AK',
            naver_secret_key: 'decrypted-GOOD',
            naver_service_id: 'SID',
            kakao_channel_id: 'CH',
        });
    });

    test('500 — 서버 에러 시 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB explode'));

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-unpaid-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('SENS 자동발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB explode');
    });
});

// =====================================================
// POST /send-trial-today-auto-sens
// =====================================================
describe('POST /send-trial-today-auto-sens (X-API-Key, 원본 동작 보존)', () => {
    test('200 — 학원 0건 시 단순 응답', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-trial-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'SENS 체험수업 자동발송 완료',
            results: []
        });
    });

    test('200 — 학원 1건 + 체험학생 0건 시 results.sent=0 (정상 처리)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A',
                naver_access_key: 'AK', naver_secret_key: 'GOOD', naver_service_id: 'SID',
                sens_trial_template_code: 'SENS_TRIAL',
            }]])
            .mockResolvedValueOnce([[]]); // trialStudents 0건

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-trial-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.results[0]).toEqual({
            academy: '학원A',
            sent: 0,
            failed: 0,
        });
    });

    test('200 — 원본 ReferenceError (decryptField) 동작 보존: 학원 단위 catch 로 떨어져 results 미포함', async () => {
        // decryptField 가 정의되지 않아 trialStudents.length > 0 일 때 ReferenceError 발생.
        // 원본 코드 동작: 학원 단위 try-catch 가 잡아서 logger.error 호출 후 results 에 미푸시.
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A',
                naver_access_key: 'AK', naver_secret_key: 'GOOD', naver_service_id: 'SID',
                sens_trial_template_code: 'SENS_TRIAL',
            }]])
            .mockResolvedValueOnce([[
                { id: 1, name: 'enc-name', phone: 'enc-phone', parent_phone: 'enc-parent', trial_dates: '[]' },
            ]]);

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-trial-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        // ReferenceError 가 학원 단위 catch 로 떨어져 200 응답 + results 빈 배열 (원본 동작 보존)
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('SENS 체험수업 자동발송 완료');
        expect(res.body.results).toEqual([]); // 학원 catch 가 results.push 하지 않음
        // 외부 API 호출 0건
        expect(naverSens.sendAlimtalk).not.toHaveBeenCalled();
    });

    test('500 — 외부 5xx 시 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB explode'));

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-trial-today-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('SENS 체험수업 자동발송에 실패했습니다.');
    });
});

// =====================================================
// POST /send-reminder-auto (Solapi)
// =====================================================
describe('POST /send-reminder-auto (X-API-Key, Solapi)', () => {
    test('200 — 학원 0건 시 {message, results:[]}', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-reminder-auto')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'Solapi 상담 리마인드 자동발송 완료',
            results: []
        });
    });

    test('200 — 정상 발송 + results 항목 셰이프 보존 ({academy, targetTime, total, sent, failed})', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A', academy_phone: '02-1',
                solapi_api_key: 'KEY', solapi_api_secret: 'GOOD', solapi_pfid: 'PF',
                solapi_sender_phone: '02-1234',
                solapi_reminder_template_id: 'REM_TPL',
                solapi_reminder_template_content: '#{이름}님 #{날짜} 상담 #{남은시간} 전',
                solapi_reminder_hours: 1,
                solapi_reminder_buttons: null,
                solapi_reminder_image_url: null,
            }]])
            .mockResolvedValueOnce([[{
                id: 200, consultation_id: 200,
                student_name: '학생A', parent_name: '학부모A', parent_phone: '010-1234-5678',
                preferred_date: '2026-05-02', preferred_time: '14:00:00',
                reservation_number: 'R-100',
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]); // UPDATE consultations

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'G-rem-1' });

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-reminder-auto')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.results[0].academy).toBe('학원A');
        expect(res.body.results[0].total).toBe(1);
        expect(res.body.results[0].sent).toBe(1);
        expect(res.body.results[0].failed).toBe(0);
        expect(res.body.results[0]).toHaveProperty('targetTime');

        // ADR-007: sendAlimtalkSolapi 첫 인자 객체 셰이프 보존
        const [solapiConfig, templateCode] = solapi.sendAlimtalkSolapi.mock.calls[0];
        expect(solapiConfig).toEqual({
            solapi_api_key: 'KEY',
            solapi_api_secret: 'decrypted-GOOD',
            solapi_pfid: 'PF',
            solapi_sender_phone: '02-1234',
        });
        expect(templateCode).toBe('REM_TPL');
    });

    test('500 — 서버 에러 시 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB explode'));

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-reminder-auto')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('리마인드 자동발송에 실패했습니다.');
    });
});

// =====================================================
// POST /send-reminder-auto-sens
// =====================================================
describe('POST /send-reminder-auto-sens (X-API-Key, SENS)', () => {
    test('200 — 학원 0건 시 단순 응답', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-reminder-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: 'SENS 상담 리마인드 자동발송 완료',
            results: []
        });
    });

    test('200 — 정상 발송 + results 항목 셰이프 보존 + ADR-007 시그니처', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A', academy_phone: '02-1',
                naver_access_key: 'AK', naver_secret_key: 'GOOD', naver_service_id: 'SID',
                kakao_channel_id: 'CH',
                sens_reminder_template_code: 'SENS_REM',
                sens_reminder_template_content: '#{이름}님 #{날짜} 상담',
                sens_reminder_hours: 2,
                sens_reminder_buttons: null,
                sens_reminder_image_url: null,
            }]])
            .mockResolvedValueOnce([[{
                id: 300, consultation_id: 300,
                student_name: '학생B', parent_name: '학부모B', parent_phone: '010-2222-3333',
                preferred_date: '2026-05-02', preferred_time: '15:00:00',
                reservation_number: 'R-200',
            }]])
            .mockResolvedValueOnce([{ affectedRows: 1 }]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-rem-2' });

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-reminder-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.results[0].sent).toBe(1);
        expect(res.body.results[0].total).toBe(1);

        // ADR-007: sendAlimtalk 첫 인자 객체 셰이프 보존
        const [sensConfig, templateCode] = naverSens.sendAlimtalk.mock.calls[0];
        expect(sensConfig).toEqual({
            naver_access_key: 'AK',
            naver_secret_key: 'decrypted-GOOD',
            naver_service_id: 'SID',
            kakao_channel_id: 'CH',
        });
        expect(templateCode).toBe('SENS_REM');
    });

    test('500 — 서버 에러 시 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB explode'));

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-reminder-auto-sens')
            .set('x-api-key', VALID_API_KEY)
            .send({});

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('SENS 리마인드 자동발송에 실패했습니다.');
    });
});
