const db = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const { EXAM_TYPES, getDefaultExam, getJungsiApiBase, getJungsiJwtSecret } = require('./_config');
const { getJungsiLink } = require('./_settings');
const { checkJungsiHealth } = require('./client');
const logger = require('../../utils/logger');

module.exports = function registerStatusRoutes(router) {
  router.get('/status', verifyToken, async (req, res) => {
    try {
      const academyId = req.user.academyId;
      const link = await getJungsiLink(db, academyId);
      const health = await checkJungsiHealth();
      const serviceTokenConfigured = Boolean(getJungsiJwtSecret());
      const connected = Boolean(link.branchName);

      res.json({
        success: true,
        academyId,
        branchName: link.branchName,
        isConfigured: connected,
        linkedAt: link.linkedAt,
        jungsiApi: {
          url: getJungsiApiBase(),
          healthy: health.healthy && serviceTokenConfigured,
          serviceTokenConfigured,
          healthCheckEndpoint: '/jungsi/public/schools/2027',
          error: serviceTokenConfigured ? health.error : '정시엔진 서버 연동 키가 설정되지 않았습니다.',
        },
        examTypes: EXAM_TYPES,
        defaultExam: getDefaultExam(),
        link: {
          required: !connected,
          mode: 'jungsi_login',
          linkedByUserId: link.linkedByUserId,
        },
      });
    } catch (error) {
      logger.error('[Jungsi] 상태 확인 오류:', error);
      res.status(500).json({ success: false, message: '정시엔진 상태를 확인하지 못했습니다.' });
    }
  });
};
