/**
 * routes/notifications/test/solapi.js 회귀 테스트.
 *
 * 4 endpoint:
 *  - POST /test-consultation
 *  - POST /test-trial
 *  - POST /test-overdue
 *  - POST /test-reminder (응답 표면 다름: { success, message } / 실패 'Send Error')
 *
 * 외부 API (sendAlimtalkSolapi) 100% 모킹 — 실 발송 X.
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
const solapi = require('../../../../utils/solapi');
const naverSens = require('../../../../utils/naverSens');
const logger = require('../../../../utils/logger');
const registerSolapi = require('../../../../routes/notifications/test/solapi');

function buildApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerSolapi(router);
    app.use('/paca/notifications', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    solapi.sendAlimtalkSolapi.mockReset();
    naverSens.decryptApiKey.mockClear();
    logger.error.mockReset();
});

// 솔라피 분기 공통 setting fixture (테스트별로 필드 추가)
function buildSetting(extra = {}) {
    return {
        solapi_api_key: 'KEY',
        solapi_api_secret: 'SECRET',
        solapi_pfid: 'PFID',
        solapi_sender_phone: '02-1',
        ...extra,
    };
}

describe('POST /paca/notifications/test-consultation (솔라피 상담확정)', () => {
    test('phone 누락 → 400 + 한국어', async () => {
        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({});
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('유효한 전화번호를 입력해주세요.');
    });

    test('알림 설정 미존재 → 400', async () => {
        pool.execute.mockResolvedValueOnce([[]]);
        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('알림 설정을 먼저 완료해주세요.');
    });

    test('솔라피 설정 누락 → "솔라피 API 설정을 먼저 완료해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[{ solapi_api_key: null }]]);
        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('솔라피 API 설정을 먼저 완료해주세요.');
    });

    test('템플릿 ID 누락 → "상담확정 템플릿 ID를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({ solapi_consultation_template_id: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('상담확정 템플릿 ID를 먼저 설정해주세요.');
    });

    test('Secret 복호화 실패 → "솔라피 API Secret이 올바르지 않습니다."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({
            solapi_api_secret: 'BAD',
            solapi_consultation_template_id: 'TID',
        })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('솔라피 API Secret이 올바르지 않습니다.');
    });

    test('정상 발송 → notification_logs INSERT + 200 + { message, success, groupId }', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSetting({
                solapi_consultation_template_id: 'TID-CONSULT',
                solapi_consultation_template_content: '안녕하세요 #{이름}님 #{날짜} #{시간} #{예약번호}',
                solapi_consultation_buttons: JSON.stringify([{ buttonName: 'btn', linkMo: 'https://x/?u=#{이름}' }]),
            })]])
            .mockResolvedValueOnce([{ insertId: 5 }]);

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'G-001' });

        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('상담확정 테스트 메시지가 발송되었습니다.');
        expect(res.body.success).toBe(true);
        expect(res.body.groupId).toBe('G-001');

        // ADR-005: pool.execute 2회 (settings + log INSERT)
        expect(pool.execute).toHaveBeenCalledTimes(2);
        expect(pool.execute.mock.calls[1][0]).toContain('INSERT INTO notification_logs');
        expect(pool.execute.mock.calls[1][1][1]).toBe('테스트(상담확정)');

        // 변수 치환 검증: 버튼 link 까지 #{이름} 치환됨
        const sendArgs = solapi.sendAlimtalkSolapi.mock.calls[0];
        expect(sendArgs[1]).toBe('TID-CONSULT');
        expect(sendArgs[2][0].content).toContain('테스트학생');
        expect(sendArgs[2][0].buttons[0].linkMo).toContain('테스트학생');
    });

    test('발송 실패 → 400 + { error: "Send Failed", details }', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({ solapi_consultation_template_id: 'TID' })]]);
        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: false, error: 'SOLAPI_FAIL' });

        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Failed');
        expect(res.body.message).toContain('알림톡 연동 설정을 확인한 뒤 다시 시도해주세요');
        expect(res.body.message).not.toContain('SOLAPI_FAIL');
        expect(res.body).toHaveProperty('details');
    });

    test('5xx → e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('DB_INTERNAL_X_SECRET'));
        const res = await request(buildApp()).post('/paca/notifications/test-consultation').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('테스트 발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('DB_INTERNAL_X_SECRET');
    });
});

describe('POST /paca/notifications/test-trial (솔라피 체험수업)', () => {
    test('템플릿 ID 누락 → "체험수업 템플릿 ID를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({ solapi_trial_template_id: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-trial').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('체험수업 템플릿 ID를 먼저 설정해주세요.');
    });

    test('정상 발송 → 200 + { message, success, groupId } + 학원명 fetch + log INSERT', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSetting({
                solapi_trial_template_id: 'TID-TRIAL',
                solapi_trial_template_content: '#{이름} #{학원명} #{체험일정}',
            })]])
            .mockResolvedValueOnce([[{ name: '테스트학원', phone: null }]]) // academy
            .mockResolvedValueOnce([{ insertId: 9 }]); // log INSERT

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'G-TRIAL' });

        const res = await request(buildApp()).post('/paca/notifications/test-trial').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('체험수업 테스트 메시지가 발송되었습니다.');
        expect(res.body.groupId).toBe('G-TRIAL');

        expect(pool.execute).toHaveBeenCalledTimes(3); // settings + academy + log INSERT
        expect(pool.execute.mock.calls[1][0]).toContain('FROM academies');
        expect(pool.execute.mock.calls[2][0]).toContain('INSERT INTO notification_logs');
        expect(pool.execute.mock.calls[2][1][1]).toBe('테스트(체험수업)');

        // 메시지 변수 치환 (학원명 + 체험일정 1회차/2회차 표기)
        const content = solapi.sendAlimtalkSolapi.mock.calls[0][2][0].content;
        expect(content).toContain('테스트학생');
        expect(content).toContain('테스트학원');
        expect(content).toContain('1회차:');
        expect(content).toContain('2회차:');
    });

    test('5xx → 한국어 + e.message 누출 0건', async () => {
        pool.execute.mockRejectedValueOnce(new Error('TRIAL_DB_X'));
        const res = await request(buildApp()).post('/paca/notifications/test-trial').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(500);
        expect(res.body.message).toBe('테스트 발송에 실패했습니다.');
        expect(JSON.stringify(res.body)).not.toContain('TRIAL_DB_X');
    });
});

describe('POST /paca/notifications/test-overdue (솔라피 미납자)', () => {
    test('템플릿 ID 누락 → "미납자 템플릿 ID를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({ solapi_overdue_template_id: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-overdue').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('미납자 템플릿 ID를 먼저 설정해주세요.');
    });

    test('정상 발송 → 200 + log INSERT + 가짜 데이터 (300,000 / 10일) 메시지 치환', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSetting({
                solapi_overdue_template_id: 'TID-OD',
                solapi_overdue_template_content: '#{이름} #{월}월 #{교육비} #{날짜} #{학원명} #{학원전화}',
            })]])
            .mockResolvedValueOnce([[{ name: '미납학원', phone: '02-1' }]])
            .mockResolvedValueOnce([{ insertId: 11 }]);

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'G-OD' });

        const res = await request(buildApp()).post('/paca/notifications/test-overdue').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe('미납자 테스트 메시지가 발송되었습니다.');
        expect(res.body.groupId).toBe('G-OD');

        const content = solapi.sendAlimtalkSolapi.mock.calls[0][2][0].content;
        expect(content).toContain('300,000');
        expect(content).toContain('10일');
        expect(content).toContain('미납학원');
    });

    test('발송 실패 → 400 + Send Failed + details', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({ solapi_overdue_template_id: 'TID' })]])
            .mockResolvedValueOnce([[{ name: 'A', phone: '02-1' }]]);
        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: false, error: 'OD_FAIL' });
        const res = await request(buildApp()).post('/paca/notifications/test-overdue').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Failed');
    });
});

describe('POST /paca/notifications/test-reminder (솔라피 리마인드 — 응답 표면 다름)', () => {
    test('템플릿 ID 누락 → "리마인드 템플릿 ID를 먼저 설정해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[buildSetting({ solapi_reminder_template_id: null })]]);
        const res = await request(buildApp()).post('/paca/notifications/test-reminder').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('리마인드 템플릿 ID를 먼저 설정해주세요.');
    });

    test('reminder_hours >= 24 → "N일" 표기 + 정상 발송', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSetting({
                solapi_reminder_template_id: 'TID-R',
                solapi_reminder_template_content: '#{이름} #{남은시간} #{학원명} #{학원전화}',
                solapi_reminder_hours: 48,
            })]])
            .mockResolvedValueOnce([[{ name: '리학원', phone: '02-9' }]]);

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true });

        const res = await request(buildApp()).post('/paca/notifications/test-reminder').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        // 응답 표면: { success, message } (groupId 없음 — 원본 보존)
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe('리마인드 테스트 알림톡이 발송되었습니다.');
        expect(res.body).not.toHaveProperty('groupId');

        // 리마인드는 log INSERT 없음
        expect(pool.execute).toHaveBeenCalledTimes(2);

        // 메시지 변수 치환: 48시간 = "2일"
        const content = solapi.sendAlimtalkSolapi.mock.calls[0][2][0].content;
        expect(content).toContain('2일');
    });

    test('reminder_hours < 24 → "N시간" 표기', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSetting({
                solapi_reminder_template_id: 'TID-R',
                solapi_reminder_template_content: '#{남은시간}',
                solapi_reminder_hours: 3,
            })]])
            .mockResolvedValueOnce([[{ name: 'A', phone: '02-1' }]]);

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true });

        await request(buildApp()).post('/paca/notifications/test-reminder').send({ phone: '010-1234-5678' });

        const content = solapi.sendAlimtalkSolapi.mock.calls[0][2][0].content;
        expect(content).toBe('3시간');
    });

    test('발송 실패 → 400 + { error: "Send Error", message, details } (원본 응답 표면 보존)', async () => {
        pool.execute
            .mockResolvedValueOnce([[buildSetting({
                solapi_reminder_template_id: 'TID-R',
                solapi_reminder_template_content: 't',
            })]])
            .mockResolvedValueOnce([[{ name: 'A', phone: '02-1' }]]);

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({
            success: false,
            error: '허용되지 않은 IP(192.0.2.1)로 접근하고 있습니다.',
            details: { code: 'XXX' },
        });

        const res = await request(buildApp()).post('/paca/notifications/test-reminder').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Error'); // 원본: 'Send Error' (다른 endpoint 는 'Send Failed')
        expect(res.body.message).toContain('현재 서버가 허용되지 않았습니다');
        expect(res.body.message).not.toContain('192.0.2.1');
        expect(res.body.details).toEqual({ code: 'XXX' });
    });
});
