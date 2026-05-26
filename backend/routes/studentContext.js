const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const peakPool = require('../config/peak-database');
const { verifyToken } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const { buildStudentContext } = require('../services/studentContextService');

router.get('/', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const query = String(req.query.q || '').trim();
    if (!query) {
      return res.status(400).json({
        error: 'Validation Error',
        message: '학생 이름이나 검색어를 입력해주세요.',
      });
    }
    const today = String(req.query.today || '').trim() || currentKstDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'today는 YYYY-MM-DD 형식이어야 합니다.',
      });
    }
    const periodDays = clampInt(req.query.period_days, 1, 60, 14);
    const startDate = addDays(today, -periodDays + 1);
    const lookup = await findStudent(academyId, query);
    if (lookup.matches.length > 1) {
      return res.status(409).json({
        error: 'Ambiguous Student',
        message: '학생이 여러 명 검색됐습니다. 이름이나 학교를 조금 더 정확히 알려주세요.',
        candidates: lookup.matches,
      });
    }
    const student = lookup.student;
    if (!student) {
      return res.status(404).json({
        error: 'Not Found',
        message: '해당 학생을 찾지 못했습니다.',
      });
    }

    const [attendanceRows, peakStudent] = await Promise.all([
      loadRecentAttendance(academyId, student.id, startDate, today),
      loadPeakStudent(academyId, student.id),
    ]);
    const recordRows = peakStudent ? await loadRecentRecordRows(academyId, peakStudent.id, today) : [];
    res.json(buildStudentContext({
      student,
      peakStudent,
      attendanceRows,
      recordRows,
      today,
      periodDays,
    }));
  } catch (error) {
    logger.error('Error fetching student context:', error);
    res.status(500).json({
      error: 'Server Error',
      message: '학생 컨텍스트를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

async function findStudent(academyId, query) {
  const [rows] = await pool.execute(
    `SELECT id, name, school, grade, gender, status, class_days, time_slot
     FROM students
     WHERE academy_id = ?
       AND deleted_at IS NULL
       AND status = 'active'`,
    [academyId],
  );
  const search = query.toLowerCase();
  const students = rows.map((student) => ({ ...student, name: student.name ? decrypt(student.name) : '' }));
  const exact = students.find((student) => String(student.id) === query || String(student.name || '').toLowerCase() === search);
  if (exact) return { student: exact, matches: [publicCandidate(exact)] };
  const matches = students
    .filter((student) => String(student.name || '').toLowerCase().includes(search))
    .slice(0, 5);
  return {
    student: matches.length === 1 ? matches[0] : null,
    matches: matches.map(publicCandidate),
  };
}

function publicCandidate(student) {
  return {
    paca_student_id: Number(student.id),
    name: student.name || '',
    school: student.school || '',
    grade: student.grade || '',
  };
}

async function loadRecentAttendance(academyId, studentId, startDate, endDate) {
  const [rows] = await pool.execute(
    `SELECT a.attendance_status, a.notes, cs.class_date, cs.time_slot
     FROM attendance a
     JOIN class_schedules cs ON a.class_schedule_id = cs.id
     WHERE cs.academy_id = ?
       AND a.student_id = ?
       AND cs.class_date BETWEEN ? AND ?
     ORDER BY cs.class_date DESC, FIELD(cs.time_slot, 'morning', 'afternoon', 'evening')`,
    [academyId, studentId, startDate, endDate],
  );
  return rows.slice(0, 20);
}

async function loadPeakStudent(academyId, pacaStudentId) {
  const [rows] = await peakPool.execute(
    `SELECT id, paca_student_id, status
     FROM students
     WHERE academy_id = ?
       AND paca_student_id = ?
       AND status = 'active'
     LIMIT 1`,
    [academyId, pacaStudentId],
  );
  return rows[0] || null;
}

async function loadRecentRecordRows(academyId, peakStudentId, endDate) {
  const [rows] = await peakPool.execute(
    `SELECT *
     FROM (
       SELECT sr.id, sr.student_id AS peak_student_id,
              sr.record_type_id, rt.name AS record_type_name, rt.unit, rt.direction,
              sr.measured_at, sr.value,
              ROW_NUMBER() OVER (
                PARTITION BY sr.record_type_id
                ORDER BY sr.measured_at DESC, sr.id DESC
              ) AS rn
       FROM student_records sr
       JOIN record_types rt ON rt.id = sr.record_type_id AND rt.academy_id = sr.academy_id
       WHERE sr.academy_id = ?
         AND sr.student_id = ?
         AND sr.measured_at <= ?
         AND rt.is_active = 1
     ) ranked
     WHERE rn <= 5`,
    [academyId, peakStudentId, endDate],
  );
  return rows;
}

function currentKstDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

module.exports = router;
