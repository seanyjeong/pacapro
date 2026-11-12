const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const repo = require('../repositories/maxEngineRepository');
const config = require('../config/maxEngineFull');
const { fail } = require('./maxEngineFullSecurity');

function key() {
  const signing = config.signingKey();
  if (!signing) fail(503, 'LINK_DISABLED', '전용 연동 키 설정이 필요합니다.');
  return signing;
}
// 원장·관리자·직원(staff) 연결 가능 — 직원은 파카 직원 권한대로(maxEngineFullPermissions). 거절은 이유별 문구(MCP 로그인 화면에 그대로 보인다).
function assertUser(user) {
  if (!user || !user.is_active) fail(403, 'LINK_FORBIDDEN', '사용 중지된 파카 계정입니다. 원장에게 문의해 주세요.');
  if (user.approval_status !== 'approved') fail(403, 'LINK_FORBIDDEN', '아직 승인되지 않은 파카 계정입니다. 승인된 뒤 연결할 수 있습니다.');
  if (!['owner', 'admin', 'staff'].includes(user.role)) fail(403, 'LINK_FORBIDDEN', '파카 원장·관리자·직원 계정만 연결할 수 있습니다.');
  if (!Number.isSafeInteger(Number(user.academy_id)) || Number(user.academy_id) < 1) fail(403, 'LINK_FORBIDDEN', '교육원이 지정되지 않은 파카 계정입니다.');
}
function permissions(user) {
  if (user.role !== 'staff') return {};
  try {
    const value = typeof user.permissions === 'string' ? JSON.parse(user.permissions) : user.permissions;
    return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  } catch { return {}; }
}
const fingerprint = user => crypto.createHmac('sha256', key()).update(user.password_hash).digest('hex');
async function login(email, password, { purpose } = {}) {
  key();
  const user = await repo.userByEmail(email);
  if (!user || !await bcrypt.compare(password, user.password_hash)) fail(401, 'LOGIN_FAILED', '이메일 또는 비밀번호를 확인해 주세요.');
  assertUser(user);
  const academy = await repo.academyById(user.academy_id);
  if (!academy) fail(403, 'LINK_FORBIDDEN', '연결할 교육원이 없습니다.');
  const seconds = purpose === 'mcp' ? config.mcpTokenSeconds : config.tokenSeconds;
  const token = jwt.sign({ academy_id: Number(user.academy_id), scope: config.scope,
    credential_version: fingerprint(user) }, key(), { algorithm: 'HS256', issuer: config.issuer,
    audience: config.audience, subject: String(user.id), expiresIn: seconds });
  return { access_token: token, expires_in: seconds, academy_id: Number(user.academy_id),
    user_id: Number(user.id), academy_name: academy.name, scope: config.scope };
}
async function authenticate(header) {
  let claims;
  const signing = key();
  try {
    if (!header?.startsWith('Bearer ')) throw new Error('missing');
    claims = jwt.verify(header.slice(7), signing, { algorithms: ['HS256'], issuer: config.issuer, audience: config.audience });
    if (!/^[1-9]\d*$/.test(claims.sub) || !Number.isSafeInteger(Number(claims.sub)) ||
        !Number.isSafeInteger(claims.academy_id) || claims.academy_id < 1 || claims.scope !== config.scope) throw new Error('claims');
  } catch { fail(401, 'LINK_TOKEN_INVALID', 'PACA·PEAK 전체 기능에 다시 연결해 주세요.'); }
  const user = await repo.userById(claims.sub);
  assertUser(user);
  if (Number(user.academy_id) !== claims.academy_id || fingerprint(user) !== claims.credential_version) {
    fail(401, 'LINK_TOKEN_INVALID', '계정 정보가 변경되었습니다. 다시 연결해 주세요.');
  }
  return { user_id: Number(user.id), academy_id: claims.academy_id, expires_at: claims.exp, role: user.role, permissions: permissions(user) };
}
module.exports = { login, authenticate };
