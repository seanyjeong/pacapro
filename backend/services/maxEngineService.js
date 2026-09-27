const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const repo = require('../repositories/maxEngineRepository');
const { decrypt } = require('../utils/encryption');
const { signingKey, TOKEN_SECONDS, PAGE_SIZE, ISSUER, AUDIENCE } = require('../config/maxEngine');

class LinkError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

function key() {
  const value = signingKey();
  if (!value) throw new LinkError(503, 'LINK_DISABLED', 'PACA 연동 설정이 필요합니다.');
  return value;
}

function authorized(user) {
  if (!user || !user.is_active || user.approval_status !== 'approved' ||
      !['owner', 'admin'].includes(user.role) || !Number.isSafeInteger(Number(user.academy_id)) ||
      Number(user.academy_id) <= 0) {
    throw new LinkError(403, 'LINK_FORBIDDEN', '승인된 PACA 원장·관리자 계정만 연결할 수 있습니다.');
  }
}

function fingerprint(user) {
  // Password changes revoke delegated tokens without writing a token table.
  return crypto.createHmac('sha256', key()).update(user.password_hash).digest('hex');
}

async function login(email, password) {
  key();
  const user = await repo.userByEmail(email);
  if (!user || !await bcrypt.compare(password, user.password_hash)) {
    throw new LinkError(401, 'LOGIN_FAILED', 'PACA 이메일 또는 비밀번호가 맞지 않습니다.');
  }
  authorized(user);
  const academy = await repo.academyById(user.academy_id);
  if (!academy) throw new LinkError(403, 'LINK_FORBIDDEN', '연결할 PACA 교육원이 없습니다.');
  let settings = academy.settings || {};
  if (typeof settings === 'string') settings = JSON.parse(settings);
  const accessToken = jwt.sign({ academy_id: Number(user.academy_id), scope: 'students:read records:read',
    credential_version: fingerprint(user) }, key(), { algorithm: 'HS256', issuer: ISSUER,
    audience: AUDIENCE, subject: String(user.id), expiresIn: TOKEN_SECONDS });
  return { access_token: accessToken, expires_in: TOKEN_SECONDS,
    academy_id: Number(academy.id), academy_name: academy.name,
    suggested_branch_name: settings.jungsiLink?.branchName || null };
}

async function authenticate(header) {
  const signing = key();
  let claims;
  try {
    if (!header?.startsWith('Bearer ')) throw new Error('missing');
    claims = jwt.verify(header.slice(7), signing, { algorithms: ['HS256'], issuer: ISSUER, audience: AUDIENCE });
    if (!/^\d+$/.test(claims.sub) || claims.scope !== 'students:read records:read' ||
        !Number.isSafeInteger(claims.academy_id)) throw new Error('claims');
  } catch {
    throw new LinkError(401, 'LINK_TOKEN_INVALID', 'PACA 연결이 만료되었거나 유효하지 않습니다. 다시 연결해 주세요.');
  }
  const user = await repo.userById(claims.sub);
  authorized(user);
  if (Number(user.academy_id) !== claims.academy_id || fingerprint(user) !== claims.credential_version) {
    throw new LinkError(401, 'LINK_TOKEN_INVALID', 'PACA 계정 정보가 변경되었습니다. 다시 연결해 주세요.');
  }
  return claims.academy_id;
}

function plaintext(value) {
  const result = decrypt(value);
  if (typeof result === 'string' && result.startsWith('ENC:')) {
    throw new LinkError(503, 'DECRYPT_FAILED', 'PACA 학생 정보를 복호화하지 못했습니다. 관리자에게 문의해 주세요.');
  }
  return result || null;
}

async function snapshot(academyId, afterId, dataset) {
  const all = await repo.students(academyId, afterId);
  const page = all.slice(0, PAGE_SIZE);
  const next = all.length > PAGE_SIZE ? Number(page.at(-1).id) : null;
  if (dataset === 'records') {
    const today = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
    return { academy_id: academyId, next_cursor: next, ...await repo.records(academyId, page.map(s => s.id), today) };
  }
  return { academy_id: academyId, next_cursor: next, students: page.map(s => ({
    paca_student_id: Number(s.id), name: plaintext(s.name), gender: s.gender, grade: s.grade,
    school: s.school, phone: plaintext(s.phone), parent_phone: plaintext(s.parent_phone),
    status: s.status, updated_at: s.updated_at,
  })) };
}

module.exports = { LinkError, login, authenticate, snapshot };
