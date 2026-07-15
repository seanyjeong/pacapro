const db = require('../../config/database');
const { verifyToken } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { fetchRosters, findUniqueStudent, prioritizeBranches } = require('./_autoDiscovery');
const { EXAM_TYPES, getDefaultExam } = require('./_config');
const { formatScores } = require('./_students');
const { fetchJungsiBranches, fetchJungsiStudents } = require('./client');

const DEFAULT_ACADEMIC_YEAR = '2027';

function validYear(value) {
  const year = String(value || DEFAULT_ACADEMIC_YEAR);
  const number = Number(year);
  return /^\d{4}$/.test(year) && number >= 2026 && number <= 2030 ? year : null;
}

function pacaStudent(row) {
  return {
    grade: row.grade,
    jungsiStudentId: row.jungsi_student_id,
    name: decrypt(row.name) || row.name,
    school: row.school,
  };
}

function missingResponse(res, academyId, branchName) {
  return res.json({
    academyId,
    branchName: branchName || null,
    matched: false,
    message: '학원에 제출된 정시 성적표가 없습니다.',
    success: true,
  });
}

module.exports = function registerFamilyScoresRoutes(router) {
  router.get('/family-scores/:studentId', verifyToken, async (req, res) => {
    if (!req.user?.isSourceReadService) {
      return res.status(403).json({ success: false, message: '가족 조회 권한을 확인할 수 없습니다.' });
    }

    const academyId = Number(req.user.academyId);
    const studentId = Number(req.params.studentId);
    const year = validYear(req.query.year);
    const exam = String(req.query.exam || getDefaultExam());
    if (!Number.isSafeInteger(studentId) || studentId <= 0 || !year || !EXAM_TYPES.includes(exam)) {
      return res.status(400).json({ success: false, message: '성적 조회 기준을 확인해주세요.' });
    }

    try {
      const [students] = await db.query(
        `SELECT s.id, s.name, s.school, s.grade, s.academy_id, s.jungsi_student_id,
                a.name AS academy_name
         FROM students s
         JOIN academies a ON a.id = s.academy_id
         WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
        [studentId, academyId]
      );
      if (students.length === 0) {
        return res.status(404).json({ success: false, message: '학생 정보를 확인할 수 없습니다.' });
      }

      const sourceStudent = pacaStudent(students[0]);
      const branches = await fetchJungsiBranches();
      const priority = prioritizeBranches(students[0].academy_name, branches);
      if (priority.candidates.length === 0) return missingResponse(res, academyId, null);

      const rosters = await fetchRosters(priority.candidates, year, exam, fetchJungsiStudents);
      const found = findUniqueStudent(sourceStudent, rosters);
      const branchName = found?.branchName
        || (priority.confidence === 'academy-name' ? priority.candidates[0] : null);
      if (!found || !found.student.scores) return missingResponse(res, academyId, branchName);

      return res.json({
        academyId,
        branchName: found.branchName,
        matched: true,
        matchMethod: found.method,
        scores: formatScores(found.student.scores, year, exam),
        student: {
          jungsi: {
            grade: found.student.grade,
            school_name: found.student.school_name,
            student_id: found.student.student_id,
            student_name: found.student.student_name,
          },
          paca: {
            grade: students[0].grade,
            id: students[0].id,
            name: sourceStudent.name,
            school: students[0].school,
          },
        },
        success: true,
      });
    } catch (error) {
      logger.error('[Jungsi] MAX LINK 가족 성적 조회 오류:', error);
      return res.status(503).json({ success: false, message: '정시 성적을 잠시 불러오지 못했습니다.' });
    }
  });
};
