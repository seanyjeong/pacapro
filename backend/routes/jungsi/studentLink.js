const db = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const logger = require('../../utils/logger');

module.exports = function registerStudentLinkRoutes(router) {
  router.post('/link', verifyToken, async (req, res) => {
    try {
      const { pacaStudentId, jungsiStudentId } = req.body;
      if (!pacaStudentId || !jungsiStudentId) {
        return res.status(400).json({
          success: false,
          message: '학생과 정시엔진 학생을 선택해주세요.',
        });
      }

      const [students] = await db.query(
        `SELECT id FROM students
         WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [pacaStudentId, req.user.academyId]
      );
      if (students.length === 0) {
        return res.status(404).json({ success: false, message: '학생을 찾을 수 없습니다.' });
      }

      await db.query(
        'UPDATE students SET jungsi_student_id = ? WHERE id = ?',
        [jungsiStudentId, pacaStudentId]
      );

      res.json({
        success: true,
        message: '정시엔진 학생 연결이 완료되었습니다.',
        pacaStudentId,
        jungsiStudentId,
      });
    } catch (error) {
      logger.error('[Jungsi] 학생 연결 오류:', error);
      res.status(500).json({ success: false, message: '정시엔진 학생 연결에 실패했습니다.' });
    }
  });
};
