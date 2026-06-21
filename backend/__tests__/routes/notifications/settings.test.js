/**
 * routes/notifications/settings.js 테스트 (Phase 1 — Tier 1 #4, 마지막)
 *
 * 목적:
 *   - GET /paca/notifications/settings (조회 + Secret Key 마스킹 + 빈 결과 기본값)
 *   - PUT /paca/notifications/settings (저장: INSERT 신규 / UPDATE 기존 분기)
 *   두 endpoint 의 응답 표면 + DB 호출 패턴 (ADR-005) + 보안 헬퍼 호출 (ADR-007) 회귀 보장.
 *
 * 회귀 보호 범위 (ADR-013 보존):
 *   - GET 200 응답 키: { message, settings: {...} }
 *     (프론트 src/lib/api/notifications.ts getSettings 가 `response.settings` 직접 소비)
 *   - GET 200 빈 결과: settings 가 기본값 객체로 채워져 반환 (service_type='sens', is_enabled=false 등)
 *   - GET 200 마스킹: naver_secret_key / solapi_api_secret = 앞 4자리 + '****', has_*_secret=true 플래그
 *   - PUT 200 응답 키: { message, success: true }
 *   - 에러 응답 키: { error, message } (한국어 message)
 *
 * DB 호출 패턴 (ADR-005):
 *   - GET / PUT 모두 pool.execute(sql, params) 사용 (db.query 잔존 0건 검증).
 *
 * 보안 영역 (ADR-007):
 *   - encryptApiKey / decryptApiKey 시그니처 무변경 검증 (호출 인자 = (raw, ENCRYPTION_KEY)).
 *   - 마스킹 입력 (`****` 포함) 은 재암호화 X 검증 (encryptApiKey 호출되지 않음).
 *   - 새 입력은 암호화 1회 호출 검증.
 */

// --- mock: DB pool ---
jest.mock('../../../config/database', () => {
  const fakePool = {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
  };
  return fakePool;
});

// --- mock: 인증 미들웨어 (request 통과 + req.user 주입) ---
jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => {
    req.user = { academyId: 1, id: 100, role: 'admin' };
    next();
  }),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));

// --- mock: 보안 헬퍼 (실제 암호화/복호화 X) ---
jest.mock('../../../utils/naverSens', () => ({
  encryptApiKey: jest.fn((raw, key) => `enc:${raw}`),
  decryptApiKey: jest.fn((enc, key) => {
    if (!enc) return '';
    if (typeof enc === 'string' && enc.startsWith('enc:')) return enc.slice(4);
    return enc;
  }),
  sendAlimtalk: jest.fn(),
  createUnpaidNotificationMessage: jest.fn(),
  isValidPhoneNumber: jest.fn(),
}));

jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((v) => v),
}));

jest.mock('../../../utils/solapi', () => ({
  sendAlimtalkSolapi: jest.fn(),
  getBalanceSolapi: jest.fn(),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const express = require('express');
const request = require('supertest');
const pool = require('../../../config/database');
const naverSens = require('../../../utils/naverSens');
const registerSettingsRoutes = require('../../../routes/notifications/settings');

function buildApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerSettingsRoutes(router);
  app.use('/paca/notifications', router);
  return app;
}

beforeEach(() => {
  jest.clearAllMocks();
});

// ============================================================================
// GET /paca/notifications/settings
// ============================================================================
describe('GET /paca/notifications/settings', () => {
  test('빈 결과 시 기본값 객체 반환 (service_type=sens, is_enabled=false)', async () => {
    pool.execute.mockResolvedValueOnce([[]]); // 빈 배열

    const app = buildApp();
    const res = await request(app).get('/paca/notifications/settings');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('알림 설정이 없습니다.');
    expect(res.body.settings).toBeDefined();
    expect(res.body.settings.service_type).toBe('sens');
    expect(res.body.settings.is_enabled).toBe(false);
    expect(res.body.settings.solapi_enabled).toBe(false);
    expect(res.body.settings.sens_auto_enabled).toBe(false);
    expect(res.body.settings.sens_auto_hour).toBe(10);
    expect(Array.isArray(res.body.settings.sens_buttons)).toBe(true);
  });

  test('기존 설정 조회 시 Secret Key 마스킹 + has_secret 플래그', async () => {
    pool.execute.mockResolvedValueOnce([[{
      id: 1,
      academy_id: 1,
      service_type: 'solapi',
      naver_secret_key: 'enc:RAWSECRET12345',
      solapi_api_secret: 'enc:SOLAPI67890ABCD',
      solapi_buttons: null,
      solapi_consultation_buttons: null,
      solapi_trial_buttons: null,
      solapi_overdue_buttons: null,
      sens_buttons: null,
      sens_consultation_buttons: null,
      sens_trial_buttons: null,
      sens_overdue_buttons: null,
      solapi_reminder_buttons: null,
      sens_reminder_buttons: null,
    }]]);

    const app = buildApp();
    const res = await request(app).get('/paca/notifications/settings');

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('알림 설정 조회 성공');
    expect(res.body.settings.naver_secret_key).toBe('RAWS****');
    expect(res.body.settings.solapi_api_secret).toBe('SOLA****');
    expect(res.body.settings.has_secret_key).toBe(true);
    expect(res.body.settings.has_solapi_secret).toBe(true);
    // 빈 buttons 는 [] 로 정규화
    expect(res.body.settings.solapi_buttons).toEqual([]);
    expect(res.body.settings.sens_buttons).toEqual([]);
  });

  test('pool.execute 사용 (ADR-005, db.query 호출 0건)', async () => {
    pool.execute.mockResolvedValueOnce([[]]);

    const app = buildApp();
    await request(app).get('/paca/notifications/settings');

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
    // SQL + academyId 파라미터 검증
    const [sql, params] = pool.execute.mock.calls[0];
    expect(sql).toMatch(/SELECT \* FROM notification_settings WHERE academy_id = \?/);
    expect(params).toEqual([1]);
  });

  test('DB 에러 시 5xx + 한국어 message + error 키 보존 (ADR-013)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('DB connection lost'));

    const app = buildApp();
    const res = await request(app).get('/paca/notifications/settings');

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toBe('알림 설정 조회에 실패했습니다.');
  });
});

// ============================================================================
// PUT /paca/notifications/settings
// ============================================================================
describe('PUT /paca/notifications/settings', () => {
  test('신규 (existing 0개) → INSERT 분기 + 200 응답 표면', async () => {
    // 1번째 호출: existing 조회 → 빈 배열
    // 2번째 호출: INSERT
    pool.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 99 }]);

    const app = buildApp();
    const res = await request(app)
      .put('/paca/notifications/settings')
      .send({ service_type: 'sens', is_enabled: true });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('알림 설정이 저장되었습니다.');
    expect(res.body.success).toBe(true);
    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.execute.mock.calls[1][0]).toMatch(/INSERT INTO notification_settings/);
  });

  test('기존 (existing 1개) → UPDATE 분기 + 200 응답 표면', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 1, naver_secret_key: 'enc:OLD', solapi_api_secret: 'enc:OLDS' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const app = buildApp();
    const res = await request(app)
      .put('/paca/notifications/settings')
      .send({ service_type: 'solapi' });

    expect(res.status).toBe(200);
    expect(res.body.message).toBe('알림 설정이 저장되었습니다.');
    expect(res.body.success).toBe(true);
    expect(pool.execute.mock.calls[1][0]).toMatch(/UPDATE notification_settings SET/);
    // UPDATE 파라미터 마지막 = academyId (WHERE academy_id = ?)
    const updateParams = pool.execute.mock.calls[1][1];
    expect(updateParams[updateParams.length - 1]).toBe(1);
  });

  test('Secret Key 새 입력 (마스킹 X) → encryptApiKey 호출 (ADR-007 시그니처 보존)', async () => {
    pool.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    const app = buildApp();
    await request(app)
      .put('/paca/notifications/settings')
      .send({
        naver_secret_key: 'BRANDNEW_SECRET',
        solapi_api_secret: 'BRANDNEW_SOLAPI',
      });

    // encryptApiKey 가 raw 값 + ENCRYPTION_KEY 두 인자로 정확히 2회 호출
    expect(naverSens.encryptApiKey).toHaveBeenCalledTimes(2);
    expect(naverSens.encryptApiKey.mock.calls[0][0]).toBe('BRANDNEW_SECRET');
    expect(naverSens.encryptApiKey.mock.calls[1][0]).toBe('BRANDNEW_SOLAPI');
    // 두 번째 인자는 _utils.js 의 ENCRYPTION_KEY 를 그대로 패스스루 (시그니처 보존, 값은 환경변수 의존)
    expect(naverSens.encryptApiKey.mock.calls[0]).toHaveLength(2);
    expect(naverSens.encryptApiKey.mock.calls[1]).toHaveLength(2);
  });

  test('Secret Key 마스킹 입력 (****포함) → 재암호화 안 함 (기존 값 유지)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ id: 1, naver_secret_key: 'enc:OLD', solapi_api_secret: 'enc:OLDS' }]])
      .mockResolvedValueOnce([{ affectedRows: 1 }]);

    const app = buildApp();
    await request(app)
      .put('/paca/notifications/settings')
      .send({
        naver_secret_key: 'RAWS****',     // 마스킹된 값 → 재암호화 X
        solapi_api_secret: 'SOLA****',    // 마스킹된 값 → 재암호화 X
      });

    expect(naverSens.encryptApiKey).not.toHaveBeenCalled();
    // UPDATE params 첫 부분 (service_type 다음 위치) 에 기존 암호값 그대로
    const updateParams = pool.execute.mock.calls[1][1];
    // service_type, naver_access_key, naver_secret_key 순서
    expect(updateParams[2]).toBe('enc:OLD');
  });

  test('pool.execute 사용 (ADR-005, db.query 호출 0건)', async () => {
    pool.execute
      .mockResolvedValueOnce([[]])
      .mockResolvedValueOnce([{ insertId: 1 }]);

    const app = buildApp();
    await request(app).put('/paca/notifications/settings').send({});

    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('DB 에러 시 5xx + 한국어 message + error 키 보존 (ADR-013)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('DB write failed'));

    const app = buildApp();
    const res = await request(app)
      .put('/paca/notifications/settings')
      .send({ service_type: 'sens' });

    expect(res.status).toBe(500);
    expect(res.body.error).toBe('Server Error');
    expect(res.body.message).toBe('알림 설정 저장에 실패했습니다.');
  });
});
