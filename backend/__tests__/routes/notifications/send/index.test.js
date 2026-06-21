/**
 * routes/notifications/send/index.js 회귀 테스트.
 *
 * mount-only 진입점 검증:
 *  - sub-라우터 3건 (manual / auto / webhooks) require 호출 + 동일 router 인스턴스 전달
 *  - 호출 순서 (manual → auto → webhooks)
 *  - 함수 (router) => void 시그니처
 *  - express Router 의 app.use 마운트 호환
 *  - 등록 endpoint 8건 카운트
 *
 * ⛔ ADR-014 광역 미들웨어 추가 금지 — verifyToken 미적용 webhook endpoint 4건 보호.
 *  - mount-only 진입점에 router.use(verifyToken) 같은 광역 미들웨어가 추가되면 webhook 4건이 401 break.
 *  - 본 테스트는 sub-라우터 require 호출 횟수 만 검증 (광역 미들웨어 흔적 0건).
 */

describe('routes/notifications/send/index.js mount-only 진입점', () => {
    afterEach(() => {
        jest.resetModules();
    });

    test('sub-라우터 3건 (manual / auto / webhooks) 을 모두 require 한다', () => {
        const manualMock = jest.fn();
        const autoMock = jest.fn();
        const webhooksMock = jest.fn();

        jest.isolateModules(() => {
            jest.doMock('../../../../routes/notifications/send/manual', () => manualMock);
            jest.doMock('../../../../routes/notifications/send/auto', () => autoMock);
            jest.doMock('../../../../routes/notifications/send/webhooks', () => webhooksMock);

            const register = require('../../../../routes/notifications/send');
            const fakeRouter = {};
            register(fakeRouter);

            expect(manualMock).toHaveBeenCalledTimes(1);
            expect(autoMock).toHaveBeenCalledTimes(1);
            expect(webhooksMock).toHaveBeenCalledTimes(1);

            // 같은 router 인스턴스가 3 sub-라우터에 모두 전달
            expect(manualMock).toHaveBeenCalledWith(fakeRouter);
            expect(autoMock).toHaveBeenCalledWith(fakeRouter);
            expect(webhooksMock).toHaveBeenCalledWith(fakeRouter);
        });
    });

    test('등록 순서는 manual → auto → webhooks (인증 강도 강 → 약)', () => {
        const callOrder = [];
        const manualMock = jest.fn(() => callOrder.push('manual'));
        const autoMock = jest.fn(() => callOrder.push('auto'));
        const webhooksMock = jest.fn(() => callOrder.push('webhooks'));

        jest.isolateModules(() => {
            jest.doMock('../../../../routes/notifications/send/manual', () => manualMock);
            jest.doMock('../../../../routes/notifications/send/auto', () => autoMock);
            jest.doMock('../../../../routes/notifications/send/webhooks', () => webhooksMock);

            const register = require('../../../../routes/notifications/send');
            register({});

            expect(callOrder).toEqual(['manual', 'auto', 'webhooks']);
        });
    });

    test('진입점은 (router) => void 시그니처 함수다', () => {
        // jest.isolateModules 로 require 격리 — 다른 테스트의 mock 잔재 영향 차단.
        jest.isolateModules(() => {
            const register = require('../../../../routes/notifications/send');
            expect(typeof register).toBe('function');
            expect(register.length).toBe(1);
        });
    });

    test('app.use 마운트 호환 — express Router 인스턴스에 등록 가능 (예외 무발생)', () => {
        // 주의: instructors 분리 lesson (#186) 처럼 router.stack.length 정적 검증은
        // sub-라우터 별도 Router 인스턴스에서 정의된 후 mount 되는 패턴에서 0 으로 잡힐 수 있어
        // 본 테스트는 (a) sub-라우터 require 호출 + (b) app.use 예외 무발생만 검증한다.
        // endpoint 8건의 실제 매칭 검증은 manual/auto/webhooks 각자 suite 가 supertest 로 담당.
        jest.isolateModules(() => {
            jest.doMock('../../../../config/database', () => ({
                execute: jest.fn(),
                query: jest.fn(),
            }));
            jest.doMock('../../../../middleware/auth', () => ({
                verifyToken: jest.fn((req, res, next) => next()),
                checkPermission: jest.fn(() => (req, res, next) => next()),
            }));
            jest.doMock('../../../../utils/naverSens', () => ({
                encryptApiKey: jest.fn(),
                decryptApiKey: jest.fn(),
                sendAlimtalk: jest.fn(),
                createUnpaidNotificationMessage: jest.fn(),
                isValidPhoneNumber: jest.fn(),
            }));
            jest.doMock('../../../../utils/encryption', () => ({ decrypt: jest.fn() }));
            jest.doMock('../../../../utils/solapi', () => ({
                sendAlimtalkSolapi: jest.fn(),
                getBalanceSolapi: jest.fn(),
            }));
            jest.doMock('../../../../utils/logger', () => ({
                info: jest.fn(), warn: jest.fn(), error: jest.fn(),
            }));

            const express = require('express');
            const router = express.Router();
            const register = require('../../../../routes/notifications/send');

            // 등록 호출 자체가 예외 없이 완료되어야 함 (sub-라우터 3건 require + 등록)
            expect(() => register(router)).not.toThrow();

            // app.use 마운트 호환
            const app = express();
            expect(() => app.use('/paca/notifications', router)).not.toThrow();
        });
    });

    test('진입점은 광역 미들웨어 (router.use) 를 추가하지 않는다 — webhook 4건 보호', () => {
        // 진입점이 router.use 를 호출하면 webhook endpoint 가 광역 verifyToken 으로 깨질 수 있음.
        // 본 테스트는 fakeRouter 의 use 호출 횟수가 정확히 0 이어야 함을 검증.
        const useSpy = jest.fn();
        const fakeRouter = { use: useSpy };

        // sub-라우터들은 noop — router.get/post 호출도 X.
        jest.isolateModules(() => {
            jest.doMock('../../../../routes/notifications/send/manual', () => () => {});
            jest.doMock('../../../../routes/notifications/send/auto', () => () => {});
            jest.doMock('../../../../routes/notifications/send/webhooks', () => () => {});

            const register = require('../../../../routes/notifications/send');
            register(fakeRouter);

            expect(useSpy).not.toHaveBeenCalled();
        });
    });
});
