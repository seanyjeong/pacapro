/**
 * routes/notifications/send/auto.js 회귀 테스트.
 *
 * 2 endpoint:
 *  - POST /send-unpaid-today-auto : 솔라피 자동발송 (verifyToken)
 *  - POST /send-trial-today-auto  : 체험수업 자동발송 (verifyToken)
 *
 * 검증 포인트:
 *  - 응답 표면 보존 (ADR-013): {message, current_hour, academies_processed, ...} +
 *    학원이 0건일 때의 단순 응답 + 5xx 의 details: e.message 포함 (cron 디버깅용)
 *  - DB 호출 통일 (ADR-005): pool.execute 만
 *  - **ADR-016 IN 절 자리표시자 명시 전개** (existingLogs SELECT의 student_id IN)
 *  - 외부 API mock (sendAlimtalkSolapi)
 *  - ADR-007 시그니처 보존 (decryptApiKey, sendAlimtalkSolapi)
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
}));

jest.mock('../../../../middleware/auth', () => ({
    verifyToken: jest.fn((req, res, next) => {
        req.user = { academyId: 1, id: 100, role: 'admin' };
        next();
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
    createUnpaidNotificationMessage: jest.fn((paymentInfo, student) => ({
        content: `MSG-${student.name}-${paymentInfo.month}`,
        variables: { name: student.name, amount: paymentInfo.amount }
    })),
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
const auth = require('../../../../middleware/auth');
const pool = require('../../../../config/database');
const naverSens = require('../../../../utils/naverSens');
const solapi = require('../../../../utils/solapi');
const registerAuto = require('../../../../routes/notifications/send/auto');

function buildApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerAuto(router);
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
    solapi.sendAlimtalkSolapi.mockReset();
    process.env.PACA_NOTIFICATION_API_KEY = 'internal-scheduler-key';
});

// =====================================================
// POST /send-unpaid-today-auto
// =====================================================
describe('POST /send-unpaid-today-auto (verifyToken)', () => {
    test('200 — 내부 scheduler X-API-Key 호출은 verifyToken 없이 통과', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const app = buildApp();
        const res = await request(app)
            .post('/paca/notifications/send-unpaid-today-auto')
            .set('x-api-key', 'internal-scheduler-key')
            .send({});

        expect(res.status).toBe(200);
        expect(res.body.academies_processed).toBe(0);
        expect(auth.verifyToken).not.toHaveBeenCalled();
    });

    test('200 — 발송 학원 0건 시 단순 응답 표면 (ADR-013)', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // academySettings 0건

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body).toHaveProperty('message');
        expect(res.body).toHaveProperty('current_hour');
        expect(res.body.academies_processed).toBe(0);
        expect(res.body).not.toHaveProperty('results');
        expect(res.body).not.toHaveProperty('total_sent');
    });

    test('200 — 학원 1건 + 미납자 0건 시 academyResult.skipped=true (한국어 사유)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A', academy_phone: '02-1',
                solapi_api_secret: 'GOOD', solapi_api_key: 'KEY', solapi_pfid: 'PF',
                tuition_due_day: 5,
                solapi_template_id: 'TPL', solapi_template_content: 'CONTENT',
            }]])
            .mockResolvedValueOnce([[]]); // 미납자 0건

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.academies_processed).toBe(1);
        expect(res.body.results).toHaveLength(1);
        expect(res.body.results[0].skipped).toBe(true);
        expect(res.body.results[0].error).toBe('오늘 수업 있는 미납자 없음');
        expect(res.body.results[0].sent).toBe(0);
        expect(res.body.results[0].failed).toBe(0);
    });

    test('200 — Solapi Secret 복호화 실패 시 skipped + 한국어 사유', async () => {
        pool.execute.mockResolvedValueOnce([[{
            academy_id: 1, academy_name: '학원A',
            solapi_api_secret: 'BAD',
        }]]);

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.results[0].skipped).toBe(true);
        expect(res.body.results[0].error).toBe('솔라피 API Secret 복호화 실패');
    });

    test('200 — 미납자 발송 + ADR-016 IN 절 자리표시자 명시 전개 (existingLogs)', async () => {
        const studentRows = [
            { payment_id: 100, amount: 200000, year_month: '2026-05',
              student_id: 50, student_name: '학생A', parent_phone: '010-1234-5678', student_phone: null,
              class_days: '[1]' },
            { payment_id: 101, amount: 250000, year_month: '2026-05',
              student_id: 51, student_name: '학생B', parent_phone: '010-2345-6789', student_phone: null,
              class_days: '[1]' },
        ];
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A', academy_phone: '02-1',
                solapi_api_secret: 'GOOD', solapi_api_key: 'KEY', solapi_pfid: 'PF',
                solapi_sender_phone: '02-1234',
                tuition_due_day: 5,
                solapi_template_id: 'TPL', solapi_template_content: 'CONTENT',
            }]])
            .mockResolvedValueOnce([studentRows])              // unpaidPayments
            .mockResolvedValueOnce([[]])                        // existingLogs IN 절
            .mockResolvedValueOnce([{ insertId: 200 }])         // INSERT log #1
            .mockResolvedValueOnce([{ insertId: 201 }]);        // INSERT log #2

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'G-1' });

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.total_sent).toBe(2);
        expect(res.body.total_failed).toBe(0);

        // ADR-005: pool.execute only
        expect(pool.execute).toHaveBeenCalled();
        expect(pool.query).not.toHaveBeenCalled();

        const unpaidQuery = pool.execute.mock.calls[1][0];
        expect(unpaidQuery).toContain('GREATEST');
        expect(unpaidQuery).toContain('p.paid_amount');
        expect(unpaidQuery).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");

        // ADR-016: existingLogs SELECT 의 IN 절 자리표시자 명시 전개
        const existingLogsCall = pool.execute.mock.calls.find(c =>
            c[0].includes('SELECT DISTINCT student_id FROM notification_logs')
        );
        expect(existingLogsCall).toBeDefined();
        expect(existingLogsCall[0]).toMatch(/student_id IN \(\?,\?\)/);
        // params spread: [academyId, ...studentIds(2건), year, month] = 5
        expect(existingLogsCall[1]).toHaveLength(5);
        expect(existingLogsCall[1][0]).toBe(1);  // academyId
        expect(existingLogsCall[1][1]).toBe(50); // student_id #1
        expect(existingLogsCall[1][2]).toBe(51); // student_id #2

        // ADR-007: sendAlimtalkSolapi 첫 인자 객체 셰이프 보존
        const [solapiConfig] = solapi.sendAlimtalkSolapi.mock.calls[0];
        expect(solapiConfig).toEqual({
            solapi_api_key: 'KEY',
            solapi_api_secret: 'decrypted-GOOD',
            solapi_pfid: 'PF',
            solapi_sender_phone: '02-1234',
        });
    });

    test('500 — 서버 에러 시 details: error.message 포함 (원본 cron 디버깅용 보존, ADR-013)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB connection lost'));

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid-today-auto').send({});

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('자동발송 처리에 실패했습니다.');
        expect(res.body.details).toBe('DB connection lost'); // cron 디버깅용 (원본 보존)
    });
});

// =====================================================
// POST /send-trial-today-auto
// =====================================================
describe('POST /send-trial-today-auto (verifyToken)', () => {
    test('200 — 발송 학원 0건 시 단순 응답 표면', async () => {
        pool.execute.mockResolvedValueOnce([[]]);

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-trial-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.academies_processed).toBe(0);
        expect(res.body).toHaveProperty('current_hour');
        expect(res.body).not.toHaveProperty('results');
    });

    test('200 — 템플릿 ID 미설정 시 skipped + 한국어 사유', async () => {
        pool.execute.mockResolvedValueOnce([[{
            academy_id: 1, academy_name: '학원A',
            solapi_api_secret: 'GOOD',
            // solapi_trial_template_id 누락
        }]]);

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-trial-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.results[0].skipped).toBe(true);
        expect(res.body.results[0].error).toBe('체험수업 템플릿 ID 미설정');
    });

    test('200 — 체험수업 학생 0명 시 skipped', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A',
                solapi_api_secret: 'GOOD', solapi_trial_template_id: 'TRIAL',
            }]])
            .mockResolvedValueOnce([[]]); // trialStudents 0건

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-trial-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.results[0].skipped).toBe(true);
        expect(res.body.results[0].error).toBe('오늘 체험수업 있는 학생 없음');
    });

    test('200 — 정상 발송 + students 배열 누적 + ADR-007 시그니처 보존', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                academy_id: 1, academy_name: '학원A',
                solapi_api_secret: 'GOOD', solapi_api_key: 'KEY', solapi_pfid: 'PF',
                solapi_sender_phone: '02-1234',
                solapi_trial_template_id: 'TRIAL',
                solapi_trial_template_content: '안녕 #{이름}님',
            }]])
            .mockResolvedValueOnce([[
                { student_id: 1, name: '체험A', phone: null, parent_phone: '010-1111-2222',
                  trial_dates: '[{"date":"2026-05-02","attended":false}]', trial_remaining: 1 },
            ]])
            .mockResolvedValueOnce([{ insertId: 999 }]); // INSERT log

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'G-trial-1' });

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-trial-today-auto').send({});

        expect(res.status).toBe(200);
        expect(res.body.total_sent).toBe(1);
        expect(res.body.total_failed).toBe(0);
        expect(res.body.results[0].students).toEqual(['체험A']);

        // ADR-007: sendAlimtalkSolapi 첫 인자 객체 셰이프 보존
        const [solapiConfig, templateCode] = solapi.sendAlimtalkSolapi.mock.calls[0];
        expect(solapiConfig).toEqual({
            solapi_api_key: 'KEY',
            solapi_api_secret: 'decrypted-GOOD',
            solapi_pfid: 'PF',
            solapi_sender_phone: '02-1234',
        });
        expect(templateCode).toBe('TRIAL');
    });

    test('500 — 서버 에러 시 details: error.message 포함 (cron 디버깅용)', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB explode'));

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-trial-today-auto').send({});

        expect(res.status).toBe(500);
        expect(res.body.message).toBe('자동발송 처리에 실패했습니다.');
        expect(res.body.details).toBe('DB explode');
    });
});
