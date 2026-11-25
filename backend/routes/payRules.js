/**
 * 강사 급여 규칙 — /paca/pay-rules
 *   GET    /?instructor_id= | ?season_id=     규칙 목록 { rules }
 *   POST   /                                  { instructor_id, pay_type, amount, start_date?, end_date?, time_slots?, taxable?, memo?, installments?, confirm_mismatch? }
 *   PUT    /:id , DELETE /:id
 *   POST   /season/:seasonId                  시즌 강사 규칙 { instructor_ids, amount, time_slots?, installments, start_date?, end_date? }
 *   POST   /season/:seasonId/sync             시즌 기간에 맞추기 { rule_ids }
 */
const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const logger = require('../utils/logger');
const { decrypt } = require('../utils/encryption');
const { verifyToken, requireRole, checkPermission } = require('../middleware/auth');
const { inTransaction } = require('../services/salaryService');
const service = require('../services/payRuleService');

const actor = req => ({ academyId: req.user.academyId, userId: req.user.userId });
const handle = (message, work) => async (req, res) => {
    try {
        await work(req, res);
    } catch (error) {
        if (error.status) return res.status(error.status).json(error.body);
        logger.error('Pay rule error:', error);
        res.status(500).json({ error: 'PAY_RULE_FAILED', message });
    }
};
const write = [verifyToken, requireRole('owner')];

router.get('/', verifyToken, checkPermission('salaries', 'view'), handle('급여 규칙을 불러오지 못했습니다.', async (req, res) => {
    const rules = await service.listRules(pool, req.user.academyId, {
        instructorId: Number(req.query.instructor_id) || null, seasonId: Number(req.query.season_id) || null
    });
    res.json({ rules: rules.map(rule => ({ ...rule, instructor_name: decrypt(rule.instructor_name) })) });
}));

router.post('/season/:seasonId', ...write, handle('시즌 강사 급여 규칙을 저장하지 못했습니다.', async (req, res) => {
    const ids = await inTransaction(pool, conn => service.createSeasonRules(conn, { ...actor(req), seasonId: req.params.seasonId, body: req.body }));
    res.status(201).json({ message: `시즌 강사 ${ids.length}명의 급여 규칙을 만들었습니다.`, rule_ids: ids });
}));

router.post('/season/:seasonId/sync', ...write, handle('급여 규칙 기간을 바꾸지 못했습니다.', async (req, res) => {
    const ruleIds = Array.isArray(req.body.rule_ids) ? req.body.rule_ids.map(Number) : [];
    const ids = await inTransaction(pool, conn => service.syncSeasonRules(conn, { ...actor(req), seasonId: req.params.seasonId, ruleIds }));
    res.json({ message: `급여 규칙 ${ids.length}개의 기간을 시즌에 맞췄습니다.`, rule_ids: ids });
}));

router.post('/', ...write, handle('급여 규칙을 저장하지 못했습니다.', async (req, res) => {
    const rule = service.ruleInput(req.body);
    const result = await inTransaction(pool, conn => service.createRule(conn, { ...actor(req), instructorId: req.body.instructor_id, rule }));
    res.status(201).json({ message: '급여 규칙을 저장했습니다.', ...result });
}));

router.put('/:id', ...write, handle('급여 규칙을 저장하지 못했습니다.', async (req, res) => {
    const rule = service.ruleInput(req.body);
    const result = await inTransaction(pool, conn => service.updateRule(conn, { ...actor(req), ruleId: req.params.id, rule }));
    res.json({ message: '급여 규칙을 저장했습니다.', ...result });
}));

router.delete('/:id', ...write, handle('급여 규칙을 삭제하지 못했습니다.', async (req, res) => {
    const result = await inTransaction(pool, conn => service.deleteRule(conn, { ...actor(req), ruleId: req.params.id }));
    res.json({ message: '급여 규칙을 삭제했습니다.', ...result });
}));

module.exports = router;
