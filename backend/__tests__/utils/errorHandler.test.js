/**
 * errorHandler 미들웨어 테스트
 * - statusCode + code + message 있을 때 그대로 사용
 * - 없으면 500 + INTERNAL_ERROR + 한국어 디폴트
 * - NODE_ENV=development 에서만 stack 로깅
 * - headersSent 면 next(err)로 위임
 */

// logger mock (winston 호출 카운트 검증용)
jest.mock('../../utils/logger', () => ({
  error: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
}));

const logger = require('../../utils/logger');
const errorHandler = require('../../middleware/errorHandler');

function mockRes() {
  const res = {};
  res.headersSent = false;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

function mockReq() {
  return { method: 'GET', url: '/test' };
}

describe('errorHandler', () => {
  const originalEnv = process.env.NODE_ENV;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalEnv;
  });

  test('statusCode + code + message 있으면 그대로 사용', () => {
    const res = mockRes();
    const next = jest.fn();
    const err = Object.assign(new Error('학생을 찾을 수 없습니다.'), {
      statusCode: 404,
      code: 'STUDENT_NOT_FOUND',
    });

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(404);
    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'STUDENT_NOT_FOUND', message: '학생을 찾을 수 없습니다.' },
    });
    expect(next).not.toHaveBeenCalled();
  });

  test('statusCode 없으면 500 + INTERNAL_ERROR + 한국어 디폴트 메시지', () => {
    const res = mockRes();
    const next = jest.fn();
    const err = new Error('Cannot read property of undefined');

    errorHandler(err, mockReq(), res, next);

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'INTERNAL_ERROR',
        message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
    });
  });

  test('code만 있고 statusCode 없으면 디폴트 메시지 (raw err.message 노출 X)', () => {
    const res = mockRes();
    const err = Object.assign(new Error('TypeError raw'), { code: 'CUSTOM_CODE' });

    errorHandler(err, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'CUSTOM_CODE',
        message: '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.',
      },
    });
  });

  test('statusCode 범위 밖(예: 200, 700)이면 500으로 보정', () => {
    const res = mockRes();
    const err = Object.assign(new Error('weird'), { statusCode: 200, code: 'X' });

    errorHandler(err, mockReq(), res, jest.fn());

    expect(res.status).toHaveBeenCalledWith(500);
  });

  test('details 있으면 응답에 포함', () => {
    const res = mockRes();
    const err = Object.assign(new Error('필수 항목 누락'), {
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      details: { field: 'name' },
    });

    errorHandler(err, mockReq(), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      error: {
        code: 'VALIDATION_ERROR',
        message: '필수 항목 누락',
        details: { field: 'name' },
      },
    });
  });

  test('NODE_ENV=development 면 err.stack 로깅', () => {
    process.env.NODE_ENV = 'development';
    const res = mockRes();
    const err = new Error('boom');
    err.stack = 'Error: boom\n    at ...';

    errorHandler(err, mockReq(), res, jest.fn());

    expect(logger.error).toHaveBeenCalledTimes(1);
    expect(logger.error.mock.calls[0][0]).toContain('Error: boom');
    expect(logger.error.mock.calls[0][0]).toContain('at ...');
  });

  test('NODE_ENV=production 이면 stack 미노출, message만 로깅', () => {
    process.env.NODE_ENV = 'production';
    const res = mockRes();
    const err = new Error('boom-prod');
    err.stack = 'Error: boom-prod\n    at secret-path';

    errorHandler(err, mockReq(), res, jest.fn());

    expect(logger.error).toHaveBeenCalledTimes(1);
    const logged = logger.error.mock.calls[0][0];
    expect(logged).toContain('boom-prod');
    expect(logged).not.toContain('secret-path');
  });

  test('headersSent 이면 next(err)로 위임', () => {
    const res = mockRes();
    res.headersSent = true;
    const next = jest.fn();
    const err = new Error('late');

    errorHandler(err, mockReq(), res, next);

    expect(next).toHaveBeenCalledWith(err);
    expect(res.status).not.toHaveBeenCalled();
    expect(res.json).not.toHaveBeenCalled();
  });

  test('respondError 형식 (RULES.md ADR-004) 준수: { error: { code, message } }', () => {
    const res = mockRes();
    const err = Object.assign(new Error('이미 등록된 학생입니다.'), {
      statusCode: 409,
      code: 'DUPLICATE',
    });

    errorHandler(err, mockReq(), res, jest.fn());

    const body = res.json.mock.calls[0][0];
    expect(body).toHaveProperty('error');
    expect(body.error).toHaveProperty('code');
    expect(body.error).toHaveProperty('message');
    expect(body).not.toHaveProperty('data');
    expect(body).not.toHaveProperty('success');
  });

  test('한국어 message 한 글자라도 있으면 사용 (RULES.md ADR-003)', () => {
    const res = mockRes();
    const err = Object.assign(new Error('권한 없음'), {
      statusCode: 403,
      code: 'FORBIDDEN',
    });

    errorHandler(err, mockReq(), res, jest.fn());

    expect(res.json).toHaveBeenCalledWith({
      error: { code: 'FORBIDDEN', message: '권한 없음' },
    });
  });
});
