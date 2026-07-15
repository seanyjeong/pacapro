const crypto = require('crypto');

const SOURCE_READ_PATHS = [
  /^\/(?:paca\/)?students\/\d+$/,
  /^\/(?:paca\/)?students\/\d+\/attendance$/,
  /^\/(?:paca\/)?payments$/,
  /^\/(?:paca\/)?student-context$/,
  /^\/(?:paca\/)?jungsi\/family-scores\/\d+$/,
];

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return leftBuffer.length === rightBuffer.length
    && leftBuffer.length > 0
    && crypto.timingSafeEqual(leftBuffer, rightBuffer);
}

function requestPath(req) {
  return String(req.originalUrl || req.url || '').split('?')[0];
}

function sourceAcademyId(req) {
  const academyId = Number(req.query?.academy_id);
  return Number.isSafeInteger(academyId) && academyId > 0 ? academyId : null;
}

function isAllowedSourceRead(req) {
  if (req.method !== 'GET') return false;
  const path = requestPath(req);
  if (!SOURCE_READ_PATHS.some((pattern) => pattern.test(path))) return false;
  if (/\/(?:paca\/)?payments$/.test(path)) {
    return Number.isSafeInteger(Number(req.query?.student_id)) && Number(req.query.student_id) > 0;
  }
  if (/\/(?:paca\/)?student-context$/.test(path)) {
    return Number.isSafeInteger(Number(req.query?.q)) && Number(req.query.q) > 0;
  }
  return true;
}

function authenticateSourceReadRequest(req) {
  const configuredKey = process.env.MAXLINK_READ_API_KEY;
  const providedKey = req.headers?.['x-api-key'];
  if (!safeEqual(providedKey, configuredKey) || !isAllowedSourceRead(req)) return null;

  const academyId = sourceAcademyId(req);
  if (!academyId) return null;

  return {
    academyId,
    academy_id: academyId,
    email: 'maxlink-reader@system',
    id: 0,
    isServiceAccount: true,
    isSourceReadService: true,
    name: 'MAX LINK Reader',
    permissions: {},
    position: 'system',
    role: 'service_reader',
    userId: 0,
  };
}

module.exports = {
  authenticateSourceReadRequest,
  isAllowedSourceRead,
  sourceAcademyId,
};
