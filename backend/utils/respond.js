/**
 * paca 응답 빌더 (RULES.md ADR-004)
 *
 * 모든 라우터는 이 헬퍼로 응답을 보낸다.
 * 직접 res.json({...}) 호출 지양 (점진 적용).
 *
 * 성공: { data, meta? }
 * 실패: { error: { code, message, details? } }
 *
 * 한국어 친화 메시지 = 사용자 노출용 (RULES.md ADR-003)
 * code = 영어 (개발자 로그/디버그용)
 */

/**
 * 성공 응답
 * @param {import('express').Response} res
 * @param {*} data — 실제 데이터 (객체 또는 배열)
 * @param {object} [meta] — 옵션 (페이징 등)
 * @param {number} [status=200]
 * @returns {import('express').Response}
 */
function respondSuccess(res, data, meta, status = 200) {
  const body = { data };
  if (meta && typeof meta === 'object' && Object.keys(meta).length > 0) {
    body.meta = meta;
  }
  return res.status(status).json(body);
}

/**
 * 실패 응답
 * @param {import('express').Response} res
 * @param {number} status — HTTP status code
 * @param {string} code — 영어 에러 코드 (예: VALIDATION_ERROR)
 * @param {string} message — 한국어 사용자 친화 메시지
 * @param {object} [details] — 옵션 (디버그용)
 * @returns {import('express').Response}
 */
function respondError(res, status, code, message, details) {
  const error = { code, message };
  if (details && typeof details === 'object') {
    error.details = details;
  }
  return res.status(status).json({ error });
}

module.exports = { respondSuccess, respondError };
