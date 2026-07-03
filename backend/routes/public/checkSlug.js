const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');

// GET /paca/public/check-slug/:slug - slug 사용 가능 여부 확인
router.get('/check-slug/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    if (!/^[a-z0-9-]+$/.test(slug)) {
      return res.json({
        available: false,
        reason: 'invalid_format',
        message: '영문 소문자, 숫자, 하이픈(-)만 사용 가능합니다.'
      });
    }

    if (slug.length < 3 || slug.length > 50) {
      return res.json({
        available: false,
        reason: 'invalid_length',
        message: '3~50자 사이로 입력해주세요.'
      });
    }

    const [existing] = await db.query(
      'SELECT id FROM academies WHERE slug = ?',
      [slug]
    );

    res.json({
      available: existing.length === 0,
      reason: existing.length > 0 ? 'already_taken' : null,
      message: existing.length > 0 ? '이미 사용 중인 주소입니다.' : null
    });
  } catch (error) {
    logger.error('slug 확인 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
