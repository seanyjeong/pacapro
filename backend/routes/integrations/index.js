const express = require('express');
const rateLimit = require('express-rate-limit');
const service = require('../../services/maxEngineService');

const router = express.Router();
router.use('/max-engine/sync', require('./sync'));
router.use('/max-engine/full', require('./full'));
const loginLimiter = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10,
  standardHeaders: 'draft-7', legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: '로그인 시도가 많습니다. 잠시 뒤 다시 시도해 주세요.', details: {} } } });

router.use('/max-engine', (req, res, next) => {
  res.set('Cache-Control', 'no-store');
  next();
});

function route(handler) {
  return async (req, res) => {
    try { await handler(req, res); } catch (error) {
      const known = error instanceof service.LinkError;
      // Never forward database errors, credentials, token claims, or student rows to logs.
      res.status(known ? error.status : 503).json({ error: {
        code: known ? error.code : 'SOURCE_UNAVAILABLE',
        message: known ? error.message : 'PACA·PEAK 자료를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.', details: {},
      } });
    }
  };
}

router.post('/max-engine/token', loginLimiter, route(async (req, res) => {
  const body = req.body || {};
  if (Object.keys(req.query).length || Object.keys(body).some(k => !['email', 'password'].includes(k)) ||
      typeof body.email !== 'string' || !body.email.trim() || body.email.length > 255 ||
      typeof body.password !== 'string' || !body.password || Buffer.byteLength(body.password) > 72) {
    throw new service.LinkError(422, 'INVALID_REQUEST', 'PACA 이메일·비밀번호만 보내 주세요.');
  }
  res.json(await service.login(body.email.trim(), body.password));
}));

router.get('/max-engine/snapshot', route(async (req, res) => {
  const academyId = await service.authenticate(req.headers.authorization);
  const { cursor = '0', dataset = 'students' } = req.query;
  if (Object.keys(req.query).some(k => !['cursor', 'dataset'].includes(k)) ||
      typeof cursor !== 'string' || !/^\d+$/.test(cursor) || !Number.isSafeInteger(Number(cursor)) ||
      !['students', 'records'].includes(dataset)) {
    throw new service.LinkError(422, 'INVALID_REQUEST', 'dataset(students·records), cursor만 지정할 수 있습니다.');
  }
  res.json(await service.snapshot(academyId, Number(cursor), dataset));
}));

module.exports = router;
