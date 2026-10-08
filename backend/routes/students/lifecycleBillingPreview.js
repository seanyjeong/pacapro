const pool = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { LinkError } = require('../../models/maxEngineError');
const service = require('../../services/studentLifecycleBillingService');
const logger = require('../../utils/logger');

module.exports = function registerLifecycleBillingPreview(router) {
  router.post('/:id/lifecycle-billing-preview', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    let conn;
    try {
      const studentId = Number(req.params.id);
      if (!Number.isSafeInteger(studentId) || studentId <= 0 || !['pause', 'withdraw'].includes(req.body.action)) {
        return res.status(422).json({ error: 'INVALID_INPUT', message: '학생 번호와 휴원·퇴원 처리 유형을 확인해 주세요.' });
      }
      conn = await pool.getConnection();
      await conn.query('SET TRANSACTION READ ONLY');
      await conn.beginTransaction();
      const [students] = await conn.execute(`SELECT id, name, academy_id, status, rest_start_date,
        rest_end_date, monthly_tuition, discount_rate, withdrawal_date FROM students
        WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`, [studentId, req.user.academyId]);
      if (!students.length) {
        return res.status(404).json({ error: 'NOT_FOUND', message: '학생 정보를 찾을 수 없습니다.' });
      }
      if (!['active', 'paused'].includes(students[0].status)) {
        return res.status(409).json({ error: 'STUDENT_STATUS', message: '재원·휴원 학생의 정산만 미리 확인할 수 있습니다.' });
      }
      const preview = await service.preview(conn, {
        academyId: req.user.academyId, studentId, userId: req.user.id, student: students[0],
        action: req.body.action, date: req.body.date,
        previousDate: students[0].status === 'paused' ? students[0].rest_start_date : null,
        creditType: req.body.credit_type || 'none', restEndDate: req.body.rest_end_date || null,
        sourcePaymentId: req.body.source_payment_id ?? null,
      });
      return res.json(preview);
    } catch (error) {
      if (error instanceof LinkError) return res.status(error.status).json({ error: error.code, message: error.message });
      logger.error('Student lifecycle billing preview failed:', error);
      return res.status(500).json({ error: 'PREVIEW_FAILED', message: '정산 금액을 불러오지 못했습니다. 다시 조회해 주세요.' });
    } finally {
      if (conn) {
        try { await conn.rollback(); } finally { conn.release(); }
      }
    }
  });
};
