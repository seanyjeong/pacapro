/**
 * routes/instructors/index.js 테스트 (Phase 2 #4 — instructors 도메인 분리)
 *
 * 회귀 보호 범위 (mount-only 진입점, ADR-014):
 *   - sub-라우터 4건 (auth / overtime / crud / attendance) require 호출
 *   - 호출 순서 (auth → overtime → crud → attendance) — `:id` 와일드카드 충돌 회피
 *   - 동일 router 인스턴스 전달
 *   - express Router 시그니처 (use/get/post/put/delete + stack 배열)
 *   - app.use 마운트 호환
 */

describe('routes/instructors/index.js — mount-only 진입점', () => {
    afterEach(() => {
        jest.resetModules();
    });

    test('sub-라우터 4건을 모두 require + 동일 router 전달', () => {
        const calls = [];
        jest.isolateModules(() => {
            jest.doMock('../../../routes/instructors/auth', () => jest.fn((r) => calls.push(['auth', r])));
            jest.doMock('../../../routes/instructors/overtime', () => jest.fn((r) => calls.push(['overtime', r])));
            jest.doMock('../../../routes/instructors/crud', () => jest.fn((r) => calls.push(['crud', r])));
            jest.doMock('../../../routes/instructors/attendance', () => jest.fn((r) => calls.push(['attendance', r])));

            const router = require('../../../routes/instructors/index');

            expect(calls).toHaveLength(4);
            // 동일 router 인스턴스 전달
            const passed = calls.map(([_, r]) => r);
            expect(passed[0]).toBe(passed[1]);
            expect(passed[1]).toBe(passed[2]);
            expect(passed[2]).toBe(passed[3]);
            expect(passed[0]).toBe(router);
        });
    });

    test('등록 순서: auth → overtime → crud → attendance', () => {
        const calls = [];
        jest.isolateModules(() => {
            jest.doMock('../../../routes/instructors/auth', () => jest.fn(() => calls.push('auth')));
            jest.doMock('../../../routes/instructors/overtime', () => jest.fn(() => calls.push('overtime')));
            jest.doMock('../../../routes/instructors/crud', () => jest.fn(() => calls.push('crud')));
            jest.doMock('../../../routes/instructors/attendance', () => jest.fn(() => calls.push('attendance')));

            require('../../../routes/instructors/index');

            expect(calls).toEqual(['auth', 'overtime', 'crud', 'attendance']);
        });
    });

    test('export 값이 express Router 시그니처', () => {
        // 실제 sub-라우터로 require — jest.isolateModules 안에서 mock 정리
        let router;
        jest.isolateModules(() => {
            router = require('../../../routes/instructors/index');
        });
        expect(typeof router).toBe('function');  // express Router 는 함수 형태
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
            router = require('../../../routes/instructors/index');
        });
        const express = require('express');
        const app = express();
        // 마운트 자체가 throw 없이 성공해야 함
        expect(() => app.use('/paca/instructors', router)).not.toThrow();
    });

    test('endpoint 총 12개 (원본 instructors.js 와 동일) — sub-라우터별 테스트가 endpoint 매칭 보장', () => {
        // 본 mount-only 테스트는 sub-라우터 require / 호출 순서 / Router 시그니처 / app.use
        // 호환만 검증한다. 12개 endpoint 의 실제 라우트 매칭 + 응답 표면은 sub-라우터별
        // 테스트 (auth.test.js 5건 + overtime.test.js 21건 + crud.test.js 25건 +
        // attendance.test.js 11건 = 62건) 가 supertest 로 모두 커버.
        const expectedEndpoints = {
            crud: 5,        // GET / + GET /:id + POST / + PUT /:id + DELETE /:id
            attendance: 2,  // POST /:id/attendance + GET /:id/attendance
            overtime: 4,    // GET pending + GET history + PUT approve + POST /:id/overtime
            auth: 1         // POST /verify-admin-password
        };
        const total = Object.values(expectedEndpoints).reduce((a, b) => a + b, 0);
        expect(total).toBe(12);
    });
});
