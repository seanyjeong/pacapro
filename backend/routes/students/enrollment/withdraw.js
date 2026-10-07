const pool = require('../../../config/database');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const billingService = require('../../../services/studentLifecycleBillingService');
const { getKoreaDateText, resolveProratedPaymentDueDate } = require('../../../utils/proratedPaymentDueDate');

module.exports = function registerWithdrawal(router) {
  router.post('/:id/withdraw', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = Number(req.params.id), { reason, withdrawal_date } = req.body;
    const academyId = req.user.academyId, today = getKoreaDateText();
    let date, conn;
    try {
      date = resolveProratedPaymentDueDate(withdrawal_date || today);
      if (!Number.isSafeInteger(studentId) || studentId < 1 || date > today ||
          (reason != null && (typeof reason !== 'string' || reason.length > 255))) throw new TypeError('invalid withdrawal');
    } catch {
      return res.status(400).json({ error: 'Bad Request', message: '학생 번호와 오늘까지의 퇴원일, 255자 이내 사유를 확인해주세요.' });
    }
    try {
      conn = await pool.getConnection();
      await conn.beginTransaction();
      const [students] = await conn.execute(`SELECT id,name,status FROM students
        WHERE id=? AND academy_id=? AND deleted_at IS NULL FOR UPDATE`, [studentId, academyId]);
      if (!students.length) {
        await conn.rollback();
        return res.status(404).json({ error: 'Not Found', message: '학생 정보를 찾을 수 없습니다.' });
      }
      if (students[0].status === 'withdrawn') {
        await conn.rollback();
        return res.status(400).json({ error: 'Bad Request', message: '이미 퇴원 처리된 학생입니다.' });
      }
      const billing = await billingService.withdraw(conn, { studentId, academyId,
        userId: req.user.id ?? req.user.userId, date, reason: reason || '퇴원 처리' });
      await conn.execute(`UPDATE students SET status='withdrawn',withdrawal_date=?,withdrawal_reason=?,updated_at=NOW()
        WHERE id=? AND academy_id=?`, [date, reason || null, studentId, academyId]);
      // Same attendance policy as before; the academy join prevents cross-academy deletion.
      await conn.execute(`DELETE a FROM attendance a JOIN class_schedules cs ON a.class_schedule_id=cs.id
        WHERE a.student_id=? AND cs.academy_id=?
        AND (cs.class_date=? OR (cs.class_date>? AND a.attendance_status IS NULL))`,
      [studentId, academyId, today, today]);
      await conn.commit();
      return res.json({ message: '퇴원 처리되었습니다', billing,
        student: { id: studentId, name: students[0].name, status: 'withdrawn',
          withdrawal_date: date, withdrawal_reason: reason } });
    } catch (error) {
      if (conn) await conn.rollback();
      logger.error('Error withdrawing student:', error);
      return res.status(500).json({ error: 'Server Error', message: '퇴원 처리에 실패했습니다. 잠시 후 다시 시도해주세요.' });
    } finally { if (conn) conn.release(); }
  });
};
