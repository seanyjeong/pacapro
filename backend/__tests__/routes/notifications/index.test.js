/**
 * routes/notifications/index.js 테스트 (Phase 1 — Tier 1 #2)
 *
 * 목적:
 *   - mount-only 진입점이 sub-라우터 4개를 모두 등록한다는 회귀 보장.
 *   - express Router 인스턴스 export 시그니처 보존 (paca.js 가 app.use(prefix, router) 로 사용).
 *
 * 회귀 보호 범위:
 *   - 4개 sub-라우터 (settings / logs / test / send) 모두 require 호출.
 *   - 각 sub-라우터에 router 객체가 인자로 넘어감 (`module.exports = function(router) {...}` 패턴).
 *   - 등록 순서: settings → logs → test → send (조회 → 테스트 → 실제 발송).
 *   - 최종 export 는 express Router 인스턴스 (use / get / post 등 미들웨어 함수 보유).
 *
 * 보안 영역 주의 (ADR-007):
 *   - index.js 에 router 레벨 미들웨어 (verifyToken 등) 추가 금지.
 *     send.js 의 webhook/cron 용 공개 endpoint (`/send-*-auto-sens` 4건) 가 깨짐.
 */

// --- mock: 4개 sub-라우터를 jest.fn 으로 교체 → require/호출 추적 ---
jest.mock('../../../routes/notifications/settings', () => jest.fn());
jest.mock('../../../routes/notifications/logs', () => jest.fn());
jest.mock('../../../routes/notifications/test', () => jest.fn());
jest.mock('../../../routes/notifications/send', () => jest.fn());

const settingsRouter = require('../../../routes/notifications/settings');
const logsRouter = require('../../../routes/notifications/logs');
const testRouter = require('../../../routes/notifications/test');
const sendRouter = require('../../../routes/notifications/send');

beforeEach(() => {
  jest.resetModules();
  settingsRouter.mockClear();
  logsRouter.mockClear();
  testRouter.mockClear();
  sendRouter.mockClear();
});

describe('routes/notifications/index.js — mount-only 진입점', () => {
  test('require 시 sub-라우터 4개가 모두 호출된다 (settings/logs/test/send)', () => {
    // jest.resetModules + 재 require 로 4개 sub-라우터 호출을 새로 트래킹
    jest.isolateModules(() => {
      jest.doMock('../../../routes/notifications/settings', () => settingsRouter);
      jest.doMock('../../../routes/notifications/logs', () => logsRouter);
      jest.doMock('../../../routes/notifications/test', () => testRouter);
      jest.doMock('../../../routes/notifications/send', () => sendRouter);
      require('../../../routes/notifications/index');
    });

    expect(settingsRouter).toHaveBeenCalledTimes(1);
    expect(logsRouter).toHaveBeenCalledTimes(1);
    expect(testRouter).toHaveBeenCalledTimes(1);
    expect(sendRouter).toHaveBeenCalledTimes(1);
  });

  test('각 sub-라우터에 동일한 express Router 인스턴스가 인자로 넘어간다', () => {
    jest.isolateModules(() => {
      jest.doMock('../../../routes/notifications/settings', () => settingsRouter);
      jest.doMock('../../../routes/notifications/logs', () => logsRouter);
      jest.doMock('../../../routes/notifications/test', () => testRouter);
      jest.doMock('../../../routes/notifications/send', () => sendRouter);
      require('../../../routes/notifications/index');
    });

    const passedToSettings = settingsRouter.mock.calls[0][0];
    const passedToLogs = logsRouter.mock.calls[0][0];
    const passedToTest = testRouter.mock.calls[0][0];
    const passedToSend = sendRouter.mock.calls[0][0];

    // 4개 모두 동일 router 인스턴스
    expect(passedToSettings).toBe(passedToLogs);
    expect(passedToLogs).toBe(passedToTest);
    expect(passedToTest).toBe(passedToSend);

    // express Router 시그니처 (use / get / post / put / delete 함수 보유)
    expect(typeof passedToSettings.use).toBe('function');
    expect(typeof passedToSettings.get).toBe('function');
    expect(typeof passedToSettings.post).toBe('function');
    expect(typeof passedToSettings.put).toBe('function');
    expect(typeof passedToSettings.delete).toBe('function');
  });

  test('등록 순서가 settings → logs → test → send 로 유지된다', () => {
    const callOrder = [];
    const recorder = (name) => jest.fn(() => callOrder.push(name));

    const orderedSettings = recorder('settings');
    const orderedLogs = recorder('logs');
    const orderedTest = recorder('test');
    const orderedSend = recorder('send');

    jest.isolateModules(() => {
      jest.doMock('../../../routes/notifications/settings', () => orderedSettings);
      jest.doMock('../../../routes/notifications/logs', () => orderedLogs);
      jest.doMock('../../../routes/notifications/test', () => orderedTest);
      jest.doMock('../../../routes/notifications/send', () => orderedSend);
      require('../../../routes/notifications/index');
    });

    expect(callOrder).toEqual(['settings', 'logs', 'test', 'send']);
  });

  test('module.exports 가 express Router 인스턴스 (paca.js 가 app.use 가능한 미들웨어 함수)', () => {
    let exported;
    jest.isolateModules(() => {
      jest.doMock('../../../routes/notifications/settings', () => jest.fn());
      jest.doMock('../../../routes/notifications/logs', () => jest.fn());
      jest.doMock('../../../routes/notifications/test', () => jest.fn());
      jest.doMock('../../../routes/notifications/send', () => jest.fn());
      exported = require('../../../routes/notifications/index');
    });

    // express Router 는 (req, res, next) 미들웨어 함수
    expect(typeof exported).toBe('function');
    // express Router 메서드 보유
    expect(typeof exported.use).toBe('function');
    expect(typeof exported.get).toBe('function');
    expect(typeof exported.post).toBe('function');
    // express Router 내부 stack 보유
    expect(Array.isArray(exported.stack)).toBe(true);
  });

  test('paca.js 호환: app.use(prefix, router) 패턴으로 마운트 가능', () => {
    let exported;
    jest.isolateModules(() => {
      // 진짜 sub-라우터를 호출하면 _utils.js → DB 연결 시도하므로 noop 으로 모킹
      jest.doMock('../../../routes/notifications/settings', () => jest.fn());
      jest.doMock('../../../routes/notifications/logs', () => jest.fn());
      jest.doMock('../../../routes/notifications/test', () => jest.fn());
      jest.doMock('../../../routes/notifications/send', () => jest.fn());
      exported = require('../../../routes/notifications/index');
    });

    const express = require('express');
    const app = express();

    // throw 없이 마운트되면 통과 (paca.js 와 동일 패턴)
    expect(() => app.use('/paca/notifications', exported)).not.toThrow();
  });
});
