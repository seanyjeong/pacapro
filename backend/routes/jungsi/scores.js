const db = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { getDefaultExam } = require('./_config');
const { getJungsiLink } = require('./_settings');
const { fetchJungsiStudents } = require('./client');
const { formatScores, matchStudents } = require('./_students');

function isJungsiConfigError(error) {
  return error?.code === 'JUNGSI_JWT_SECRET_MISSING';
}

module.exports = function registerScoresRoutes(router) {
  router.get('/scores/:studentId', verifyToken, async (req, res) => {
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

      const studentId = Number(req.params.studentId);
      const { year = '2027' } = req.query;
      const exam = req.query.exam || getDefaultExam();
      const [students] = await db.query(
        `SELECT id, name, school, grade, academy_id
         FROM students
         WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
        [studentId, academyId]
      );

      if (students.length === 0) {
        return res.status(404).json({ success: false, message: '학생을 찾을 수 없습니다.' });
      }

      const student = students[0];
      const decryptedName = decrypt(student.name) || student.name;
      const jungsiStudents = await fetchJungsiStudents(link.branchName, year, exam);
      if (jungsiStudents.length === 0) {
        return res.json({
          success: true,
          matched: false,
          message: '정시엔진에 해당 지점 학생 데이터가 없습니다.',
          student: { id: student.id, name: decryptedName, school: student.school, grade: student.grade },
        });
      }

      const pacaStudent = { name: decryptedName, school: student.school, grade: student.grade };
      const { match, confidence, method } = matchStudents(pacaStudent, jungsiStudents);
      if (!match) {
        return res.json({
          success: true,
          matched: false,
          message: '정시엔진에서 일치하는 학생을 찾을 수 없습니다.',
          student: pacaStudent,
          searchInfo: { branchName: link.branchName, year, exam, totalStudentsInBranch: jungsiStudents.length },
        });
      }

      res.json({
        success: true,
        matched: true,
        confidence,
        matchMethod: method,
        student: {
          paca: { id: student.id, name: decryptedName, school: student.school, grade: student.grade },
          jungsi: {
            student_id: match.student_id,
            student_name: match.student_name,
            school_name: match.school_name,
            grade: match.grade,
          },
        },
        scores: formatScores(match.scores || {}, year, exam),
      });
    } catch (error) {
      logger.error('[Jungsi] 성적 조회 오류:', error);
      const status = isJungsiConfigError(error) ? 503 : 500;
      const message = isJungsiConfigError(error)
        ? '정시엔진 서버 연동 설정을 확인해주세요.'
        : '정시엔진 성적을 불러오지 못했습니다.';
      res.status(status).json({ success: false, message });
    }
  });
};
