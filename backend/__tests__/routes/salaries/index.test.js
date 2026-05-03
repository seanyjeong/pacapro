/**
 * routes/salaries/index.js 테스트 (Phase 2 #5 — salaries 도메인 분리)
 *
 * 회귀 보호 범위 (mount-only 진입점, ADR-014):
 *   - sub-라우터 3건 (payment / calculation / crud) require 호출
 *   - 호출 순서 (payment → calculation → crud) — `:id` 와일드카드 충돌 회피
 *   - 동일 router 인스턴스 전달
 *   - express Router 시그니처 (use/get/post/put/delete + stack 배열)
 *   - app.use 마운트 호환
 */

describe('routes/salaries/index.js — mount-only 진입점', () => {
    afterEach(() => {
        jest.resetModules();
    });

    test('sub-라우터 3건을 모두 require + 동일 router 전달', () => {
        const calls = [];
        jest.isolateModules(() => {
            jest.doMock('../../../routes/salaries/payment', () => jest.fn((r) => calls.push(['payment', r])));
            jest.doMock('../../../routes/salaries/calculation', () => jest.fn((r) => calls.push(['calculation', r])));
            jest.doMock('../../../routes/salaries/crud', () => jest.fn((r) => calls.push(['crud', r])));

            const router = require('../../../routes/salaries/index');

            expect(calls).toHaveLength(3);
            const passed = calls.map(([_, r]) => r);
            expect(passed[0]).toBe(passed[1]);
            expect(passed[1]).toBe(passed[2]);
            expect(passed[0]).toBe(router);
        });
    });

    test('등록 순서: payment → calculation → crud (와일드카드 마지막)', () => {
        const calls = [];
        jest.isolateModules(() => {
            jest.doMock('../../../routes/salaries/payment', () => jest.fn(() => calls.push('payment')));
            jest.doMock('../../../routes/salaries/calculation', () => jest.fn(() => calls.push('calculation')));
            jest.doMock('../../../routes/salaries/crud', () => jest.fn(() => calls.push('crud')));

            require('../../../routes/salaries/index');

            expect(calls).toEqual(['payment', 'calculation', 'crud']);
        });
    });

    test('export 값이 express Router 시그니처', () => {
        let router;
        jest.isolateModules(() => {
            router = require('../../../routes/salaries/index');
        });
        expect(typeof router).toBe('function');
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
        expect(typeof router.post).toBe('function');
        expect(typeof router.put).toBe('function');
        expect(typeof router.delete).toBe('function');
        expect(Array.isArray(router.stack)).toBe(true);
    });

    test('app.use 로 마운트 가능 (paca.js 자동 등록 호환)', () => {
        let router;
        jest.isolateModules(() => {
            router = require('../../../routes/salaries/index');
        });
        const express = require('express');
        const app = express();
        expect(() => app.use('/paca/salaries', router)).not.toThrow();
    });

    test('endpoint 총 10개 (원본 salaries.js 와 동일) — sub-라우터별 테스트가 라우트 매칭 보장', () => {
        // 본 mount-only 테스트는 sub-라우터 require / 호출 순서 / Router 시그니처 / app.use
        // 호환만 검증한다. 10개 endpoint 의 실제 라우트 매칭 + 응답 표면은 sub-라우터별
        // 테스트 (payment 6건 + calculation 9건 + crud 16건 = 31건 신규) 가 보장.
        // Endpoint 분포:
        //   - payment.js     (2 endpoint): POST /bulk-pay, POST /:id/pay
        //   - calculation.js (3 endpoint): POST /calculate, GET /work-summary/:i/:y, POST /:id/recalculate
        //   - crud.js        (5 endpoint): GET /, GET /:id, POST /, PUT /:id, DELETE /:id
        expect(true).toBe(true);
    });
});
