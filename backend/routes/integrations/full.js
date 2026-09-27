const express = require('express');
const rateLimit = require('express-rate-limit');
const auth = require('../../services/maxEngineFullAuth');
const reads = require('../../services/maxEngineFullRead');
const commands = require('../../services/maxEngineFullCommands');
const { LinkError } = require('../../services/maxEngineService');
const { fail } = require('../../services/maxEngineFullSecurity');
const logger = require('../../utils/logger');

const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function route(action, handler) {
  return async (req, res) => {
    try {
      const result = await handler(req);
      logger.info('max_engine_integration', { user_id: req.actor?.user_id ?? result.user_id,
        academy_id: req.actor?.academy_id ?? result.academy_id,
        action, provider: req.params.provider, resource: req.params.resource, operation: result.operation,
        resource_id: result.resource_id ?? null, at: new Intl.DateTimeFormat('sv-SE', { timeZone: 'Asia/Seoul',
          dateStyle: 'short', timeStyle: 'medium' }).format(new Date()) + '+09:00' });
      res.json(result);
    } catch (error) {
      const known = error instanceof LinkError;
      res.status(known ? error.status : 503).json({ error: { code: known ? error.code : 'SOURCE_UNAVAILABLE',
        message: known ? error.message : '연동 작업을 처리하지 못했습니다. 같은 확인 키로 다시 시도해 주세요.', details: {} } });
    }
  };
}
router.post('/token', rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: true, legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: '로그인 시도가 많습니다. 잠시 뒤 다시 시도해 주세요.', details: {} } } }), route('login', async req => {
  const b = req.body || {};
  if (Object.keys(req.query).length || Object.keys(b).some(k => !['email', 'password'].includes(k)) ||
      typeof b.email !== 'string' || !b.email.trim() || b.email.length > 255 ||
      typeof b.password !== 'string' || !b.password || Buffer.byteLength(b.password) > 72) fail(422, 'INVALID_INPUT', '이메일과 비밀번호를 확인해 주세요.');
  return auth.login(b.email.trim(), b.password);
}));
router.use(async (req, res, next) => {
  try { req.actor = await auth.authenticate(req.headers.authorization); next(); }
  catch (error) { res.status(error instanceof LinkError ? error.status : 503).json({ error: {
    code: error instanceof LinkError ? error.code : 'SOURCE_UNAVAILABLE',
    message: error instanceof LinkError ? error.message : '인증 상태를 확인하지 못했습니다.', details: {} } }); }
});
router.get('/identity', route('identity', async req => ({ ...req.actor })));
router.param('provider', (req, res, next, provider) => {
  if (!['paca', 'peak'].includes(provider)) return res.status(404).json({ error: { code: 'NOT_FOUND', message: '제공자를 확인해 주세요.', details: {} } });
  next();
});
router.get('/:provider/catalog', route('catalog', async req => ({ academy_id: req.actor.academy_id,
  resources: reads.resources(req.params.provider), commands: commands.catalog(req.params.provider) })));
router.get('/:provider/resources/:resource', route('read', req => reads.read(req.actor, req.params.provider, req.params.resource, req.query)));
router.post('/:provider/preview', route('preview', req => commands.preview(req.actor, req.params.provider, req.body)));
router.post('/:provider/confirm', route('confirm', req => commands.confirm(req.actor, req.params.provider, req.body)));
router.use((_req, res) => res.status(404).json({ error: { code: 'NOT_FOUND', message: '허용된 연동 경로를 확인해 주세요.', details: {} } }));
module.exports = router;
