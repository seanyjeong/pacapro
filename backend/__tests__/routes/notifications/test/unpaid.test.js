/**
 * routes/notifications/test/unpaid.js 회귀 테스트.
 *
 * POST /paca/notifications/test (미납 안내 듀얼 채널 테스트 발송).
 *
 * 검증:
 *  - 입력 검증 (phone 누락 / 잘못된 형식) → 400 + 한국어
 *  - 설정 미존재 → 400 + 한국어
 *  - service_type='solapi' 분기:
 *    * Secret 복호화 실패 → 400 + 한국어
 *    * 정상 발송 → notification_logs INSERT + 200 + { message, success, requestId }
 *  - service_type='sens' 분기 (기본):
 *    * Secret 복호화 실패 → 400 + 한국어
 *    * 정상 발송 → notification_logs INSERT + 200 + { message, success, requestId }
 *  - 발송 실패 → 400 + { error: 'Send Failed', message, details }
 *  - 5xx → e.message 누출 0건
 *
 * Mock 정책:
 *  - 외부 발송 API (sendAlimtalk / sendAlimtalkSolapi) 모킹 — 실 발송 X.
 *  - DB pool / 인증 / 로거 모킹.
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
    createUnpaidNotificationMessage: jest.fn((paymentInfo, student, academy, template) => ({
        content: `[${academy.name}] ${student.name} 미납 ${paymentInfo.month}월 ${paymentInfo.amount}`,
        variables: { '#{이름}': student.name },
    })),
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
const solapi = require('../../../../utils/solapi');
const logger = require('../../../../utils/logger');
const registerUnpaid = require('../../../../routes/notifications/test/unpaid');

function buildApp() {
    const app = express();
    app.use(express.json());
    const router = express.Router();
    registerUnpaid(router);
    app.use('/paca/notifications', router);
    return app;
}

beforeEach(() => {
    pool.execute.mockReset();
    naverSens.sendAlimtalk.mockReset();
    naverSens.isValidPhoneNumber.mockClear();
    naverSens.createUnpaidNotificationMessage.mockClear();
    naverSens.decryptApiKey.mockClear();
    solapi.sendAlimtalkSolapi.mockReset();
    logger.error.mockReset();
});

describe('POST /paca/notifications/test (입력 검증)', () => {
    test('phone 누락 → 400 + 한국어 메시지', async () => {
        const res = await request(buildApp()).post('/paca/notifications/test').send({});
        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Validation Error');
        expect(res.body.message).toBe('유효한 전화번호를 입력해주세요.');
    });

    test('잘못된 phone 형식 → 400 + 한국어', async () => {
        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: 'invalid' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('유효한 전화번호를 입력해주세요.');
    });

    test('알림 설정 미존재 → 400 + "알림 설정을 먼저 완료해주세요."', async () => {
        pool.execute.mockResolvedValueOnce([[]]); // settings empty
        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('알림 설정을 먼저 완료해주세요.');
        // 설정 조회는 ADR-005 표준
        expect(pool.execute).toHaveBeenCalledWith(
            expect.stringContaining('FROM notification_settings'),
            [1]
        );
    });
});

describe('POST /paca/notifications/test (솔라피 분기)', () => {
    test('Secret 복호화 실패 → 400 + "솔라피 API Secret이 올바르지 않습니다."', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ service_type: 'solapi', solapi_api_secret: 'BAD', template_content: 't' }]]) // settings
            .mockResolvedValueOnce([[{ name: 'A학원', phone: '02-1', tuition_due_day: 5 }]]); // academy

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('솔라피 API Secret이 올바르지 않습니다.');
    });

    test('정상 발송 → notification_logs INSERT + 200 + { message, success, requestId } 표면 유지', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                service_type: 'solapi',
                solapi_api_key: 'kk',
                solapi_api_secret: 'ss',
                solapi_pfid: 'pp',
                solapi_sender_phone: '02-1',
                solapi_template_id: 'TID-001',
                solapi_template_content: 'tpl-solapi',
                template_content: 'tpl-fallback',
            }]])
            .mockResolvedValueOnce([[{ name: 'A학원', phone: '02-1', tuition_due_day: 7 }]])
            .mockResolvedValueOnce([{ insertId: 1 }]); // log INSERT

        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'GROUP-XYZ' });

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('테스트 메시지가 발송되었습니다');
        expect(res.body.message).toContain('솔라피');
        expect(res.body.success).toBe(true);
        expect(res.body.requestId).toBe('GROUP-XYZ');

        // ADR-005: pool.execute (3번)
        expect(pool.execute).toHaveBeenCalledTimes(3);
        // 3번째 호출 = log INSERT (SQL 에 'alimtalk' / 'sent' 하드코드 → params 6개)
        expect(pool.execute.mock.calls[2][0]).toContain('INSERT INTO notification_logs');
        expect(pool.execute.mock.calls[2][0]).toContain("'alimtalk'");
        expect(pool.execute.mock.calls[2][0]).toContain("'sent'");
        expect(pool.execute.mock.calls[2][1]).toEqual([
            1, '테스트', '010-1234-5678', 'TID-001', expect.any(String), 'GROUP-XYZ',
        ]);
        // ADR-007: 보안 헬퍼 시그니처 보존 (첫 인자 = raw cipher 그대로 전달)
        expect(naverSens.decryptApiKey).toHaveBeenCalledTimes(1);
        expect(naverSens.decryptApiKey.mock.calls[0][0]).toBe('ss');
        expect(naverSens.decryptApiKey.mock.calls[0]).toHaveLength(2); // (cipher, ENCRYPTION_KEY)
    });

    test('발송 ID가 없어도 이력에는 NULL을 기록하고 성공 응답을 유지한다', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    service_type: 'solapi',
                    solapi_api_key: 'kk',
                    solapi_api_secret: 'ss',
                    solapi_pfid: 'pp',
                    solapi_sender_phone: '02-1',
                    solapi_template_id: 'TID-001',
                    solapi_template_content: 'tpl-solapi',
                },
            ]])
            .mockResolvedValueOnce([[{ name: 'A학원', phone: '02-1', tuition_due_day: 7 }]])
            .mockImplementationOnce(async (_sql, params) => {
                if (params.includes(undefined)) throw new Error('undefined bind parameter');
                return [{ insertId: 2 }];
            });
        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true });

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(pool.execute.mock.calls[2][1][5]).toBeNull();
    });

    test('발송 후 이력 저장이 실패해도 이미 성공한 발송 응답은 성공으로 유지한다', async () => {
        pool.execute
            .mockResolvedValueOnce([[
                {
                    service_type: 'solapi',
                    solapi_api_key: 'kk',
                    solapi_api_secret: 'ss',
                    solapi_pfid: 'pp',
                    solapi_sender_phone: '02-1',
                    solapi_template_id: 'TID-001',
                    solapi_template_content: 'tpl-solapi',
                },
            ]])
            .mockResolvedValueOnce([[{ name: 'A학원', phone: '02-1', tuition_due_day: 7 }]])
            .mockRejectedValueOnce(new Error('notification log unavailable'));
        solapi.sendAlimtalkSolapi.mockResolvedValueOnce({ success: true, groupId: 'GROUP-SENT' });

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.requestId).toBe('GROUP-SENT');
        expect(logger.error).toHaveBeenCalledWith('테스트 발송 이력 기록 오류:', expect.any(Error));
    });
});

describe('POST /paca/notifications/test (SENS 분기 — 기본)', () => {
    test('service_type 미설정 시 SENS 분기 + Secret 복호화 실패 → "API Secret Key가 올바르지 않습니다."', async () => {
        pool.execute
            .mockResolvedValueOnce([[{ naver_secret_key: 'BAD', template_content: 't', template_code: 'C001' }]])
            .mockResolvedValueOnce([[{ name: 'A학원', phone: '02-1', tuition_due_day: 5 }]]);

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });
        expect(res.status).toBe(400);
        expect(res.body.message).toBe('API Secret Key가 올바르지 않습니다.');
    });

    test('SENS 정상 발송 → notification_logs INSERT + 200 + { message, success, requestId }', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                service_type: 'sens',
                naver_access_key: 'AK',
                naver_secret_key: 'SK',
                naver_service_id: 'SID',
                kakao_channel_id: 'KC',
                template_code: 'CODE-001',
                template_content: 'tpl',
            }]])
            .mockResolvedValueOnce([[{ name: 'A학원', phone: '02-9', tuition_due_day: 10 }]])
            .mockResolvedValueOnce([{ insertId: 2 }]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: true, requestId: 'REQ-001' });

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(200);
        expect(res.body.message).toContain('SENS');
        expect(res.body.success).toBe(true);
        expect(res.body.requestId).toBe('REQ-001');

        // log INSERT params (SQL 에 'alimtalk' / 'sent' 하드코드 → params 6개)
        // params: [academyId, recipientName, recipientPhone, templateCode, messageContent, requestId]
        expect(pool.execute.mock.calls[2][0]).toContain('INSERT INTO notification_logs');
        expect(pool.execute.mock.calls[2][1][1]).toBe('테스트');
        expect(pool.execute.mock.calls[2][1][3]).toBe('CODE-001');
        expect(pool.execute.mock.calls[2][1][5]).toBe('REQ-001');
    });
});

describe('POST /paca/notifications/test (발송 실패 + 5xx)', () => {
    test('발송 실패 → 400 + { error: "Send Failed", message, details } 표면', async () => {
        pool.execute
            .mockResolvedValueOnce([[{
                service_type: 'sens',
                naver_access_key: 'AK', naver_secret_key: 'SK', naver_service_id: 'SID',
                template_code: 'C', template_content: 't',
            }]])
            .mockResolvedValueOnce([[{ name: 'A', phone: 'P', tuition_due_day: 1 }]]);

        naverSens.sendAlimtalk.mockResolvedValueOnce({ success: false, error: 'NAVER_AUTH_FAIL' });

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe('Send Failed');
        expect(res.body.message).toContain('테스트 발송에 실패했습니다');
        expect(res.body.message).toContain('알림톡 연동 설정을 확인한 뒤 다시 시도해주세요');
        expect(res.body.message).not.toContain('NAVER_AUTH_FAIL');
        expect(res.body).toHaveProperty('details');
    });

    test('5xx (DB 에러) → e.message 누출 0건 + 한국어 메시지', async () => {
        pool.execute.mockRejectedValueOnce(new Error('SECRET_DB_INTERNAL_DETAIL_AAA'));

        const res = await request(buildApp()).post('/paca/notifications/test').send({ phone: '010-1234-5678' });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe('Server Error');
        expect(res.body.message).toBe('테스트 발송에 실패했습니다.');
        // 사용자 노출 body 어디에도 e.message 없음
        const bodyStr = JSON.stringify(res.body);
        expect(bodyStr).not.toContain('SECRET_DB_INTERNAL_DETAIL_AAA');
        expect(logger.error).toHaveBeenCalled();
    });
});
