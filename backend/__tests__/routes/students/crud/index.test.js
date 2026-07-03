/**
 * routes/students/crud/index.js 테스트 (Phase 3 #4, mount-only 진입점).
 *
 * 회귀 보호 범위 (lesson #186 / #200 패턴):
 *   - sub-라우터 7건 (list / detail / import / create / update / remove / search) require 호출
 *   - 등록 순서 = 원본 students/crud.js 와 동일 (변경 시 즉시 fail)
 *   - 동일 router 인스턴스 전달 (각 sub-라우터에 동일 ref 위임)
 *   - 함수 (router) => void 시그니처 (mount-only) — 인자 router 호출 시 throw 무발생
 *   - app.use 마운트 호환 — express Router 로 wrap 후 mount 시 예외 무발생
 *   - ⛔ 광역 미들웨어 (router.use) 추가 절대 금지 (ADR-014) — sub-라우터 외에 router.use 호출 0건
 *
 * ⚠️ endpoint 카운트 정적 검증 X — sub-라우터별 supertest suite 가 담당 (lesson #200).
 */

describe('routes/students/crud/index.js (mount-only 진입점, Phase 3 #4)', () => {
  let mountFn;
  let listMock;
  let detailMock;
  let importMock;
  let createMock;
  let updateMock;
  let removeMock;
  let searchMock;

  beforeEach(() => {
    jest.isolateModules(() => {
      listMock = jest.fn();
      detailMock = jest.fn();
      importMock = jest.fn();
      createMock = jest.fn();
      updateMock = jest.fn();
      removeMock = jest.fn();
      searchMock = jest.fn();

      jest.doMock('../../../../routes/students/crud/list', () => listMock);
      jest.doMock('../../../../routes/students/crud/detail', () => detailMock);
      jest.doMock('../../../../routes/students/crud/import', () => importMock);
      jest.doMock('../../../../routes/students/crud/create', () => createMock);
      jest.doMock('../../../../routes/students/crud/update', () => updateMock);
      jest.doMock('../../../../routes/students/crud/remove', () => removeMock);
      jest.doMock('../../../../routes/students/crud/search', () => searchMock);

      mountFn = require('../../../../routes/students/crud/index');
    });
  });

  test('module.exports = function(router) — mount-only 시그니처', () => {
    expect(typeof mountFn).toBe('function');
    expect(mountFn.length).toBe(1); // 1개 인자 (router)
  });

  test('sub-라우터 7건 모두 호출 + 동일 router 인스턴스 전달', () => {
    const router = { __id: 'fake-router' };
    mountFn(router);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledWith(router);
    expect(detailMock).toHaveBeenCalledTimes(1);
    expect(detailMock).toHaveBeenCalledWith(router);
    expect(importMock).toHaveBeenCalledTimes(1);
    expect(importMock).toHaveBeenCalledWith(router);
    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(router);
    expect(updateMock).toHaveBeenCalledTimes(1);
    expect(updateMock).toHaveBeenCalledWith(router);
    expect(removeMock).toHaveBeenCalledTimes(1);
    expect(removeMock).toHaveBeenCalledWith(router);
    expect(searchMock).toHaveBeenCalledTimes(1);
    expect(searchMock).toHaveBeenCalledWith(router);
  });

  test('등록 순서: list → detail → import → create → update → remove → search', () => {
    // 정적 source 검증 — isolateModules + doMock 가 mountFn 내부 require 시점에 적용 안 되는
    // jest 한계 (lesson #205) 회피. require('./<name>') 의 등장 순서로 등록 순서 검증.
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../../routes/students/crud/index'), 'utf-8');
    const names = ['list', 'detail', 'import', 'create', 'update', 'remove', 'search'];
    const order = names
      .map(n => ({ n, idx: src.indexOf(`require('./${n}')`) }))
      .filter(x => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map(x => x.n);
    expect(order).toEqual(['list', 'detail', 'import', 'create', 'update', 'remove', 'search']);
  });

  test('app.use 마운트 호환 — express Router wrap 시 예외 무발생', () => {
    const express = require('express');
    const app = express();
    const router = express.Router();
    expect(() => mountFn(router)).not.toThrow();
    expect(() => app.use('/paca/students', router)).not.toThrow();
  });

  test('⛔ 광역 미들웨어 (router.use) 추가 금지 — sub-라우터 외 호출 0건 (ADR-014)', () => {
    const useSpy = jest.fn();
    const router = { use: useSpy };
    mountFn(router);
    // sub-라우터들은 mock 이라 router.use 호출 X. 본 모듈이 router.use 를 직접 호출하면 fail.
    expect(useSpy).not.toHaveBeenCalled();
  });
});
