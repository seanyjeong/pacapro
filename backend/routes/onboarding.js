/**
 * 온보딩 API 라우트
 */

const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const onboardingService = require('../services/onboardingService');
const logger = require('../utils/logger');

/** GET /paca/onboarding/status */
router.get('/status', verifyToken, async (req, res) => {
    try {
        const result = await onboardingService.getStatus(req.user.academyId);
        res.json(result);
    } catch (error) {
        logger.error('Get onboarding status error:', error);
        res.status(500).json({ error: 'Server Error', message: '온보딩 상태 확인에 실패했습니다.' });
    }
});

/** GET /paca/onboarding/data */
router.get('/data', verifyToken, async (req, res) => {
    try {
        const result = await onboardingService.getData(req.user.academyId);
        res.json(result);
    } catch (error) {
        logger.error('Get onboarding data error:', error);
        res.status(500).json({ error: 'Server Error', message: '온보딩 데이터 조회에 실패했습니다.' });
    }
});

/** POST /paca/onboarding/complete */
router.post('/complete', verifyToken, requireRole('owner'), async (req, res) => {
    try {
        const result = await onboardingService.complete(req.user.academyId, req.body);
        res.json(result);
    } catch (error) {
        logger.error('Complete onboarding error:', error);
        res.status(500).json({ error: 'Server Error', message: '온보딩 완료 처리에 실패했습니다.' });
    }
});

/** POST /paca/onboarding/sample-data */
router.post('/sample-data', verifyToken, requireRole('owner'), async (req, res) => {
    try {
        const result = await onboardingService.createSampleData(req.user.academyId);
        res.json(result);
    } catch (error) {
        logger.error('Create sample data error:', error);
        res.status(500).json({ error: 'Server Error', message: '샘플 데이터 생성에 실패했습니다.' });
    }
});

/** POST /paca/onboarding/skip */
router.post('/skip', verifyToken, requireRole('owner'), async (req, res) => {
    try {
        const result = await onboardingService.skip(req.user.academyId);
        res.json(result);
    } catch (error) {
        logger.error('Skip onboarding error:', error);
        res.status(500).json({ error: 'Server Error', message: '온보딩 건너뛰기에 실패했습니다.' });
    }
});

module.exports = router;
