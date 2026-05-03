/**
 * routes/payments/index.js 테스트 (Phase 3 #6, mount-only 진입점, ADR-017 자율 진행).
 *
 * 회귀 보호 범위 (lesson #186 / #200 / #205 패턴):
 *   - sub-라우터 7건 (bulk / prepaid / credits / stats / list / pay / crud) require 호출
 *   - 등록 순서 = 정적 → /:id 와일드카드 (express 라우트 매칭 의존)
 *       bulk → prepaid → credits → stats → list → pay → crud
 *     credits / stats/summary / unpaid / unpaid-today 가 crud (/:id) 보다 먼저여야 함.
 *   - 동일 router 인스턴스 전달
 *   - app.use 마운트 호환
 *   - 광역 미들웨어 (router.use) 추가 절대 금지 (ADR-014) — source 정적 검사
 *   - lesson #205 적용: 등록 순서 검증 = source 정적 검증 (require resolve + indexOf)
 *
 * endpoint 카운트 정적 검증 X — sub-라우터별 supertest suite 가 담당 (lesson #200).
 */

describe('routes/payments/index.js (mount-only 진입점, Phase 3 #6)', () => {
    let bulkMock, prepaidMock, creditsMock, statsMock, listMock, payMock, crudMock;
    let mountModule;

    beforeEach(() => {
        jest.isolateModules(() => {
            bulkMock = jest.fn();
            prepaidMock = jest.fn();
            creditsMock = jest.fn();
            statsMock = jest.fn();
            listMock = jest.fn();
            payMock = jest.fn();
            crudMock = jest.fn();

            jest.doMock('../../../routes/payments/bulk', () => bulkMock);
            jest.doMock('../../../routes/payments/prepaid', () => prepaidMock);
            jest.doMock('../../../routes/payments/credits', () => creditsMock);
            jest.doMock('../../../routes/payments/stats', () => statsMock);
            jest.doMock('../../../routes/payments/list', () => listMock);
            jest.doMock('../../../routes/payments/pay', () => payMock);
            jest.doMock('../../../routes/payments/crud', () => crudMock);

            // _utils 모듈 로드 시 logger 등 회피
            jest.doMock('../../../config/database', () => ({
                execute: jest.fn(),
                query: jest.fn(),
                getConnection: jest.fn(),
            }));
            jest.doMock('../../../utils/encryption', () => ({
                decrypt: jest.fn((v) => v),
            }));
            jest.doMock('../../../utils/logger', () => ({
                info: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            }));

            mountModule = require('../../../routes/payments');
        });
    });

    test('sub-라우터 7건 모두 호출됨 + 동일 router 인스턴스 전달', () => {
        expect(bulkMock).toHaveBeenCalledTimes(1);
        expect(prepaidMock).toHaveBeenCalledTimes(1);
        expect(creditsMock).toHaveBeenCalledTimes(1);
        expect(statsMock).toHaveBeenCalledTimes(1);
        expect(listMock).toHaveBeenCalledTimes(1);
        expect(payMock).toHaveBeenCalledTimes(1);
        expect(crudMock).toHaveBeenCalledTimes(1);

        // 동일 router 인스턴스
        const router = bulkMock.mock.calls[0][0];
        expect(prepaidMock.mock.calls[0][0]).toBe(router);
        expect(creditsMock.mock.calls[0][0]).toBe(router);
        expect(statsMock.mock.calls[0][0]).toBe(router);
        expect(listMock.mock.calls[0][0]).toBe(router);
        expect(payMock.mock.calls[0][0]).toBe(router);
        expect(crudMock.mock.calls[0][0]).toBe(router);
    });

    test('module.exports 가 express Router 시그니처 (use / get / post)', () => {
        expect(typeof mountModule.use).toBe('function');
        expect(typeof mountModule.get).toBe('function');
        expect(typeof mountModule.post).toBe('function');
        expect(typeof mountModule.put).toBe('function');
        expect(typeof mountModule.delete).toBe('function');
    });

    test('app.use("/paca/payments", router) 마운트 시 예외 없음', () => {
        const express = require('express');
        const app = express();
        expect(() => app.use('/paca/payments', mountModule)).not.toThrow();
    });

    test('lesson #205: 등록 순서 = source 정적 검증 (정적 → 와일드카드)', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.resolve(__dirname, '../../../routes/payments/index.js'),
            'utf8'
        );

        // JSDoc/주석 라인 제외, 실제 require('./X') 라인만 추출 후 indexOf 비교
        const lines = src.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('*') && !l.startsWith('/*') && !l.startsWith('//'));
        const joined = lines.join('\n');

        const idxBulk = joined.indexOf("require('./bulk')");
        const idxPrepaid = joined.indexOf("require('./prepaid')");
        const idxCredits = joined.indexOf("require('./credits')");
        const idxStats = joined.indexOf("require('./stats')");
        const idxList = joined.indexOf("require('./list')");
        const idxPay = joined.indexOf("require('./pay')");
        const idxCrud = joined.indexOf("require('./crud')");

        // 모두 존재
        expect(idxBulk).toBeGreaterThan(-1);
        expect(idxPrepaid).toBeGreaterThan(-1);
        expect(idxCredits).toBeGreaterThan(-1);
        expect(idxStats).toBeGreaterThan(-1);
        expect(idxList).toBeGreaterThan(-1);
        expect(idxPay).toBeGreaterThan(-1);
        expect(idxCrud).toBeGreaterThan(-1);

        // 등록 순서: bulk → prepaid → credits → stats → list → pay → crud
        expect(idxBulk).toBeLessThan(idxPrepaid);
        expect(idxPrepaid).toBeLessThan(idxCredits);
        expect(idxCredits).toBeLessThan(idxStats);
        expect(idxStats).toBeLessThan(idxList);
        expect(idxList).toBeLessThan(idxPay);
        expect(idxPay).toBeLessThan(idxCrud);

        // 핵심: credits / stats / list 가 crud 보다 먼저
        // (credits / stats/summary / unpaid / unpaid-today 가 GET /:id 매칭으로 빠지면 안됨)
        expect(idxCredits).toBeLessThan(idxCrud);
        expect(idxStats).toBeLessThan(idxCrud);
        expect(idxList).toBeLessThan(idxCrud);
    });

    test('ADR-014: router.use(...) 광역 미들웨어 추가 0건 (source 정적 검사)', () => {
        const fs = require('fs');
        const path = require('path');
        const src = fs.readFileSync(
            path.resolve(__dirname, '../../../routes/payments/index.js'),
            'utf8'
        );

        // 코드 라인만 추출 (JSDoc/주석 제외)
        const codeLines = src.split('\n')
            .map(l => l.trim())
            .filter(l => l && !l.startsWith('*') && !l.startsWith('/*') && !l.startsWith('//'));

        // router.use( 호출 0건 (광역 미들웨어 금지)
        const useLines = codeLines.filter(l => /\brouter\.use\(/.test(l));
        expect(useLines).toEqual([]);
    });
});
