/**
 * Branch Routes
 * 지점·반 관리와 학생 배정 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middleware/auth');
const branchService = require('../services/branchService');
const logger = require('../utils/logger');

const respond = (label, work) => async (req, res) => {
    try {
        const { status = 200, ...body } = await work(req);
        res.status(status).json(body);
    } catch (error) {
        logger.error(`Error ${label}:`, error);
        res.status(500).json({ message: '지점·반 정보를 처리하지 못했습니다. 잠시 후 다시 시도해주세요.' });
    }
};

/** GET /paca/branches — 지점·반 목록과 학생 수 */
router.get('/', verifyToken, respond('fetching branches', req => branchService.getTree(req.user.academyId)));

/** PUT /paca/branches/students — 학생 여러 명의 지점·반 배정 */
router.put('/students', verifyToken, checkPermission('students', 'edit'),
    respond('assigning students', req => branchService.assignStudents(req.user.academyId, req.body)));

/** PUT /paca/branches/classes/:classId */
router.put('/classes/:classId', verifyToken, checkPermission('settings', 'edit'),
    respond('updating class', req => branchService.updateClass(req.params.classId, req.user.academyId, req.body)));

/** DELETE /paca/branches/classes/:classId */
router.delete('/classes/:classId', verifyToken, checkPermission('settings', 'edit'),
    respond('deleting class', req => branchService.deleteClass(req.params.classId, req.user.academyId)));

/** POST /paca/branches */
router.post('/', verifyToken, checkPermission('settings', 'edit'),
    respond('creating branch', req => branchService.createBranch(req.user.academyId, req.body)));

/** POST /paca/branches/:id/classes */
router.post('/:id/classes', verifyToken, checkPermission('settings', 'edit'),
    respond('creating class', req => branchService.createClass(req.params.id, req.user.academyId, req.body)));

/** PUT /paca/branches/:id */
router.put('/:id', verifyToken, checkPermission('settings', 'edit'),
    respond('updating branch', req => branchService.updateBranch(req.params.id, req.user.academyId, req.body)));

/** DELETE /paca/branches/:id */
router.delete('/:id', verifyToken, checkPermission('settings', 'edit'),
    respond('deleting branch', req => branchService.deleteBranch(req.params.id, req.user.academyId)));

module.exports = router;
