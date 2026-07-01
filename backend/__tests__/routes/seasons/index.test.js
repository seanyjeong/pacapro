/**
 * routes/seasons/index.js 테스트 (Phase 3 #5, mount-only 진입점, ADR-017 자율 진행).
 *
 * 회귀 보호 범위 (lesson #186 / #200 / #205 패턴):
 *   - sub-라우터 6건 (enrollments / list / crud / enroll / preview / students) require 호출
 *   - 등록 순서 = 정적 경로 우선, /:id 와일드카드 마지막 (express 매칭 순서 의존)
 *   - 동일 router 인스턴스 전달
 *   - app.use 마운트 호환
 *   - 광역 미들웨어 (router.use) 추가 절대 금지 (ADR-014) — 실제 코드 라인만 검사
 *   - lesson #205 적용: 등록 순서 검증은 jest doMock 가 아닌 source 정적 검증 (require resolve + indexOf)
 *
 * endpoint 카운트 정적 검증 X — sub-라우터별 supertest suite 가 담당 (lesson #200).
 */

describe('routes/seasons/index.js (mount-only 진입점, Phase 3 #5)', () => {
  let enrollmentsMock;
  let listMock;
  let crudMock;
  let enrollMock;
  let previewMock;
  let studentsMock;
  let mountModule;

  beforeEach(() => {
    jest.isolateModules(() => {
      enrollmentsMock = jest.fn();
      listMock = jest.fn();
      crudMock = jest.fn();
      enrollMock = jest.fn();
      previewMock = jest.fn();
      studentsMock = jest.fn();

      jest.doMock('../../../routes/seasons/enrollments', () => enrollmentsMock);
      jest.doMock('../../../routes/seasons/list', () => listMock);
      jest.doMock('../../../routes/seasons/crud', () => crudMock);
      jest.doMock('../../../routes/seasons/enroll', () => enrollMock);
      jest.doMock('../../../routes/seasons/preview', () => previewMock);
      jest.doMock('../../../routes/seasons/students', () => studentsMock);

      mountModule = require('../../../routes/seasons/index');
    });
  });

  test('module.exports = express.Router 인스턴스', () => {
    expect(mountModule).toBeDefined();
    expect(typeof mountModule).toBe('function');
    expect(typeof mountModule.use).toBe('function');
    expect(typeof mountModule.get).toBe('function');
  });

  test('sub-라우터 6건 모두 호출 + 동일 router 인스턴스 전달', () => {
    expect(enrollmentsMock).toHaveBeenCalledTimes(1);
    expect(listMock).toHaveBeenCalledTimes(1);
    expect(crudMock).toHaveBeenCalledTimes(1);
    expect(enrollMock).toHaveBeenCalledTimes(1);
    expect(previewMock).toHaveBeenCalledTimes(1);
    expect(studentsMock).toHaveBeenCalledTimes(1);
    const calls = [enrollmentsMock, listMock, crudMock, enrollMock, previewMock, studentsMock]
      .map(m => m.mock.calls[0][0]);
    calls.forEach(c => expect(c).toBe(mountModule));
  });

  test('등록 순서: enrollments → list → crud → enroll → preview → students (lesson #205 source 정적 검증)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../routes/seasons/index'), 'utf-8');
    const names = ['enrollments', 'list', 'crud', 'enroll', 'preview', 'students'];
    const order = names
      .map(n => ({ n, idx: src.indexOf("require('./" + n + "')") }))
      .filter(x => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map(x => x.n);
    expect(order).toEqual(['enrollments', 'list', 'crud', 'enroll', 'preview', 'students']);
  });

  test('app.use 마운트 호환', () => {
    const express = require('express');
    const app = express();
    expect(() => app.use('/paca/seasons', mountModule)).not.toThrow();
  });

  test('광역 미들웨어 (router.use) 0건 — JSDoc 제외 실제 코드 라인만 (ADR-014)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../routes/seasons/index'), 'utf-8');
    // JSDoc 블록 / 라인 코멘트 라인 제거 후 검사
    const codeLines = src.split('\n').filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('/*') && !trimmed.startsWith('//');
    });
    const codeOnly = codeLines.join('\n');
    // includes 로 단순 검사 — RegExp escaping 회피
    expect(codeOnly.includes('router.use(')).toBe(false);
    expect(codeOnly.includes('router.use (')).toBe(false);
  });
});
