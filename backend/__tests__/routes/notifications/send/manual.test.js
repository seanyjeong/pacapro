/**
 * routes/notifications/send/manual.js 회귀 테스트.
 *
 * 2 endpoint:
 *  - POST /send-unpaid     : 미납자 일괄 발송 (verifyToken + checkPermission)
 *  - POST /send-individual : 개별 발송 (verifyToken + checkPermission)
 *
 * 검증 포인트:
 *  - 응답 표면 보존 (ADR-013): {message, sent, failed} / {message, success, requestId}
 *  - DB 호출 통일 (ADR-005): pool.execute 만 사용 (db.query 호출 0건)
 *  - 한국어 친화 메시지 (ADR-003): 사용자 노출 메시지 한국어 + e.message 누출 0건
 *  - 보안 헬퍼 시그니처 보존 (ADR-007): decryptApiKey + sendAlimtalk(Solapi) 호출 객체 셰이프
 *  - 외부 API 100% mock (실 발송 0건)
 */

jest.mock('../../../../config/database', () => ({
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
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
    createUnpaidNotificationMessage: jest.fn((paymentInfo, student, academy /* eslint-disable-line no-unused-vars */, template) => ({
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
const pool = require('../../../../config/database');
const naverSens = require('../../../../utils/naverSens');
const solapi = require('../../../../utils/solapi');
const logger = require('../../../../utils/logger');
const registerManual = require('../../../../routes/notifications/send/manual');

function buildApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerManual(router);
    app.use('/paca/notifications', router);
    return app;
}

beforeEach(() => {
    jest.clearAllMocks();
    pool.execute.mockReset();
    pool.query.mockReset();
    naverSens.sendAlimtalk.mockReset();
    naverSens.decryptApiKey.mockImplementation((cipher) => {
        if (!cipher) return null;
        if (cipher === 'BAD') return null;
        return 'decrypted-' + cipher;
    });
    naverSens.isValidPhoneNumber.mockImplementation((phone) => /^010-\d{4}-\d{4}$/.test(phone || ''));
    naverSens.createUnpaidNotificationMessage.mockImplementation((paymentInfo, student, academy /* eslint-disable-line no-unused-vars */, template) => ({
        content: `MSG-${student.name}-${paymentInfo.month}`,
        variables: { name: student.name, amount: paymentInfo.amount }
    }));
    solapi.sendAlimtalkSolapi.mockReset();
});

// =====================================================
// POST /send-unpaid
// =====================================================
describe('POST /send-unpaid (verifyToken + checkPermission)', () => {
    test('400 — year/month 누락 시 한국어 메시지', async () => {
        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
        expect(res.body.message).toBe('년도와 월을 지정해주세요.');
        expect(pool.execute).not.toHaveBeenCalled();
    });

    test('400 — 알림 설정 미완료 (settings 0건)', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // settings 빈 결과

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({ year: 2026, month: 5 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('알림 설정을 먼저 완료하고 활성화해주세요.');
    });

    test('200 — 미납자 0명 시 {message, sent:0, failed:0} 표면', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                is_enabled: 1, service_type: 'sens',
                naver_secret_key: 'GOOD',
                naver_access_key: 'AK', naver_service_id: 'SID',
                template_code: 'TPL_CODE', template_content: 'CONTENT',
            }]])
            .mockResolvedValueOnce([[{ name: '학원A', phone: '02-1234-5678', tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[]]); // 미납자 0건

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({ year: 2026, month: 5 });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: '발송할 미납자가 없습니다.',
            sent: 0,
            failed: 0
        });
        expect(naverSens.sendAlimtalk).not.toHaveBeenCalled();
    });

    test('400 — SENS Secret 복호화 실패 (BAD cipher)', async () => {
        pool.execute.mockResolvedValueOnce([[{
            is_enabled: 1, service_type: 'sens',
            naver_secret_key: 'BAD',
        }]]);

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({ year: 2026, month: 5 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('API Secret Key가 올바르지 않습니다.');
    });

    test('400 — 솔라피 Secret 복호화 실패 (BAD cipher)', async () => {
        pool.execute.mockResolvedValueOnce([[{
            is_enabled: 1, service_type: 'solapi',
            solapi_api_secret: 'BAD',
        }]]);

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({ year: 2026, month: 5 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('솔라피 API Secret이 올바르지 않습니다.');
    });

    test('200 — SENS 정상 발송 (sendAlimtalk mock + ADR-005 pool.execute + ADR-007 시그니처 보존)', async () => {
        const studentRow = {
            payment_id: 100, amount: 200000, due_date: '2026-05-05',
            student_id: 50, student_name: '홍길동', parent_phone: '010-1234-5678', student_phone: null,
        };
        pool.execute
            .mockResolvedValueOnce([[{
                is_enabled: 1, service_type: 'sens',
                naver_secret_key: 'GOOD', naver_access_key: 'AK', naver_service_id: 'SID',
                kakao_channel_id: 'CH', template_code: 'TPL_CODE', template_content: 'TPL_CONTENT',
            }]])
            .mockResolvedValueOnce([[{ name: '학원A', phone: '02-1234-5678', tuition_due_day: 5 }]])
            .mockResolvedValueOnce([[studentRow]])
            .mockResolvedValueOnce([{ insertId: 999 }]); // INSERT notification_logs

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-100' });

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({ year: 2026, month: 5 });

        expect(res.status).toBe(200);
        expect(res.body.sent).toBe(1);
        expect(res.body.failed).toBe(0);
        expect(res.body.message).toContain('알림 발송 완료');
        expect(res.body.message).toContain('SENS');

        // ADR-005: pool.execute 4건 호출, db.query 0건
        expect(pool.execute).toHaveBeenCalledTimes(4);
        expect(pool.query).not.toHaveBeenCalled();

        const unpaidQuery = pool.execute.mock.calls[2][0];
        expect(unpaidQuery).toContain('GREATEST');
        expect(unpaidQuery).toContain('p.paid_amount');
        expect(unpaidQuery).toContain("NOT (p.payment_type = 'season' AND p.due_date > CURDATE())");

        // ADR-007: sendAlimtalk 첫 인자 객체 셰이프 보존
        expect(naverSens.sendAlimtalk).toHaveBeenCalledTimes(1);
        const [sensConfig, templateCode, batch] = naverSens.sendAlimtalk.mock.calls[0];
        expect(sensConfig).toEqual({
            naver_access_key: 'AK',
            naver_secret_key: 'decrypted-GOOD',
            naver_service_id: 'SID',
            kakao_channel_id: 'CH',
        });
        expect(templateCode).toBe('TPL_CODE');
        expect(Array.isArray(batch)).toBe(true);
        expect(batch[0].phone).toBe('010-1234-5678');
    });

    test('500 — 서버 에러 시 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB connection lost'));

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-unpaid').send({ year: 2026, month: 5 });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('알림 발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB connection lost');
        expect(JSON.stringify(res.body)).not.toContain('details');
    });
});

// =====================================================
// POST /send-individual
// =====================================================
describe('POST /send-individual (verifyToken + checkPermission)', () => {
    test('400 — payment_id 누락 시 한국어 메시지', async () => {
        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-individual').send({});

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('payment_id가 필요합니다.');
    });

    test('404 — 학원비 정보 없음 (한국어 메시지)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                is_enabled: 1, service_type: 'sens',
            }]])
            .mockResolvedValueOnce([[]]); // payments 빈 결과

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-individual').send({ payment_id: 999 });

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('Not Found');
        expect(res.body.message).toBe('해당 학원비 정보를 찾을 수 없습니다.');
    });

    test('400 — 유효한 전화번호 없음 (한국어 메시지)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                is_enabled: 1, service_type: 'sens',
            }]])
            .mockResolvedValueOnce([[{
                payment_id: 100, amount: 200000, year_month: '2026-05', due_date: null,
                student_id: 50, student_name: '홍길동', parent_phone: null, student_phone: null,
            }]]);

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-individual').send({ payment_id: 100 });

        expect(res.status).toBe(400);
        expect(res.body.message).toBe('학부모 또는 학생의 유효한 전화번호가 없습니다.');
    });

    test('200 — SENS 정상 발송 (성공 응답 표면 {message, success, requestId} 보존)', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                is_enabled: 1, service_type: 'sens',
                naver_secret_key: 'GOOD', naver_access_key: 'AK', naver_service_id: 'SID',
                kakao_channel_id: 'CH', template_code: 'TPL_CODE', template_content: 'TPL_CONTENT',
            }]])
            .mockResolvedValueOnce([[{
                payment_id: 100, amount: 200000, year_month: '2026-05', due_date: null,
                student_id: 50, student_name: '홍길동', parent_phone: '010-1234-5678', student_phone: null,
            }]])
            .mockResolvedValueOnce([[{ name: '학원A', phone: '02-1234-5678', tuition_due_day: 5 }]])
            .mockResolvedValueOnce([{ insertId: 999 }]); // INSERT log

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-200' });

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-individual').send({ payment_id: 100 });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            message: '홍길동 학생에게 알림이 발송되었습니다.',
            success: true,
            requestId: 'REQ-200',
        });

        // ADR-005: pool.execute 만 사용
        expect(pool.execute).toHaveBeenCalledTimes(4);
        expect(pool.query).not.toHaveBeenCalled();

        // ADR-007: sendAlimtalk 첫 인자 객체 셰이프 보존
        const [sensConfig, , batch] = naverSens.sendAlimtalk.mock.calls[0];
        expect(sensConfig.naver_secret_key).toBe('decrypted-GOOD');
        expect(batch).toHaveLength(1);
        expect(batch[0]).toHaveProperty('content');
        expect(batch[0]).toHaveProperty('variables');
    });

    test('400 — 발송 실패 시 {error: "Send Failed", message} 표면 보존', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                is_enabled: 1, service_type: 'sens',
                naver_secret_key: 'GOOD',
                naver_access_key: 'AK', naver_service_id: 'SID',
                template_code: 'TPL_CODE', template_content: 'TPL_CONTENT',
            }]])
            .mockResolvedValueOnce([[{
                payment_id: 100, amount: 200000, year_month: '2026-05',
                student_id: 50, student_name: '홍길동', parent_phone: '010-1234-5678', student_phone: null,
            }]])
            .mockResolvedValueOnce([[{ name: '학원A', phone: '02-1234-5678', tuition_due_day: 5 }]])
            .mockResolvedValueOnce([{ insertId: 999 }]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: false, error: '템플릿 미승인' });

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-individual').send({ payment_id: 100 });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Failed');
        expect(res.body.message).toContain('알림 발송에 실패했습니다');
        expect(res.body.message).toContain('템플릿 미승인');
    });

    test('500 — 서버 에러 시 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB explode'));

        const app = buildApp();
        const res = await request(app).post('/paca/notifications/send-individual').send({ payment_id: 100 });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('알림 발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB explode');
    });
});
