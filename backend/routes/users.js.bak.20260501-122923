/**
 * User Routes
 * 사용자 관리 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken, requireRole } = require('../middleware/auth');
const userService = require('../services/userService');
const logger = require('../utils/logger');

/** GET /paca/users/pending */
router.get('/pending', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await userService.getPendingUsers(req.user.academyId);
        res.json(result);
    } catch (error) {
        logger.error('Error fetching pending users:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch pending users' });
    }
});

/** POST /paca/users/approve/:id */
router.post('/approve/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await userService.changeApprovalStatus(parseInt(req.params.id), req.user.academyId, 'approved');
        if (result.status !== 200) {
            return res.status(result.status).json({ error: result.error, message: result.message });
        }
        res.json({ message: result.message, user: result.user });
    } catch (error) {
        logger.error('Error approving user:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to approve user' });
    }
});

/** POST /paca/users/reject/:id */
router.post('/reject/:id', verifyToken, requireRole('admin'), async (req, res) => {
    try {
        const result = await userService.changeApprovalStatus(parseInt(req.params.id), req.user.academyId, 'rejected');
        if (result.status !== 200) {
            return res.status(result.status).json({ error: result.error, message: result.message });
        }
        res.json({ message: result.message, user: result.user });
    } catch (error) {
        logger.error('Error rejecting user:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to reject user' });
    }
});

/** GET /paca/users */
router.get('/', verifyToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const result = await userService.getUsers(req.user.academyId, req.query);
        res.json(result);
    } catch (error) {
        logger.error('Error fetching users:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch users' });
    }
});

/** GET /paca/users/:id */
router.get('/:id', verifyToken, requireRole('owner', 'admin'), async (req, res) => {
    try {
        const user = await userService.getUserById(parseInt(req.params.id), req.user.academyId);
        if (!user) {
            return res.status(404).json({ error: 'Not Found', message: 'User not found' });
        }
        res.json({ user });
    } catch (error) {
        logger.error('Error fetching user:', error);
        res.status(500).json({ error: 'Server Error', message: 'Failed to fetch user' });
    }
});

module.exports = router;
