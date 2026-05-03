/**
 * routes/toss/index.js 테스트 (Phase 3 #8, mount-only 진입점, ADR-017 자율 진행).
 *
 * 회귀 보호 범위 (lesson #186 / #200 / #205 패턴):
 *   - sub-라우터 4건 (plugin / callbacks / admin / settings) require 호출
 *   - 등록 순서 = 인증 강도/도메인 응집도 기준
 *       plugin (verifyTossPlugin) → callbacks (verifyCallbackSignature)
 *       → admin (verifyToken+checkPermission(payments)) → settings (verifyToken+checkPermission(settings))
 *   - 동일 router 인스턴스 전달
 *   - app.use 마운트 호환
 *   - 광역 미들웨어 (router.use) 추가 절대 금지 (ADR-014) — 실제 코드 라인만 검사
 *     plugin / callbacks 6 endpoint 의 의도적 verifyToken 미적용을 보호.
 *   - lesson #205 적용: 등록 순서 검증은 jest doMock 가 아닌 source 정적 검증 (require resolve + indexOf)
 *
 * endpoint 카운트 정적 검증 X — sub-라우터별 supertest suite 가 담당 (lesson #200).
 */

describe('routes/toss/index.js (mount-only 진입점, Phase 3 #8)', () => {
  let pluginMock;
  let callbacksMock;
  let adminMock;
  let settingsMock;
  let mountModule;

  beforeEach(() => {
    jest.isolateModules(() => {
      pluginMock = jest.fn();
      callbacksMock = jest.fn();
      adminMock = jest.fn();
      settingsMock = jest.fn();

      jest.doMock('../../../routes/toss/plugin', () => pluginMock);
      jest.doMock('../../../routes/toss/callbacks', () => callbacksMock);
      jest.doMock('../../../routes/toss/admin', () => adminMock);
      jest.doMock('../../../routes/toss/settings', () => settingsMock);

      // _utils 의 모듈 로드 시 logger.warn 회피용 mock
      jest.doMock('../../../config/database', () => ({
        execute: jest.fn(),
        query: jest.fn(),
        getConnection: jest.fn(),
      }));
      jest.doMock('../../../utils/encryption', () => ({
        encrypt: jest.fn((v) => v),
        decrypt: jest.fn((v) => v),
      }));
      jest.doMock('../../../utils/logger', () => ({
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
      }));

      mountModule = require('../../../routes/toss/index');
    });
  });

  test('module.exports = express.Router 인스턴스', () => {
    expect(mountModule).toBeDefined();
    expect(typeof mountModule).toBe('function');
    expect(typeof mountModule.use).toBe('function');
    expect(typeof mountModule.get).toBe('function');
  });

  test('sub-라우터 4건 모두 호출 + 동일 router 인스턴스 전달', () => {
    expect(pluginMock).toHaveBeenCalledTimes(1);
    expect(callbacksMock).toHaveBeenCalledTimes(1);
    expect(adminMock).toHaveBeenCalledTimes(1);
    expect(settingsMock).toHaveBeenCalledTimes(1);
    const calls = [pluginMock, callbacksMock, adminMock, settingsMock]
      .map(m => m.mock.calls[0][0]);
    calls.forEach(c => expect(c).toBe(mountModule));
  });

  test('등록 순서: plugin → callbacks → admin → settings (lesson #205 source 정적 검증)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../routes/toss/index'), 'utf-8');
    const names = ['plugin', 'callbacks', 'admin', 'settings'];
    const order = names
      .map(n => ({ n, idx: src.indexOf("require('./" + n + "')") }))
      .filter(x => x.idx >= 0)
      .sort((a, b) => a.idx - b.idx)
      .map(x => x.n);
    expect(order).toEqual(['plugin', 'callbacks', 'admin', 'settings']);
  });

  test('app.use 마운트 호환', () => {
    const express = require('express');
    const app = express();
    expect(() => app.use('/paca/toss', mountModule)).not.toThrow();
  });

  test('광역 미들웨어 (router.use) 0건 — JSDoc 제외 실제 코드 라인만 (ADR-014)', () => {
    const fs = require('fs');
    const src = fs.readFileSync(require.resolve('../../../routes/toss/index'), 'utf-8');
    // JSDoc 블록 / 라인 코멘트 라인 제거 후 검사
    const codeLines = src.split('\n').filter(line => {
      const trimmed = line.trim();
      return !trimmed.startsWith('*') && !trimmed.startsWith('/*') && !trimmed.startsWith('//');
    });
    const codeOnly = codeLines.join('\n');
    expect(codeOnly.includes('router.use(')).toBe(false);
    expect(codeOnly.includes('router.use (')).toBe(false);
  });
});
