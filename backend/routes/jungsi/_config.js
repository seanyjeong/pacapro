const crypto = require('crypto');

const EXAM_TYPES = ['3월', '6월', '9월', '수능'];
const LINK_STATE_TTL_MS = 10 * 60 * 1000;

function trimSlash(value) {
  return String(value || '').replace(/\/+$/, '');
}

function getDefaultExam(now = new Date()) {
  const month = now.getMonth() + 1;
  if (month >= 11) return '수능';
  if (month >= 9) return '9월';
  if (month >= 6) return '6월';
  return '3월';
}

function getJungsiApiBase() {
  return trimSlash(process.env.JUNGSI_API_BASE || 'https://supermax.kr');
}

function getJungsiFrontendBase() {
  return trimSlash(process.env.JUNGSI_FRONTEND_BASE || 'https://seanyjeong.github.io/maxjungsi222');
}

function getPacaApiBase() {
  return trimSlash(process.env.PACA_API_BASE || process.env.NEXT_PUBLIC_API_URL || 'https://chejump.com/paca');
}

function getJungsiJwtSecret() {
  return process.env.JUNGSI_JWT_SECRET || '';
}

function hashStateSecret(secret) {
  return crypto.createHash('sha256').update(secret).digest('hex');
}

function createLinkState(academyId) {
  const secret = crypto.randomBytes(32).toString('hex');
  return {
    state: `${academyId}.${secret}`,
    stateHash: hashStateSecret(secret),
  };
}

function parseLinkState(state) {
  const [academyIdText, secret] = String(state || '').split('.');
  const academyId = Number(academyIdText);
  if (!academyId || !secret) return null;
  return { academyId, secret, stateHash: hashStateSecret(secret) };
}

module.exports = {
  EXAM_TYPES,
  LINK_STATE_TTL_MS,
  createLinkState,
  getDefaultExam,
  getJungsiApiBase,
  getJungsiFrontendBase,
  getJungsiJwtSecret,
  getPacaApiBase,
  parseLinkState,
};
