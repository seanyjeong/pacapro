const db = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { getDefaultExam } = require('./_config');
const { getJungsiLink } = require('./_settings');
const { fetchJungsiStudents } = require('./client');
const { matchStudents } = require('./_students');

module.exports = function registerMatchPreviewRoutes(router) {
  router.get('/match-preview', verifyToken, async (req, res) => {
    try {
      const academyId = req.user.academyId;
      const link = await getJungsiLink(db, academyId);
      if (!link.branchName) {
        return res.status(400).json({
          success: false,
          linkRequired: true,
          message: '정시엔진 연동을 먼저 완료해주세요.',
        });
      }

      const { year = '2027' } = req.query;
      const exam = req.query.exam || getDefaultExam();
      const [pacaStudents] = await db.query(
        `SELECT id, name, school, grade
         FROM students
         WHERE academy_id = ?
           AND status IN ('active', 'paused')
           AND deleted_at IS NULL
         ORDER BY grade, name`,
        [academyId]
      );
      const jungsiStudents = await fetchJungsiStudents(link.branchName, year, exam);

      const results = pacaStudents.map((student) => {
        const decryptedName = decrypt(student.name) || student.name;
        const pacaStudent = { name: decryptedName, school: student.school, grade: student.grade };
        const { match, confidence, method } = matchStudents(pacaStudent, jungsiStudents);
        return {
          paca: { id: student.id, name: decryptedName, school: student.school, grade: student.grade },
          jungsi: match ? {
            student_id: match.student_id,
            student_name: match.student_name,
            school_name: match.school_name,
            grade: match.grade,
            hasScores: Boolean(match.scores && match.scores.국어_등급),
          } : null,
          matched: Boolean(match),
          confidence,
          matchMethod: method,
        };
      });

      res.json({
        success: true,
        branchName: link.branchName,
        year,
        exam,
        stats: {
          total: results.length,
          matched: results.filter((r) => r.matched).length,
          highConfidence: results.filter((r) => r.confidence === 'high').length,
          mediumConfidence: results.filter((r) => r.confidence === 'medium').length,
          lowConfidence: results.filter((r) => r.confidence === 'low').length,
          notMatched: results.filter((r) => !r.matched).length,
          jungsiTotal: jungsiStudents.length,
        },
        results,
      });
    } catch (error) {
      logger.error('[Jungsi] 매칭 미리보기 오류:', error);
      res.status(500).json({ success: false, message: '정시엔진 매칭 정보를 불러오지 못했습니다.' });
    }
  });
};
