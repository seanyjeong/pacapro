const {
  LINK_STATE_TTL_MS,
  createLinkState,
  getJungsiFrontendBase,
  getPacaApiBase,
  parseLinkState,
} = require('./_config');
const db = require('../../config/database');
const { verifyToken, requireRole } = require('../../middleware/auth');
const {
  getAcademySettings,
  getJungsiLinkFromSettings,
  saveJungsiLink,
  savePendingJungsiLink,
  clearJungsiLink,
} = require('./_settings');
const { verifyJungsiLoginToken } = require('./client');
const logger = require('../../utils/logger');

function buildLoginUrl(state) {
  const url = new URL(`${getJungsiFrontendBase()}/jungsilogin.html`);
  url.searchParams.set('redirect', 'welcome.html');
  url.searchParams.set('paca_link_state', state);
  url.searchParams.set('paca_link_callback', `${getPacaApiBase()}/jungsi/link/callback`);
  return url.toString();
}

module.exports = function registerAcademyLinkRoutes(router) {
  router.post('/link/start', verifyToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
      const academyId = req.user.academyId;
      const { state, stateHash } = createLinkState(academyId);
      const expiresAt = new Date(Date.now() + LINK_STATE_TTL_MS).toISOString();

      await savePendingJungsiLink(db, academyId, {
        stateHash,
        expiresAt,
        createdAt: new Date().toISOString(),
        createdByUserId: req.user.userId || req.user.id,
      });

      res.json({
        success: true,
        mode: 'jungsi_login',
        loginUrl: buildLoginUrl(state),
        expiresAt,
        message: '정시엔진 로그인 후 연동이 완료됩니다.',
      });
    } catch (error) {
      logger.error('[Jungsi] 연동 시작 오류:', error);
      res.status(500).json({
        success: false,
        message: '정시엔진 연동을 시작하지 못했습니다.',
      });
    }
  });

  router.post('/link/callback', async (req, res) => {
    try {
      const { state, token } = req.body || {};
      const parsedState = parseLinkState(state);
      if (!parsedState || !token) {
        return res.status(400).json({ success: false, message: '정시엔진 연동 정보가 올바르지 않습니다.' });
      }

      const settings = await getAcademySettings(db, parsedState.academyId);
      const link = getJungsiLinkFromSettings(settings);
      const pending = link.pending;
      if (!pending || pending.stateHash !== parsedState.stateHash || Date.now() > Date.parse(pending.expiresAt)) {
        return res.status(400).json({ success: false, message: '정시엔진 연동 요청이 만료되었습니다.' });
      }

      const jungsiUser = verifyJungsiLoginToken(token);
      if (!jungsiUser.branch) {
        return res.status(400).json({ success: false, message: '정시엔진 계정의 지점 정보를 확인할 수 없습니다.' });
      }

      await saveJungsiLink(db, parsedState.academyId, {
        branchName: jungsiUser.branch,
        jungsiUserId: jungsiUser.userid || jungsiUser.id || null,
        linkedAt: new Date().toISOString(),
        linkedByUserId: pending.createdByUserId,
      });

      res.json({
        success: true,
        branchName: jungsiUser.branch,
        message: '정시엔진 연동이 완료되었습니다.',
      });
    } catch (error) {
      logger.error('[Jungsi] 연동 callback 오류:', error);
      res.status(400).json({
        success: false,
        message: '정시엔진 로그인 정보를 확인하지 못했습니다.',
      });
    }
  });

  router.delete('/link', verifyToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
      await clearJungsiLink(db, req.user.academyId);
      res.json({ success: true, message: '정시엔진 연동이 해제되었습니다.' });
    } catch (error) {
      logger.error('[Jungsi] 연동 해제 오류:', error);
      res.status(500).json({ success: false, message: '정시엔진 연동 해제에 실패했습니다.' });
    }
  });
};
