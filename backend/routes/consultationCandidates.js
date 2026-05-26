const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const peakPool = require('../config/peak-database');
const { verifyToken } = require('../middleware/auth');
const { decrypt } = require('../utils/encryption');
const logger = require('../utils/logger');
const { buildConsultationCandidates } = require('../services/consultationCandidateService');

router.get('/', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academyId;
    const today = String(req.query.today || '').trim() || currentKstDate();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(today)) {
      return res.status(400).json({
        error: 'Validation Error',
        message: 'today는 YYYY-MM-DD 형식이어야 합니다.',
      });
    }

    const attendanceDays = clampInt(req.query.attendance_days, 1, 60, 14);
    const limit = clampInt(req.query.limit, 1, 50, 10);
    const startDate = addDays(today, -attendanceDays + 1);
    const [students, attendanceRows, peakStudents, recordRows] = await Promise.all([
      loadActiveStudents(academyId),
      loadAttendanceRows(academyId, startDate, today),
      loadPeakStudents(academyId),
      loadRecentRecordRows(academyId, today),
    ]);

    const result = buildConsultationCandidates({
      students: students.map((student) => ({
        ...student,
        name: student.name ? decrypt(student.name) : '',
      })),
      attendanceRows,
      peakStudents,
      recordRows,
      today,
      attendanceDays,
      limit,
    });

    res.json({
      message: `상담 후보 ${result.candidates.length}명`,
      ...result,
    });
  } catch (error) {
    logger.error('Error fetching consultation candidates:', error);
    res.status(500).json({
      error: 'Server Error',
      message: '상담 후보 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.',
    });
  }
});

async function loadActiveStudents(academyId) {
  const [rows] = await pool.execute(
    `SELECT id, name, school, grade, status
     FROM students
     WHERE academy_id = ?
       AND deleted_at IS NULL
       AND status = 'active'`,
    [academyId],
  );
  return rows;
}

async function loadAttendanceRows(academyId, startDate, endDate) {
  const [rows] = await pool.execute(
    `SELECT a.student_id, a.attendance_status, a.notes, cs.class_date, cs.time_slot
     FROM attendance a
     JOIN class_schedules cs ON a.class_schedule_id = cs.id
     WHERE cs.academy_id = ?
       AND cs.class_date BETWEEN ? AND ?
     ORDER BY cs.class_date ASC, FIELD(cs.time_slot, 'morning', 'afternoon', 'evening')`,
    [academyId, startDate, endDate],
  );
  return rows;
}

async function loadPeakStudents(academyId) {
  const [rows] = await peakPool.execute(
    `SELECT id, paca_student_id, status
     FROM students
     WHERE academy_id = ?
       AND status = 'active'`,
    [academyId],
  );
  return rows;
}

async function loadRecentRecordRows(academyId, endDate) {
  const [rows] = await peakPool.execute(
    `SELECT *
     FROM (
       SELECT sr.id, sr.student_id AS peak_student_id, ps.paca_student_id,
              sr.record_type_id, rt.name AS record_type_name, rt.unit, rt.direction,
              sr.measured_at, sr.value,
              ROW_NUMBER() OVER (
                PARTITION BY sr.student_id, sr.record_type_id
                ORDER BY sr.measured_at DESC, sr.id DESC
              ) AS rn
       FROM student_records sr
       JOIN students ps ON ps.id = sr.student_id AND ps.academy_id = sr.academy_id
       JOIN record_types rt ON rt.id = sr.record_type_id AND rt.academy_id = sr.academy_id
       WHERE sr.academy_id = ?
         AND sr.measured_at <= ?
         AND ps.status = 'active'
         AND rt.is_active = 1
     ) ranked
     WHERE rn <= 5`,
    [academyId, endDate],
  );
  return rows;
}

function currentKstDate() {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul' }).format(new Date());
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00+09:00`);
  date.setDate(date.getDate() + days);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function clampInt(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

module.exports = router;
