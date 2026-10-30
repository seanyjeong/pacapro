const { FILE_PUBLIC_PATHS } = require('../constants/ilsanAdmission');

// Local tablet HTML has Origin:null. Only anonymous intake endpoints opt in;
// authenticated academy data and approval routes keep the existing CORS policy.
function ilsanAdmissionFileCors(req, res, next) {
  if (req.get('Origin') !== 'null' || !FILE_PUBLIC_PATHS.includes(req.path)) return next();
  const method = req.method === 'OPTIONS' ? req.get('Access-Control-Request-Method') : req.method;
  const expected = req.path.endsWith('/submit') ? 'POST' : 'GET';
  if (method !== expected) return next();
  const headers = (req.get('Access-Control-Request-Headers') || '').toLowerCase().split(',').map(h => h.trim()).filter(Boolean);
  if (req.method === 'OPTIONS' && headers.some(h => !['content-type','idempotency-key'].includes(h))) return next();
  res.vary('Origin');
  res.set('Access-Control-Allow-Origin', 'null');
  res.set('Access-Control-Allow-Methods', expected);
  res.set('Access-Control-Allow-Headers', 'Content-Type, Idempotency-Key');
  res.set('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
}
module.exports = { ilsanAdmissionFileCors };
