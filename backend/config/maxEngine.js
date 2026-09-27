// 기존 JWT·서비스 키와 분리. 미설정이면 연동 경로만 닫는다.
const TOKEN_SECONDS = 3600;
const PAGE_SIZE = 200;
const ISSUER = 'paca-max-engine';
const AUDIENCE = 'max-engine-read';

function signingKey() {
  const key = process.env.MAX_ENGINE_LINK_SECRET;
  const existing = [process.env.JWT_SECRET, process.env.MAXLINK_READ_API_KEY,
    process.env.PACA_NOTIFICATION_API_KEY, process.env.DATA_ENCRYPTION_KEY];
  if (!key || Buffer.byteLength(key) < 32 || existing.includes(key)) return null;
  return key;
}

module.exports = { TOKEN_SECONDS, PAGE_SIZE, ISSUER, AUDIENCE, signingKey };
