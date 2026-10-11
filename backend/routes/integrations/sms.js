const router = require('express').Router();
const service = require('../../services/maxEngineSmsService');
const { LinkError } = require('../../models/maxEngineError');
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
function route(handler) {
  return async (req, res) => {
    try {
      res.json(await handler(req.headers['x-max-engine-sync-key'], req.socket.remoteAddress, req.headers, req));
    } catch (error) {
      const known = error instanceof LinkError;
      // Never expose database/crypto errors, settings, recipients or message text through errors or logs.
      res.status(known ? error.status : 503).json({ error: {
        code: known ? error.code : 'SOURCE_UNAVAILABLE',
        message: known ? error.message : '문자 설정을 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
        details: {},
      } });
    }
  };
}
router.get('/status', route((key, address, headers, req) => service.status(req.query, key, address, headers)));
router.post('/send', route((key, address, headers, req) => service.send(req.body, key, address, headers)));
module.exports = router;
