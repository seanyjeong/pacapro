/**
 * routes/notifications/test/sens.js 회귀 테스트.
 *
 * 4 endpoint:
 *  - POST /test-sens-consultation
 *  - POST /test-sens-trial
 *  - POST /test-sens-overdue
 *  - POST /test-sens-reminder (응답 표면 다름: { success, message } / 실패 'Send Error')
 *
 * SENS 4 endpoint 모두 notification_logs 기록 X (원본 동작 보존).
 * 외부 API (sendAlimtalk) 100% 모킹 — 실 발송 X.
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
    createUnpaidNotificationMessage: jest.fn(),
    isValidPhoneNumber: jest.fn((phone) => /^010-\d{4}-\d{4}$/.test(phone)),
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
const logger = require('../../../../utils/logger');
const registerSens = require('../../../../routes/notifications/test/sens');

function buildApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerSens(router);
    app.use('/paca/notifications', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    naverSens.sendAlimtalk.mockReset();
    naverSens.decryptApiKey.mockClear();
    logger.error.mockReset();
});

function buildSensSetting(extra = {}) {
    return {
        naver_access_key: 'AK',
        naver_secret_key: 'SK',
        naver_service_id: 'SID',
        kakao_channel_id: 'KC',
        ...extra,
    };
}

describe('POST /paca/notifications/test-sens-consultation', () => {
    test('phone 누락 → 400 한국어', async () => {
        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('유효한 전화번호를 입력해주세요.');
    });

    test('SENS 설정 누락 → "SENS API 설정을 먼저 완료해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[{ naver_access_key: null }]]);
        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('SENS API 설정을 먼저 완료해주세요.');
    });

    test('템플릿 코드 누락 → "상담확정 템플릿 코드를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({ sens_consultation_template_code: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('상담확정 템플릿 코드를 먼저 설정해주세요.');
    });

    test('Secret 복호화 실패 → "SENS API Secret이 올바르지 않습니다."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({
            naver_secret_key: 'BAD',
            sens_consultation_template_code: 'CODE',
        })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('SENS API Secret이 올바르지 않습니다.');
    });

    test('정상 발송 → 200 + { message, success, requestId } (notification_logs 기록 X)', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({
            sens_consultation_template_code: 'CODE-CSL',
            sens_consultation_template_content: '#{이름} #{날짜} #{시간} #{예약번호}',
            sens_consultation_buttons: JSON.stringify([{ buttonName: 'b', linkMo: 'https://x?u=#{이름}' }]),
        })]]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-CSL' });

        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('SENS 상담확정 테스트 발송 성공');
        expect(res.body.success).toBe(true);
        expect(res.body.requestId).toBe('REQ-CSL');

        // SENS 분기는 INSERT INTO notification_logs 호출 0건 (원본 동작 보존)
        const allSql = pool.execute.mock.calls.map(c => c[0]).join('\n');
        expect(allSql).not.toContain('INSERT INTO notification_logs');

        // 변수 치환 (버튼 link 까지)
        const sendArgs = naverSens.sendAlimtalk.mock.calls[0];
        expect(sendArgs[1]).toBe('CODE-CSL');
        expect(sendArgs[2][0].content).toContain('테스트학생');
        expect(sendArgs[2][0].buttons[0].linkMo).toContain('테스트학생');
    });

    test('발송 실패 → 400 + { error: "Send Failed", message } (details 없음 — 원본 보존)', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({
            sens_consultation_template_code: 'CODE',
            sens_consultation_template_content: 't',
        })]]);
        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: false, error: 'SENS_FAIL_AUTH' });
        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Failed');
        expect(res.body.message).toContain('SENS_FAIL_AUTH');
        // 원본: SENS 분기는 details 미포함 (솔라피 분기와 다름)
        expect(res.body).not.toHaveProperty('details');
    });

    test('5xx → 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SENS_DB_X_INTERNAL_SECRET'));
        const res = await request(buildApp()).post('/paca/notifications/test-sens-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('SENS 상담확정 테스트 발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('SENS_DB_X_INTERNAL_SECRET');
    });
});

describe('POST /paca/notifications/test-sens-trial', () => {
    test('템플릿 코드 누락 → "체험수업 템플릿 코드를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({ sens_trial_template_code: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-sens-trial').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('체험수업 템플릿 코드를 먼저 설정해주세요.');
    });

    test('정상 발송 → 200 + { message, success, requestId } + 학원명 기본값 fallback', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSensSetting({
                sens_trial_template_code: 'CODE-TRIAL',
                sens_trial_template_content: '#{이름} #{학원명} #{체험일정}',
            })]])
            .mockResolvedValueOnce([[]]); // academy 미존재 → fallback "테스트학원"

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-TRIAL' });

        const res = await request(buildApp()).post('/paca/notifications/test-sens-trial').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('SENS 체험수업 테스트 발송 성공');
        expect(res.body.requestId).toBe('REQ-TRIAL');

        const content = naverSens.sendAlimtalk.mock.calls[0][2][0].content;
        expect(content).toContain('테스트학원'); // fallback
        expect(content).toContain('1회차:');
        expect(content).toContain('2회차:');
    });

    test('5xx 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('TRIAL_X_PRIVATE'));
        const res = await request(buildApp()).post('/paca/notifications/test-sens-trial').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('SENS 체험수업 테스트 발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('TRIAL_X_PRIVATE');
    });
});

describe('POST /paca/notifications/test-sens-overdue', () => {
    test('템플릿 코드 누락', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({ sens_overdue_template_code: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-sens-overdue').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('미납자 템플릿 코드를 먼저 설정해주세요.');
    });

    test('정상 발송 → 200 + 가짜 데이터 (500,000) 메시지 치환', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSensSetting({
                sens_overdue_template_code: 'CODE-OD',
                sens_overdue_template_content: '#{이름} #{월}월 #{교육비} #{날짜} #{학원명} #{학원전화}',
            })]])
            .mockResolvedValueOnce([[{ name: 'OD학원', phone: '02-9' }]]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-OD' });

        const res = await request(buildApp()).post('/paca/notifications/test-sens-overdue').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(200);
        expect(res.body.message).toBe('SENS 미납자 테스트 발송 성공');
        expect(res.body.requestId).toBe('REQ-OD');

        const content = naverSens.sendAlimtalk.mock.calls[0][2][0].content;
        expect(content).toContain('500,000');
        expect(content).toContain('OD학원');
    });

    test('발송 실패 → "Send Failed" (details 없음)', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSensSetting({ sens_overdue_template_code: 'C' })]])
            .mockResolvedValueOnce([[{ name: 'A', phone: '02-1' }]]);
        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: false, error: 'OD_X' });

        const res = await request(buildApp()).post('/paca/notifications/test-sens-overdue').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Failed');
        expect(res.body).not.toHaveProperty('details');
    });
});

describe('POST /paca/notifications/test-sens-reminder (응답 표면 다름)', () => {
    test('템플릿 코드 누락 → "리마인드 템플릿 코드를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSensSetting({ sens_reminder_template_code: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-sens-reminder').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('리마인드 템플릿 코드를 먼저 설정해주세요.');
    });

    test('reminder_hours >= 24 → "N일" 표기 + 정상 발송 응답 표면 { success, message }', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSensSetting({
                sens_reminder_template_code: 'CODE-R',
                sens_reminder_template_content: '#{이름} #{남은시간} #{학원명} #{학원전화}',
                sens_reminder_hours: 72,
            })]])
            .mockResolvedValueOnce([[{ name: '리마인드학원', phone: '02-9' }]]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true });

        const res = await request(buildApp()).post('/paca/notifications/test-sens-reminder').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        // 원본 응답 표면: { success, message } (requestId 없음)
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('SENS 리마인드 테스트 알림톡이 발송되었습니다.');
        expect(res.body).not.toHaveProperty('requestId');

        const content = naverSens.sendAlimtalk.mock.calls[0][2][0].content;
        expect(content).toContain('3일'); // 72시간 = 3일
    });

    test('reminder_hours < 24 → "N시간"', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSensSetting({
                sens_reminder_template_code: 'CODE-R',
                sens_reminder_template_content: '#{남은시간}',
                sens_reminder_hours: 5,
            })]])
            .mockResolvedValueOnce([[{ name: 'A', phone: '02-1' }]]);
        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true });

        await request(buildApp()).post('/paca/notifications/test-sens-reminder').send({ phone: '010-1234-5678' });

        const content = naverSens.sendAlimtalk.mock.calls[0][2][0].content;
        expect(content).toBe('5시간');
    });

    test('발송 실패 → 400 + { error: "Send Error", message, details } (원본 응답 표면 보존)', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSensSetting({
                sens_reminder_template_code: 'CODE-R',
                sens_reminder_template_content: 't',
            })]])
            .mockResolvedValueOnce([[{ name: 'A', phone: '02-1' }]]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({
            success: false,
            message: 'SENS 리마인드 실패',
            details: { code: 'YYY' },
        });

        const res = await request(buildApp()).post('/paca/notifications/test-sens-reminder').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Error');
        expect(res.body.message).toBe('SENS 리마인드 실패');
        expect(res.body.details).toEqual({ code: 'YYY' });
    });
});
