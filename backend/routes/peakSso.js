const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken } = require('../middleware/auth');
const { createPeakSsoCode } = require('../utils/peakSso');

const PEAK_FRONTEND_URL = process.env.PEAK_FRONTEND_URL || 'https://peak-rose.vercel.app';

router.post('/code', verifyToken, async (req, res) => {
  try {
    const { code, ttlSeconds } = await createPeakSsoCode(db, req.user);
    const peakUrl = `${PEAK_FRONTEND_URL}/login?code=${encodeURIComponent(code)}`;

    res.json({
      success: true,
      code,
      peakUrl,
      expiresIn: ttlSeconds,
    });
  } catch (error) {
    console.error('[Peak SSO] code create failed:', error.message);
    res.status(500).json({
      error: 'Internal Server Error',
      message: '피크 자동 로그인을 준비하지 못했습니다.',
    });
  }
});

module.exports = router;
