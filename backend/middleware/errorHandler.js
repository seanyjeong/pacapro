/**
 * paca 에러 핸들러 미들웨어 (RULES.md ADR-003 / ADR-004)
 *
 * Express 4-인자 에러 미들웨어. paca.js 마지막에 mount 예정.
 * (ADR-010: Phase 0에서는 신규 파일만 추가. 실제 mount는 Phase 1+)
 *
 * 동작:
 * - err.statusCode + err.code + err.message 있으면 그대로 사용
 * - 없으면 500 + INTERNAL_ERROR + 한국어 디폴트 메시지
 * - NODE_ENV=development 에서만 err.stack / 원본 메시지 logger.error 기록
 * - 사용자 노출 message는 무조건 한국어 (RULES.md ADR-003)
 *
 * 의존:
 * - backend/utils/respond.js (respondError)
 * - backend/utils/logger.js (winston)
 */

const logger = require('../utils/logger');
const { respondError } = require('../utils/respond');

const DEFAULT_STATUS = 500;
const DEFAULT_CODE = 'INTERNAL_ERROR';
const DEFAULT_MESSAGE = '서버에 일시적인 문제가 발생했습니다. 잠시 후 다시 시도해주세요.';

/**
 * Express 4-인자 에러 미들웨어
 * @param {Error & { statusCode?: number, code?: string, details?: object }} err
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @param {import('express').NextFunction} next
 */
// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  // 응답 이미 보냈으면 Express 기본 핸들러로 위임
  if (res.headersSent) {
    return next(err);
  }

  const hasExplicitStatus =
    typeof err.statusCode === 'number' && err.statusCode >= 400 && err.statusCode < 600;

  const status = hasExplicitStatus ? err.statusCode : DEFAULT_STATUS;

  const code =
    typeof err.code === 'string' && err.code.length > 0 ? err.code : DEFAULT_CODE;

  // 사용자 노출 메시지: 라우터에서 명시적으로 statusCode를 세팅한 경우만 err.message 신뢰
  // (statusCode 없는 raw Error는 한국어 친화 보장 X → 디폴트 메시지로 대체)
  const message =
    hasExplicitStatus && typeof err.message === 'string' && err.message.length > 0
      ? err.message
      : DEFAULT_MESSAGE;

  // 개발 환경: 원본 stack/message 로그 (운영 디버깅 보조)
  if (process.env.NODE_ENV === 'development') {
    logger.error('[errorHandler] ' + (err.stack || err.message || String(err)));
  } else {
    // 운영 환경: 메시지만 (stack 비노출)
    logger.error('[errorHandler] ' + (err.message || String(err)));
  }

  return respondError(res, status, code, message, err.details);
}

module.exports = errorHandler;
