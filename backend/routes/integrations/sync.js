const router = require('express').Router();
const service = require('../../services/maxEngineSyncService');
const { LinkError } = require('../../models/maxEngineError');
router.use((req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
router.get('/students', async (req, res) => {
  try {
    res.json(await service.students(req.query, req.headers['x-max-engine-sync-key'],
      req.socket.remoteAddress, req.headers));
  } catch (error) {
    const known = error instanceof LinkError;
    // Never expose database/crypto errors or student data through errors or logs.
    res.status(known ? error.status : 503).json({ error: {
      code: known ? error.code : 'SOURCE_UNAVAILABLE',
      message: known ? error.message : '동기화 학생 자료를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      details: {},
    } });
  }
});
// 맥스엔진 DL 데일리루틴 시즌 단계 — 시즌 날짜와 학생 시즌 등록만(이름·전화 없음), 같은 키·같은 교육원 범위.
router.get('/seasons', async (req, res) => {
  try {
    res.json(await service.seasons(req.query, req.headers['x-max-engine-sync-key'],
      req.socket.remoteAddress, req.headers));
  } catch (error) {
    const known = error instanceof LinkError;
    res.status(known ? error.status : 503).json({ error: {
      code: known ? error.code : 'SOURCE_UNAVAILABLE',
      message: known ? error.message : '동기화 시즌 자료를 읽지 못했습니다. 잠시 뒤 다시 시도해 주세요.',
      details: {},
    } });
  }
});
module.exports = router;
