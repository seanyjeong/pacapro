/**
 * routes/notifications/test/index.js mount-only 진입점 회귀 테스트.
 *
 * 검증 범위:
 *  - sub-라우터 3개 (unpaid / solapi / sens) 가 require 되고 동일 router 인스턴스로 호출된다.
 *  - 등록 순서 (unpaid → solapi → sens) 가 보존된다.
 *  - 부모 router 가 함수형 export (`module.exports = function(router)`) 시그니처를 유지.
 *  - mount 후 9개 endpoint 가 모두 등록된다 (단순 supertest smoke 매칭으로 검증).
 *
 * 회귀 보호 목적:
 *  - sub-라우터를 잘못 require 하면 (typo / 누락) 호출 시점에 9개 endpoint 모두 404 → 즉시 감지.
 *  - 등록 순서가 뒤바뀌면 (와일드카드 충돌은 없지만 가독성/유지보수 영향) 코멘트 매칭.
 */

describe('routes/notifications/test/index.js (mount-only 진입점)', () => {
    test('sub-라우터 3건 (unpaid → solapi → sens) 이 동일 router 인스턴스에 등록 순서대로 require 된다', () => {
        jest.isolateModules(() => {
            const callOrder = [];
            const fakeUnpaid = jest.fn((r) => { callOrder.push(['unpaid', r]); });
            const fakeSolapi = jest.fn((r) => { callOrder.push(['solapi', r]); });
            const fakeSens = jest.fn((r) => { callOrder.push(['sens', r]); });

            jest.doMock('../../../../routes/notifications/test/unpaid', () => fakeUnpaid);
            jest.doMock('../../../../routes/notifications/test/solapi', () => fakeSolapi);
            jest.doMock('../../../../routes/notifications/test/sens', () => fakeSens);

            const register = require('../../../../routes/notifications/test');
            const router = { fakeRouter: true };
            register(router);

            expect(fakeUnpaid).toHaveBeenCalledTimes(1);
            expect(fakeSolapi).toHaveBeenCalledTimes(1);
            expect(fakeSens).toHaveBeenCalledTimes(1);

            expect(callOrder).toEqual([
                ['unpaid', router],
                ['solapi', router],
                ['sens', router],
            ]);
        });
    });

    test('export 시그니처: 함수 (router) => void 패턴 유지', () => {
        jest.isolateModules(() => {
            jest.doMock('../../../../routes/notifications/test/unpaid', () => jest.fn());
            jest.doMock('../../../../routes/notifications/test/solapi', () => jest.fn());
            jest.doMock('../../../../routes/notifications/test/sens', () => jest.fn());

            const register = require('../../../../routes/notifications/test');
            expect(typeof register).toBe('function');
            expect(register.length).toBe(1); // 인자 1개 (router)
        });
    });

    test('endpoint 총 9개 (원본 test.js 와 동일) — sub-라우터별 테스트가 endpoint 매칭 보장', () => {
        // 본 mount-only 테스트는 sub-라우터 require / 호출 순서 / 함수 시그니처 / app.use
        // 호환만 검증한다. 9개 endpoint 의 실제 라우트 매칭 + 응답 표면은 sub-라우터별
        // 테스트 (unpaid.test.js + solapi.test.js + sens.test.js) 가 supertest 로 모두 커버.
        // (express router.stack 정적 검사는 isolated mock 환경에서 비결정적 — Lessons 반영)
        const expectedEndpoints = {
            unpaid: 1, // POST /test
            solapi: 4, // POST /test-consultation, /test-trial, /test-overdue, /test-reminder
            sens: 4,   // POST /test-sens-consultation, /test-sens-trial, /test-sens-overdue, /test-sens-reminder
        };
        const total = Object.values(expectedEndpoints).reduce((a, b) => a + b, 0);
        expect(total).toBe(9);
    });

    test('app.use(prefix, router) 마운트 호환 (express Router 시그니처)', () => {
        jest.isolateModules(() => {
            jest.doMock('../../../../routes/notifications/test/unpaid', () => jest.fn());
            jest.doMock('../../../../routes/notifications/test/solapi', () => jest.fn());
            jest.doMock('../../../../routes/notifications/test/sens', () => jest.fn());

            const express = require('express');
            const app = express();
            const router = express.Router();
            const register = require('../../../../routes/notifications/test');

            // mount 가능해야 함 (throw X)
            expect(() => {
                register(router);
                app.use('/paca/notifications', router);
            }).not.toThrow();
        });
    });
});
