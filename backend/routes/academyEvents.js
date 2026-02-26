/**
 * Academy Event Routes
 * 학원 일정 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middleware/auth');
const academyEventService = require('../services/academyEventService');
const logger = require('../utils/logger');

/** GET /paca/academy-events */
router.get('/', verifyToken, async (req, res) => {
    try {
        const result = await academyEventService.getEvents(req.user.academyId, req.query);
        res.json(result);
    } catch (error) {
        logger.error('Error fetching academy events:', error);
        res.status(500).json({ message: '학원 일정 조회 실패', error: error.message });
    }
});

/** GET /paca/academy-events/:id */
router.get('/:id', verifyToken, async (req, res) => {
    try {
        const event = await academyEventService.getEventById(req.params.id, req.user.academyId);
        if (!event) {
            return res.status(404).json({ message: '일정을 찾을 수 없습니다.' });
        }
        res.json({ event });
    } catch (error) {
        logger.error('Error fetching academy event:', error);
        res.status(500).json({ message: '학원 일정 조회 실패', error: error.message });
    }
});

/** POST /paca/academy-events */
router.post('/', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const result = await academyEventService.createEvent(req.user.academyId, req.user.id, req.body);
        if (result.status !== 201) {
            return res.status(result.status).json({ message: result.message });
        }
        res.status(201).json({ message: result.message, event: result.event });
    } catch (error) {
        logger.error('Error creating academy event:', error);
        res.status(500).json({ message: '학원 일정 등록 실패', error: error.message });
    }
});

/** PUT /paca/academy-events/:id */
router.put('/:id', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const result = await academyEventService.updateEvent(req.params.id, req.user.academyId, req.body);
        if (result.status !== 200) {
            return res.status(result.status).json({ message: result.message });
        }
        res.json({ message: result.message, event: result.event });
    } catch (error) {
        logger.error('Error updating academy event:', error);
        res.status(500).json({ message: '학원 일정 수정 실패', error: error.message });
    }
});

/** DELETE /paca/academy-events/:id */
router.delete('/:id', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const result = await academyEventService.deleteEvent(req.params.id, req.user.academyId);
        if (result.status !== 200) {
            return res.status(result.status).json({ message: result.message });
        }
        res.json({ message: result.message });
    } catch (error) {
        logger.error('Error deleting academy event:', error);
        res.status(500).json({ message: '학원 일정 삭제 실패', error: error.message });
    }
});

module.exports = router;
