/**
 * Income Routes
 * 기타수입 API
 */

const express = require('express');
const router = express.Router();
const { verifyToken, checkPermission } = require('../middleware/auth');
const incomeService = require('../services/incomeService');
const logger = require('../utils/logger');

/** GET /paca/incomes */
router.get('/', verifyToken, checkPermission('incomes', 'view'), async (req, res) => {
    try {
        const result = await incomeService.getIncomes(req.user.academyId, req.query);
        res.json(result);
    } catch (error) {
        logger.error('Error fetching incomes:', error);
        res.status(500).json({ error: 'Server Error', message: '기타수입 내역을 불러오는데 실패했습니다.' });
    }
});

/** GET /paca/incomes/categories */
router.get('/categories', verifyToken, checkPermission('incomes', 'view'), (req, res) => {
    res.json({ categories: incomeService.CATEGORY_LABELS });
});

/** GET /paca/incomes/:id */
router.get('/:id', verifyToken, checkPermission('incomes', 'view'), async (req, res) => {
    try {
        const income = await incomeService.getIncomeById(parseInt(req.params.id), req.user.academyId);
        if (!income) {
            return res.status(404).json({ error: 'Not Found', message: '기타수입 내역을 찾을 수 없습니다.' });
        }
        res.json({ message: '기타수입 내역을 불러왔습니다.', income });
    } catch (error) {
        logger.error('Error fetching income:', error);
        res.status(500).json({ error: 'Server Error', message: '기타수입 내역을 불러오는데 실패했습니다.' });
    }
});

/** POST /paca/incomes */
router.post('/', verifyToken, checkPermission('incomes', 'edit'), async (req, res) => {
    try {
        const result = await incomeService.createIncome(req.user.academyId, req.user.id, req.body);
        if (result.status !== 201) {
            return res.status(result.status).json({ error: result.error, message: result.message });
        }
        res.status(201).json({ message: result.message, income: result.income });
    } catch (error) {
        logger.error('Error creating income:', error);
        res.status(500).json({ error: 'Server Error', message: '기타수입 등록에 실패했습니다.' });
    }
});

/** PUT /paca/incomes/:id */
router.put('/:id', verifyToken, checkPermission('incomes', 'edit'), async (req, res) => {
    try {
        const result = await incomeService.updateIncome(parseInt(req.params.id), req.user.academyId, req.body);
        if (result.status !== 200) {
            return res.status(result.status).json({ error: result.error, message: result.message });
        }
        res.json({ message: result.message, income: result.income });
    } catch (error) {
        logger.error('Error updating income:', error);
        res.status(500).json({ error: 'Server Error', message: '기타수입 수정에 실패했습니다.' });
    }
});

/** DELETE /paca/incomes/:id */
router.delete('/:id', verifyToken, checkPermission('incomes', 'edit'), async (req, res) => {
    try {
        const result = await incomeService.deleteIncome(parseInt(req.params.id), req.user.academyId);
        if (result.status !== 200) {
            return res.status(result.status).json({ error: result.error, message: result.message });
        }
        res.json({ message: result.message });
    } catch (error) {
        logger.error('Error deleting income:', error);
        res.status(500).json({ error: 'Server Error', message: '기타수입 삭제에 실패했습니다.' });
    }
});

module.exports = router;
