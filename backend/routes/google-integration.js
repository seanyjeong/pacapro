const express = require('express');
const { verifyToken } = require('../middleware/auth');
const service = require('../services/google/connection');
const { GOOGLE, config } = require('../config/google');
const router = express.Router();
const COOKIE = 'paca_google_oauth';
const cookieOptions = () => ({ httpOnly: true, sameSite: 'lax', secure: config().redirectUri.startsWith('https:'),
    path: '/paca/google-integration/callback', maxAge: GOOGLE.stateSeconds * 1000 });
const messages = {
    GOOGLE_NOT_CONFIGURED: '구글 연결 준비 중입니다. 관리자에게 문의해 주세요.',
    GOOGLE_BUSY: '동기화 중입니다. 잠시 후 다시 시도해 주세요.',
    GOOGLE_PERMISSION_REQUIRED: '필요한 구글 권한이 없습니다. 계정을 다시 연결해 주세요.',
    INVALID_SERVICE: '연동 설정을 확인해 주세요.',
};
router.use((_req, res, next) => { res.set({ 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' }); next(); });
router.get('/start', async (req, res) => {
    try {
        const { url, browser } = await service.start(req.query.state, req.query.ticket);
        res.cookie(COOKIE, browser, cookieOptions());
        res.redirect(303, url);
    } catch { res.status(400).send('구글 연결을 다시 시작해 주세요.'); }
});
router.get('/callback', async (req, res) => {
    const browser = req.headers.cookie?.split(';').map(v => v.trim()).find(v => v.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1);
    let result = 'connected';
    try { await service.callback(req.query, browser); }
    catch { result = 'failed'; }
    res.clearCookie(COOKIE, { ...cookieOptions(), maxAge: undefined });
    if (!config().configured) return res.status(503).send('구글 연결 설정이 필요합니다.');
    const target = new URL(config().returnUrl);
    target.searchParams.set('google', result);
    res.redirect(303, target.toString());
});
router.use(verifyToken, (req, res, next) => {
    if (req.user.role !== 'owner') return res.status(403).json({ error: '구글 연동은 원장 계정에서 관리할 수 있습니다.' });
    next();
});
function route(handler) {
    return async (req, res) => {
        try { await handler(req, res, req.user.academyId ?? req.user.academy_id); }
        catch (error) { res.status([400, 403, 409].includes(error.status) ? error.status : 503).json({
            error: messages[error.code] || '구글 연결을 처리하지 못했습니다. 잠시 후 다시 시도해 주세요.' }); }
    };
}
router.get('/', route(async (_req, res, academyId) => res.json(await service.status(academyId))));
router.post('/authorize', route(async (req, res) => {
    const { url } = await service.authorize(req.user);
    res.json({ url });
}));
router.put('/services/:service', route(async (req, res, academyId) => {
    if (!req.body || Object.keys(req.body).some(k => k !== 'enabled')) return res.status(400).json({ error: '연동 설정을 확인해 주세요.' });
    res.json(await service.setService(academyId, req.params.service, req.body.enabled));
}));
router.delete('/', route(async (_req, res, academyId) => res.json(await service.disconnect(academyId))));
module.exports = router;
