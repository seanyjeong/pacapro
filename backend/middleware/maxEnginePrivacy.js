// JSON 파싱 오류 객체에는 입력 본문(비밀번호·토큰)이 붙으므로 기존 오류 로거로 넘기지 않는다.
function isIntegration(req) { return req.path.startsWith('/paca/integrations/max-engine'); }
function errorHandler(error, req, res, next) {
  if (!isIntegration(req)) return next(error);
  res.status(error.status === 413 ? 413 : 400).json({ error: {
    code: 'INVALID_REQUEST', message: '연동 요청 형식 또는 크기를 확인해 주세요.', details: {},
  } });
}
module.exports = { isIntegration, errorHandler };
