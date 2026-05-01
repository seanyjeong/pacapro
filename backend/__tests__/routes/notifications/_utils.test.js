/**
 * routes/notifications/_utils.js 테스트
 *
 * 목적:
 *   - export 표면 (이름/시그니처) 회귀 검증
 *     하위 라우터 4개 (send.js / test.js / settings.js / logs.js)가
 *     `require('./_utils')`로 가져가는 모든 키가 정확히 같은 형태로 노출되는지 확인.
 *   - 헬퍼 함수 (decryptStudentInfo / decryptStudentArray) 동작 보존 검증.
 *   - 신규 alias `pool` 도입 시 `db`와 같은 인스턴스인지 검증 (점진 마이그레이션 안전).
 *
 * 보안 영역 주의:
 *   - encryption.decrypt, encryptApiKey, decryptApiKey, sendAlimtalk 등은 모킹.
 *   - 실제 암호화 로직은 검증 대상 아님 (보안 영역 자동 변경 금지).
 */

// --- 외부 의존성 모두 mock (DB 연결 / 네트워크 호출 없이 require 가능하게) ---

jest.mock('../../../config/database', () => {
  // mysql2/promise pool과 같은 표면을 흉내내는 더미 객체
  const fakePool = {
    execute: jest.fn(),
    query: jest.fn(),
    getConnection: jest.fn(),
  };
  return fakePool;
});

jest.mock('../../../middleware/auth', () => ({
  verifyToken: jest.fn((req, res, next) => next()),
  checkPermission: jest.fn(() => (req, res, next) => next()),
}));

jest.mock('../../../utils/naverSens', () => ({
  encryptApiKey: jest.fn((k) => `enc:${k}`),
  decryptApiKey: jest.fn((k) => k.replace(/^enc:/, '')),
  sendAlimtalk: jest.fn(async () => ({ ok: true })),
  createUnpaidNotificationMessage: jest.fn(() => '미납 안내 메시지'),
  isValidPhoneNumber: jest.fn((p) => /^010\d{8}$/.test(p)),
}));

jest.mock('../../../utils/encryption', () => ({
  decrypt: jest.fn((v) => (typeof v === 'string' ? `dec:${v}` : v)),
}));

jest.mock('../../../utils/logger', () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock('../../../utils/solapi', () => ({
  sendAlimtalkSolapi: jest.fn(async () => ({ ok: true })),
  getBalanceSolapi: jest.fn(async () => ({ balance: 0 })),
}));

const utils = require('../../../routes/notifications/_utils');

describe('notifications/_utils.js — export 표면 회귀', () => {
  const expectedKeys = [
    'db',
    'verifyToken',
    'checkPermission',
    'encryptApiKey',
    'decryptApiKey',
    'sendAlimtalk',
    'createUnpaidNotificationMessage',
    'isValidPhoneNumber',
    'decrypt',
    'logger',
    'sendAlimtalkSolapi',
    'getBalanceSolapi',
    'decryptStudentInfo',
    'decryptStudentArray',
    'ENCRYPTION_KEY',
  ];

  test.each(expectedKeys)('export 키 "%s" 가 존재한다 (하위 라우터 호환)', (key) => {
    expect(utils).toHaveProperty(key);
  });

  test('함수 export 시그니처가 함수 타입이다', () => {
    [
      'verifyToken',
      'checkPermission',
      'encryptApiKey',
      'decryptApiKey',
      'sendAlimtalk',
      'createUnpaidNotificationMessage',
      'isValidPhoneNumber',
      'decrypt',
      'sendAlimtalkSolapi',
      'getBalanceSolapi',
      'decryptStudentInfo',
      'decryptStudentArray',
    ].forEach((k) => expect(typeof utils[k]).toBe('function'));
  });

  test('logger 는 winston 호환 객체이다 (info/warn/error)', () => {
    expect(typeof utils.logger.info).toBe('function');
    expect(typeof utils.logger.warn).toBe('function');
    expect(typeof utils.logger.error).toBe('function');
  });

  test('db 는 mysql2 pool 표면 (execute/query/getConnection) 을 갖는다', () => {
    expect(typeof utils.db.execute).toBe('function');
    expect(typeof utils.db.query).toBe('function');
    expect(typeof utils.db.getConnection).toBe('function');
  });
});

describe('notifications/_utils.js — pool alias (RULES ADR-005 정렬)', () => {
  test('pool 별칭이 추가되어 있고, db 와 동일한 인스턴스다', () => {
    // db 와 pool 은 같은 mysql2 pool 인스턴스여야 함 (점진 마이그레이션 안전)
    expect(utils.pool).toBeDefined();
    expect(utils.pool).toBe(utils.db);
  });
});

describe('decryptStudentInfo', () => {
  beforeEach(() => {
    // 모킹된 decrypt 호출 카운트 리셋
    require('../../../utils/encryption').decrypt.mockClear();
  });

  test('null 또는 undefined 입력은 그대로 반환', () => {
    expect(utils.decryptStudentInfo(null)).toBeNull();
    expect(utils.decryptStudentInfo(undefined)).toBeUndefined();
  });

  test('알려진 필드 (student_name/parent_phone/student_phone/phone/name) 만 복호화', () => {
    const input = {
      id: 7,
      student_name: 'enc-name',
      parent_phone: 'enc-pp',
      student_phone: 'enc-sp',
      phone: 'enc-p',
      name: 'enc-n',
      other_field: '건드리면 안 됨',
    };
    const out = utils.decryptStudentInfo(input);
    expect(out.student_name).toBe('dec:enc-name');
    expect(out.parent_phone).toBe('dec:enc-pp');
    expect(out.student_phone).toBe('dec:enc-sp');
    expect(out.phone).toBe('dec:enc-p');
    expect(out.name).toBe('dec:enc-n');
    expect(out.other_field).toBe('건드리면 안 됨');
    expect(out.id).toBe(7);
  });

  test('필드가 없는 키는 호출하지 않음 (decrypt count)', () => {
    const decryptMock = require('../../../utils/encryption').decrypt;
    utils.decryptStudentInfo({ id: 1, name: 'enc-n' });
    expect(decryptMock).toHaveBeenCalledTimes(1);
    expect(decryptMock).toHaveBeenCalledWith('enc-n');
  });
});

describe('decryptStudentArray', () => {
  test('각 row 를 spread 로 복사한 뒤 복호화 (원본 mutate 안 함)', () => {
    const original = [
      { id: 1, student_name: 'enc-A' },
      { id: 2, student_name: 'enc-B' },
    ];
    const snapshot = JSON.parse(JSON.stringify(original));
    const out = utils.decryptStudentArray(original);
    // 원본은 그대로
    expect(original).toEqual(snapshot);
    // 결과는 복호화됨
    expect(out[0].student_name).toBe('dec:enc-A');
    expect(out[1].student_name).toBe('dec:enc-B');
  });

  test('빈 배열은 빈 배열 반환', () => {
    expect(utils.decryptStudentArray([])).toEqual([]);
  });
});

describe('ENCRYPTION_KEY', () => {
  test('환경변수 그대로 노출 (값 자체 검증은 X — 환경 의존)', () => {
    // 키 자체는 환경에 따라 다름. 키 가 "존재한다는 사실" 만 export 표면 검증.
    expect('ENCRYPTION_KEY' in utils).toBe(true);
  });
});
