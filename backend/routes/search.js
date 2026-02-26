/**
 * Search Routes
 * 통합 검색 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken } = require('../middleware/auth');
const { search } = require('../services/searchService');
const logger = require('../utils/logger');

/**
 * GET /paca/search
 * 학생, 강사, 전화번호 통합 검색
 * Access: 로그인 사용자
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.trim().length < 1) {
            return res.json({
                message: '검색어를 입력해주세요.',
                results: []
            });
        }

        const result = await search(q, req.user.academyId);
        res.json(result);
    } catch (error) {
        logger.error('Search error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '검색에 실패했습니다.'
        });
    }
});

module.exports = router;
