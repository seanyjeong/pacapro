const express = require('express');
const rateLimit = require('express-rate-limit');
const pool = require('../config/database');
const { verifyToken, checkPermission } = require('../middleware/auth');
const { createAdmissionService } = require('../services/ilsanAdmissionService');
const { AdmissionError } = require('../models/ilsanAdmission');
const { PUBLIC_LIMIT_PER_HOUR } = require('../constants/ilsanAdmission');
const logger = require('../utils/logger');
const service = createAdmissionService(pool);
const router = express.Router();
router.use((_req, res, next) => { res.set('Cache-Control', 'no-store'); next(); });
const handle = work => async (req, res) => {
  try { res.json(await work(req)); }
  catch (error) {
    if (error instanceof AdmissionError) return res.status(error.status).json({code:error.code,message:error.message});
    // Do not log SQL parameters or applicant information on public submission errors.
    logger.error('[IlsanAdmissions] request failed', { code: error.code || 'INTERNAL' });
    res.status(500).json({message:'처리하지 못했습니다. 잠시 후 다시 시도해 주세요.'});
  }
};
const id = value => {
  const n = Number(value);
  if (!Number.isSafeInteger(n) || n < 1) throw new AdmissionError(422, 'INVALID_ID', '원서를 다시 선택해 주세요.');
  return n;
};
router.post('/submit', rateLimit({windowMs:60*60*1000,max:PUBLIC_LIMIT_PER_HOUR,standardHeaders:true,legacyHeaders:false,
  message:{message:'접수 요청이 많습니다. 잠시 후 다시 시도해 주세요.'}}),
handle(req => service.submit(req.body, req.get('Idempotency-Key'))));
router.use(verifyToken, checkPermission('students', 'edit'));
router.get('/', handle(req => service.list(req.user, req.query.before ? id(req.query.before) : undefined)));
router.post('/:id/preview', handle(req => service.preview(req.user, id(req.params.id), req.body)));
router.post('/:id/confirm', handle(req => service.confirm(req.user, id(req.params.id), req.body)));
router.post('/:id/cancel', handle(req => service.cancel(req.user, id(req.params.id), req.body.revision)));
module.exports = router;
