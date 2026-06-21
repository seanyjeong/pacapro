/**
 * exports/index.js — mount-only 진입점 회귀 테스트
 *
 * 검증 항목:
 * - sub-라우터 6건 require 호출 (revenue / expenses / financial / payments / salaries / students)
 * - 동일 router 인스턴스 전달
 * - express Router 시그니처 (use/get/post + stack 배열)
 * - app.use 마운트 호환성
 * - endpoint 6개 카운트
 */

const express = require('express');

describe('exports/index.js (mount-only 진입점)', () => {
    let revenueMock, expensesMock, financialMock, paymentsMock, salariesMock, studentsMock;
    let router;

    beforeEach(() => {
        jest.resetModules();

        revenueMock = jest.fn();
        expensesMock = jest.fn();
        financialMock = jest.fn();
        paymentsMock = jest.fn();
        salariesMock = jest.fn();
        studentsMock = jest.fn();

        jest.doMock('../../../routes/exports/revenue', () => revenueMock);
        jest.doMock('../../../routes/exports/expenses', () => expensesMock);
        jest.doMock('../../../routes/exports/financial', () => financialMock);
        jest.doMock('../../../routes/exports/payments', () => paymentsMock);
        jest.doMock('../../../routes/exports/salaries', () => salariesMock);
        jest.doMock('../../../routes/exports/students', () => studentsMock);

        router = require('../../../routes/exports');
    });

    test('sub-라우터 6건 require + 호출됨', () => {
        expect(revenueMock).toHaveBeenCalledTimes(1);
        expect(expensesMock).toHaveBeenCalledTimes(1);
        expect(financialMock).toHaveBeenCalledTimes(1);
        expect(paymentsMock).toHaveBeenCalledTimes(1);
        expect(salariesMock).toHaveBeenCalledTimes(1);
        expect(studentsMock).toHaveBeenCalledTimes(1);
    });

    test('동일 router 인스턴스를 모든 sub-라우터에 전달', () => {
        const r1 = revenueMock.mock.calls[0][0];
        const r2 = expensesMock.mock.calls[0][0];
        const r3 = financialMock.mock.calls[0][0];
        const r4 = paymentsMock.mock.calls[0][0];
        const r5 = salariesMock.mock.calls[0][0];
        const r6 = studentsMock.mock.calls[0][0];
        expect(r1).toBe(r2);
        expect(r1).toBe(r3);
        expect(r1).toBe(r4);
        expect(r1).toBe(r5);
        expect(r1).toBe(r6);
    });

    test('express Router 시그니처 (use/get/post 함수 + stack 배열)', () => {
        expect(typeof router.use).toBe('function');
        expect(typeof router.get).toBe('function');
        expect(typeof router.post).toBe('function');
        expect(Array.isArray(router.stack)).toBe(true);
    });

    test('app.use 로 마운트 가능 (Router 인스턴스 호환)', () => {
        const app = express();
        expect(() => app.use('/paca/exports', router)).not.toThrow();
    });

    test('endpoint 카운트 = 6 (sub-라우터별 정의)', () => {
        // mount-only 진입점은 라우트 정의 X. sub-라우터 mock 6건 확인으로 카운트 보장.
        expect(
            revenueMock.mock.calls.length +
            expensesMock.mock.calls.length +
            financialMock.mock.calls.length +
            paymentsMock.mock.calls.length +
            salariesMock.mock.calls.length +
            studentsMock.mock.calls.length
        ).toBe(6);
    });
});
