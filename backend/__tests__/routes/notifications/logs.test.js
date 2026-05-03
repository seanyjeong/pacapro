/**
 * routes/notifications/logs.js 테스트 (Phase 1 — Tier 1 #3)
 *
 * 목적:
 *   - GET /paca/notifications/logs (페이징, 필터: status/message_type/start_date/end_date)
 *   - GET /paca/notifications/stats (year/month 필터)
 *   두 read-only endpoint 의 응답 표면 회귀 보장.
 *
 * 회귀 보호 범위 (프론트 src/lib/api/notifications.ts 의 LogsResponse / StatsResponse):
 *   - 응답 키: { message, logs, pagination: { total, page, limit, totalPages } }
 *   - 응답 키: { message, stats }
 *   - 에러 응답 키: { error, message } (한국어 message)
 *
 * DB 호출 패턴 (ADR-005):
 *   - logs.js 내부에서 pool.execute(sql, params) 사용을 검증.
 *   - 단, _utils.js 가 db === pool 동일 인스턴스로 export 하므로
 *     mock 단에서는 pool.execute / pool.query 둘 다 트래킹.
 *
 * 보안 영역 주의:
 *   - 이 라우터는 read-only, 학생 정보 복호화 없음, 발송 채널 호출 없음.
 *   - auth/암호화 헬퍼는 모킹.
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

// --- mock: 발송 채널 / 보안 헬퍼 / 로거 (이 라우터는 사용 안 하지만 _utils.js가 require) ---
jest.mock('../../../utils/naverSens', () => ({
  encryptApiKey: jest.fn(),
  decryptApiKey: jest.fn(),
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
const registerLogsRoutes = require('../../../routes/notifications/logs');

/**
 * supertest 용 mini-app: notifications 도메인 prefix 없이
 * router 에 logs.js 라우트만 마운트.
 */
function buildApp() {
  const app = express();
  app.use(express.json());
  const router = express.Router();
  registerLogsRoutes(router);
  app.use('/paca/notifications', router);
  return app;
}

beforeEach(() => {
  pool.execute.mockReset();
  pool.query.mockReset();
});

describe('GET /paca/notifications/logs', () => {
  test('성공: 응답이 { message, logs, pagination } 표면을 유지한다 (프론트 LogsResponse 회귀)', async () => {
    pool.execute
      // count 쿼리
      .mockResolvedValueOnce([[{ total: 42 }]])
      // logs 쿼리
      .mockResolvedValueOnce([[
        { id: 1, status: 'sent', message_type: 'alimtalk', created_at: '2026-04-30T00:00:00.000Z' },
        { id: 2, status: 'failed', message_type: 'sms', created_at: '2026-04-29T00:00:00.000Z' },
      ]]);

    const app = buildApp();
    const res = await request(app)
      .get('/paca/notifications/logs')
      .query({ page: 2, limit: 10 });

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(typeof res.body.message).toBe('string');
    expect(Array.isArray(res.body.logs)).toBe(true);
    expect(res.body.logs).toHaveLength(2);
    expect(res.body.pagination).toEqual({
      total: 42,
      page: 2,
      limit: 10,
      totalPages: Math.ceil(42 / 10),
    });
  });

  test('필터(status / message_type / start_date / end_date) 가 SQL params 에 반영된다', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const app = buildApp();
    await request(app)
      .get('/paca/notifications/logs')
      .query({
        status: 'sent',
        message_type: 'alimtalk',
        start_date: '2026-04-01',
        end_date: '2026-04-30',
      });

    // count 쿼리 호출 확인
    expect(pool.execute).toHaveBeenCalledTimes(2);
    const [countSql, countParams] = pool.execute.mock.calls[0];
    expect(countSql).toMatch(/COUNT\(\*\)/);
    expect(countSql).toMatch(/WHERE academy_id = \?/);
    expect(countSql).toMatch(/AND status = \?/);
    expect(countSql).toMatch(/AND message_type = \?/);
    expect(countSql).toMatch(/AND created_at >= \?/);
    expect(countSql).toMatch(/AND created_at <= \?/);
    // 순서: academyId, status, message_type, start_date, end_date(+23:59:59)
    expect(countParams).toEqual([1, 'sent', 'alimtalk', '2026-04-01', '2026-04-30 23:59:59']);

    // logs 쿼리: count params + [limit, offset] 가 추가
    const [logsSql, logsParams] = pool.execute.mock.calls[1];
    expect(logsSql).toMatch(/SELECT \* FROM notification_logs/);
    expect(logsSql).toMatch(/ORDER BY created_at DESC/);
    expect(logsSql).toMatch(/LIMIT \? OFFSET \?/);
    expect(logsParams).toEqual([1, 'sent', 'alimtalk', '2026-04-01', '2026-04-30 23:59:59', 20, 0]);
  });

  test('기본값 page=1 limit=20 일 때 offset=0', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const app = buildApp();
    await request(app).get('/paca/notifications/logs');

    const [, logsParams] = pool.execute.mock.calls[1];
    // params: [academyId, limit=20, offset=0]
    expect(logsParams[logsParams.length - 2]).toBe(20);
    expect(logsParams[logsParams.length - 1]).toBe(0);
  });

  test('실패: DB 오류 시 500 + 한국어 친화 메시지 (코드 언어 노출 X)', async () => {
    pool.execute.mockRejectedValueOnce(new Error('ETIMEDOUT'));

    const app = buildApp();
    const res = await request(app).get('/paca/notifications/logs');

    expect(res.status).toBe(500);
    expect(res.body).toHaveProperty('message');
    // RULES ADR-003: 사용자 노출 메시지는 한국어 친화
    expect(res.body.message).toMatch(/발송 로그/);
    expect(res.body.message).toMatch(/실패|불러오/);
    // 영어 시스템 메시지가 사용자 message 에 그대로 노출되지 않았는지
    expect(res.body.message).not.toMatch(/Server Error|TypeError|ETIMEDOUT|Internal Server Error/i);
  });
});

describe('GET /paca/notifications/stats', () => {
  test('성공: 응답이 { message, stats } 표면을 유지한다 (프론트 StatsResponse 회귀)', async () => {
    pool.execute.mockResolvedValueOnce([[
      { total: 100, sent: 80, delivered: 70, failed: 10 },
    ]]);

    const app = buildApp();
    const res = await request(app).get('/paca/notifications/stats');

    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty('message');
    expect(res.body.stats).toEqual({ total: 100, sent: 80, delivered: 70, failed: 10 });
  });

  test('year/month 필터가 SQL params 에 반영된다', async () => {
    pool.execute.mockResolvedValueOnce([[{ total: 0, sent: 0, delivered: 0, failed: 0 }]]);

    const app = buildApp();
    await request(app)
      .get('/paca/notifications/stats')
      .query({ year: 2026, month: 4 });

    const [sql, params] = pool.execute.mock.calls[0];
    expect(sql).toMatch(/COUNT\(\*\) AS total/);
    expect(sql).toMatch(/SUM\(CASE WHEN status = 'sent'/);
    expect(sql).toMatch(/YEAR\(created_at\) = \? AND MONTH\(created_at\) = \?/);
    // year/month 는 query string → 문자열로 들어옴
    expect(params).toEqual([1, '2026', '4']);
  });

  test('year/month 없으면 academy_id 만으로 조회', async () => {
    pool.execute.mockResolvedValueOnce([[{ total: 0, sent: 0, delivered: 0, failed: 0 }]]);

    const app = buildApp();
    await request(app).get('/paca/notifications/stats');

    const [sql, params] = pool.execute.mock.calls[0];
    expect(sql).not.toMatch(/YEAR\(created_at\)/);
    expect(params).toEqual([1]);
  });

  test('실패: DB 오류 시 500 + 한국어 친화 메시지', async () => {
    pool.execute.mockRejectedValueOnce(new Error('ECONNREFUSED'));

    const app = buildApp();
    const res = await request(app).get('/paca/notifications/stats');

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/발송 통계/);
    expect(res.body.message).toMatch(/실패|불러오/);
    expect(res.body.message).not.toMatch(/Server Error|TypeError|ECONNREFUSED/i);
  });
});

describe('logs.js DB 호출 패턴 — ADR-005 (pool.execute 통일)', () => {
  test('pool.execute 만 사용하고 pool.query 는 사용하지 않는다 (logs)', async () => {
    pool.execute
      .mockResolvedValueOnce([[{ total: 0 }]])
      .mockResolvedValueOnce([[]]);

    const app = buildApp();
    await request(app).get('/paca/notifications/logs');

    expect(pool.execute).toHaveBeenCalledTimes(2);
    expect(pool.query).not.toHaveBeenCalled();
  });

  test('pool.execute 만 사용하고 pool.query 는 사용하지 않는다 (stats)', async () => {
    pool.execute.mockResolvedValueOnce([[{ total: 0, sent: 0, delivered: 0, failed: 0 }]]);

    const app = buildApp();
    await request(app).get('/paca/notifications/stats');

    expect(pool.execute).toHaveBeenCalledTimes(1);
    expect(pool.query).not.toHaveBeenCalled();
  });
});
