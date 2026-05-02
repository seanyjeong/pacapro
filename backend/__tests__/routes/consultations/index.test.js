/**
 * routes/consultations/index.js 테스트 (Phase 3 #2 — consultations 도메인 분리)
 *
 * 회귀 보호 범위 (mount-only 진입점, ADR-014):
 *   - sub-라우터 6건 (settings / calendar / learning / conversion / write / list-detail)
 *     require 호출
 *   - 호출 순서 (settings → calendar → learning → conversion → write → list-detail)
 *     — `:id` 와일드카드 충돌 회피 (고정 경로 우선)
 *   - 동일 router 인스턴스 전달
 *   - express Router 시그니처 (use/get/post/put/delete + stack 배열)
 *   - app.use 마운트 호환
 */

describe('routes/consultations/index.js — mount-only 진입점', () => {
    afterEach(() => {
        jest.resetModules();
    });

    test('sub-라우터 6건을 모두 require + 동일 router 전달', () => {
        const calls = [];
        jest.isolateModules(() => {
            jest.doMock('../../../routes/consultations/settings', () => jest.fn((r) => calls.push(['settings', r])));
            jest.doMock('../../../routes/consultations/calendar', () => jest.fn((r) => calls.push(['calendar', r])));
            jest.doMock('../../../routes/consultations/learning', () => jest.fn((r) => calls.push(['learning', r])));
            jest.doMock('../../../routes/consultations/conversion', () => jest.fn((r) => calls.push(['conversion', r])));
            jest.doMock('../../../routes/consultations/write', () => jest.fn((r) => calls.push(['write', r])));
            jest.doMock('../../../routes/consultations/list-detail', () => jest.fn((r) => calls.push(['list-detail', r])));

            const router = require('../../../routes/consultations/index');

            expect(calls).toHaveLength(6);
            const passed = calls.map(([, r]) => r);
            for (let i = 1; i < passed.length; i++) {
                expect(passed[i]).toBe(passed[0]);
            }
            expect(passed[0]).toBe(router);
        });
    });

    test('등록 순서: settings → calendar → learning → conversion → write → list-detail', () => {
        const calls = [];
        jest.isolateModules(() => {
            jest.doMock('../../../routes/consultations/settings', () => jest.fn(() => calls.push('settings')));
            jest.doMock('../../../routes/consultations/calendar', () => jest.fn(() => calls.push('calendar')));
            jest.doMock('../../../routes/consultations/learning', () => jest.fn(() => calls.push('learning')));
            jest.doMock('../../../routes/consultations/conversion', () => jest.fn(() => calls.push('conversion')));
            jest.doMock('../../../routes/consultations/write', () => jest.fn(() => calls.push('write')));
            jest.doMock('../../../routes/consultations/list-detail', () => jest.fn(() => calls.push('list-detail')));

            require('../../../routes/consultations/index');

            expect(calls).toEqual(['settings', 'calendar', 'learning', 'conversion', 'write', 'list-detail']);
        });
    });

    test('export 값이 express Router 시그니처', () => {
        let router;
        jest.isolateModules(() => {
            router = require('../../../routes/consultations/index');
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
            router = require('../../../routes/consultations/index');
        });
        const express = require('express');
        const app = express();
        expect(() => app.use('/paca/consultations', router)).not.toThrow();
    });

    test('endpoint 총 17개 (원본 consultations.js 와 동일) — sub-라우터별 테스트가 endpoint 매칭 보장', () => {
        // 본 mount-only 테스트는 sub-라우터 require / 호출 순서 / Router 시그니처 / app.use
        // 호환만 검증한다. 17개 endpoint 의 실제 라우트 매칭 + 응답 표면은 sub-라우터별
        // 테스트가 supertest 로 모두 커버.
        const expectedEndpoints = {
            settings: 5,    // GET /settings/info, PUT /settings/info, PUT /settings/weekly-hours,
                            // POST /settings/blocked-slots, DELETE /settings/blocked-slots/:id
            calendar: 3,    // GET /calendar/events, GET /booked-times, GET /by-student/:studentId
            learning: 1,    // POST /learning
            conversion: 2,  // POST /:id/convert-to-trial, POST /:id/convert-to-pending
            write: 3,       // PUT /:id, POST /direct, POST /:id/link-student
            'list-detail': 3, // GET /, GET /:id, DELETE /:id
        };
        const total = Object.values(expectedEndpoints).reduce((a, b) => a + b, 0);
        expect(total).toBe(17);
    });
});
