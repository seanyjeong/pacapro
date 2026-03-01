/**
 * Student Consultations API
 * 재원생 상담 기록 관리
 */

const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const peakPool = require('../config/peak-database');
const { decrypt } = require('../utils/encryption');
const { verifyToken } = require('../middleware/auth');
const logger = require('../utils/logger');

const safeJsonParse = (val) => {
  if (!val) return null;
  if (typeof val === 'object') return val;
  try { return JSON.parse(val); } catch { return null; }
};

// 암호화 필드 복호화 헬퍼 (calendar, detail 등에서 사용)
const decryptStudentFields = (student) => {  // eslint-disable-line no-unused-vars
  if (!student) return student;
  return {
    ...student,
    name: student.name ? decrypt(student.name) : student.name,
    phone: student.phone ? decrypt(student.phone) : student.phone,
    parent_phone: student.parent_phone ? decrypt(student.parent_phone) : student.parent_phone,
  };
};

/**
 * GET /student-consultations/calendar
 * 월별 상담 기록 조회 (캘린더용)
 */
router.get('/calendar', verifyToken, async (req, res) => {
  try {
    const academyId = req.user?.academy_id || 2;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: 'startDate, endDate 필수' });
    }

    const [consultations] = await pool.execute(
      `SELECT sc.id, sc.student_id, sc.consultation_date, sc.consultation_type,
              sc.general_memo, sc.academic_memo, sc.physical_memo, sc.target_memo,
              s.name as student_name, s.grade
       FROM student_consultations sc
       JOIN students s ON sc.student_id = s.id
       WHERE sc.academy_id = ?
         AND sc.consultation_date >= ?
         AND sc.consultation_date <= ?
       ORDER BY sc.consultation_date DESC`,
      [academyId, startDate, endDate]
    );

    // 학생 이름 복호화
    const decryptedConsultations = consultations.map(c => ({
      ...c,
      student_name: c.student_name ? decrypt(c.student_name) : c.student_name,
    }));

    res.json({ consultations: decryptedConsultations });
  } catch (error) {
    logger.error('Failed to get calendar consultations:', error);
    res.status(500).json({ error: '캘린더 상담 조회 실패' });
  }
});

/**
 * GET /student-consultations/:studentId
 * 학생별 상담 목록 조회
 */
router.get('/:studentId', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const academyId = req.user?.academy_id || 2;

    const [consultations] = await pool.execute(
      `SELECT sc.*,
              s.name as student_name, s.grade, s.gender, s.school
       FROM student_consultations sc
       JOIN students s ON sc.student_id = s.id
       WHERE sc.student_id = ? AND sc.academy_id = ?
       ORDER BY sc.consultation_date DESC`,
      [studentId, academyId]
    );

    // 학생 이름 복호화
    const decryptedConsultations = consultations.map(c => ({
      ...c,
      student_name: c.student_name ? decrypt(c.student_name) : c.student_name,
    }));

    // 신규상담 기록 조회 (consultations 테이블에서 linked_student_id로 연결된 건)
    const [initialConsultations] = await pool.execute(
      `SELECT id, consultation_type, learning_type, preferred_date, preferred_time,
              status, student_name, parent_name, parent_phone, student_grade,
              inquiry_content, consultation_memo, admin_notes,
              academic_scores, target_school, checklist, referral_sources,
              created_at
       FROM consultations
       WHERE linked_student_id = ? AND academy_id = ?
       ORDER BY preferred_date DESC`,
      [studentId, academyId]
    );

    // 신규상담 암호화 필드 복호화 + JSON 파싱
    const decryptedInitialConsultations = initialConsultations.map(c => ({
      ...c,
      student_name: c.student_name ? decrypt(c.student_name) : c.student_name,
      parent_name: undefined,
      parent_phone: undefined,
      academic_scores: safeJsonParse(c.academic_scores),
      checklist: safeJsonParse(c.checklist),
      referral_sources: safeJsonParse(c.referral_sources),
    }));

    res.json({
      consultations: decryptedConsultations,
      initialConsultations: decryptedInitialConsultations,
    });
  } catch (error) {
    logger.error('Failed to get student consultations:', error);
    res.status(500).json({ error: '상담 목록 조회 실패' });
  }
});

/**
 * GET /student-consultations/:studentId/peak-records
 * P-EAK 실기 기록 조회
 * 주의: /:studentId/:id 보다 먼저 정의해야 함!
 */
router.get('/:studentId/peak-records', verifyToken, async (req, res) => {
  try {
    const { studentId } = req.params;
    const { type = 'latest', date } = req.query; // type: 'latest' or 'average'
    const academyId = req.user?.academy_id || 2;

    // P-EAK DB에서 학생 찾기 (paca_student_id로 매칭)
    const [peakStudents] = await peakPool.execute(
      `SELECT id FROM students WHERE paca_student_id = ? AND academy_id = ?`,
      [studentId, academyId]
    );

    if (peakStudents.length === 0) {
      return res.json({
        found: false,
        message: 'P-EAK에서 학생을 찾을 수 없습니다',
        records: {},
      });
    }

    const peakStudentId = peakStudents[0].id;

    // record_types 조회
    const [recordTypes] = await peakPool.execute(
      `SELECT id, name, short_name, unit, direction FROM record_types WHERE academy_id = ? AND is_active = 1`,
      [academyId]
    );

    const records = {};

    if (type === 'latest') {
      // 최근 기록 조회
      for (const rt of recordTypes) {
        const [latestRecord] = await peakPool.execute(
          `SELECT value, measured_at FROM student_records
           WHERE student_id = ? AND record_type_id = ?
           ${date ? 'AND measured_at <= ?' : ''}
           ORDER BY measured_at DESC LIMIT 1`,
          date ? [peakStudentId, rt.id, date] : [peakStudentId, rt.id]
        );

        if (latestRecord.length > 0) {
          records[rt.short_name || rt.name] = {
            value: parseFloat(latestRecord[0].value),
            unit: rt.unit,
            direction: rt.direction,
            measured_at: latestRecord[0].measured_at,
          };
        }
      }
    } else {
      // 평균 기록 조회
      for (const rt of recordTypes) {
        const [avgRecord] = await peakPool.execute(
          `SELECT AVG(value) as avg_value, MAX(measured_at) as last_measured
           FROM student_records
           WHERE student_id = ? AND record_type_id = ?
           ${date ? 'AND measured_at <= ?' : ''}`,
          date ? [peakStudentId, rt.id, date] : [peakStudentId, rt.id]
        );

        if (avgRecord.length > 0 && avgRecord[0].avg_value !== null) {
          records[rt.short_name || rt.name] = {
            value: Math.round(parseFloat(avgRecord[0].avg_value) * 100) / 100,
            unit: rt.unit,
            direction: rt.direction,
            measured_at: avgRecord[0].last_measured,
            isAverage: true,
          };
        }
      }
    }

    res.json({
      found: true,
      type,
      records,
    });
  } catch (error) {
    logger.error('Failed to get P-EAK records:', error);
    // P-EAK 연결 실패 시 빈 결과 반환 (폴백)
    res.json({
      found: false,
      error: 'P-EAK 연동 오류',
      records: {},
    });
  }
});

/**
 * GET /student-consultations/:studentId/compare/:id
 * 이전 상담 대비 변화량 조회
 * 주의: /:studentId/:id 보다 먼저 정의해야 함!
 */
router.get('/:studentId/compare/:id', verifyToken, async (req, res) => {
  try {
    const { studentId, id } = req.params;
    const academyId = req.user?.academy_id || 2;

    // 현재 상담 조회
    const [current] = await pool.execute(
      `SELECT * FROM student_consultations
       WHERE id = ? AND student_id = ? AND academy_id = ?`,
      [id, studentId, academyId]
    );

    if (current.length === 0) {
      return res.status(404).json({ error: '상담 기록을 찾을 수 없습니다' });
    }

    // 이전 상담 조회 (현재 상담 날짜 이전의 가장 최근 상담)
    const [previous] = await pool.execute(
      `SELECT * FROM student_consultations
       WHERE student_id = ? AND academy_id = ?
         AND consultation_date < ?
       ORDER BY consultation_date DESC
       LIMIT 1`,
      [studentId, academyId, current[0].consultation_date]
    );

    if (previous.length === 0) {
      return res.json({
        hasPrevious: false,
        message: '이전 상담 기록이 없습니다',
      });
    }

    const prev = previous[0];
    const curr = current[0];

    // 변화량 계산
    const changes = {
      hasPrevious: true,
      previousDate: prev.consultation_date,

      // 내신 변화
      gradeChange: null,

      // 모의고사 변화
      mockTestChanges: {},

      // 실기 변화
      physicalChanges: {},
    };

    // 내신 변화 계산
    if (prev.school_grade_avg && curr.school_grade_avg) {
      const diff = parseFloat(prev.school_grade_avg) - parseFloat(curr.school_grade_avg);
      changes.gradeChange = {
        previous: parseFloat(prev.school_grade_avg),
        current: parseFloat(curr.school_grade_avg),
        diff: Math.round(diff * 100) / 100,
        improved: diff > 0, // 등급은 낮을수록 좋음
      };
    }

    // 모의고사 변화 계산
    const prevScores = prev.mock_test_scores ? JSON.parse(prev.mock_test_scores) : {};
    const currScores = curr.mock_test_scores ? JSON.parse(curr.mock_test_scores) : {};

    ['march', 'june', 'september'].forEach(month => {
      if (prevScores[month] && currScores[month]) {
        ['korean', 'math', 'english', 'exploration1', 'exploration2'].forEach(subject => {
          if (prevScores[month][subject] && currScores[month][subject]) {
            const prevVal = prevScores[month][subject].percentile || prevScores[month][subject].grade;
            const currVal = currScores[month][subject].percentile || currScores[month][subject].grade;

            if (prevVal && currVal) {
              const key = `${month}_${subject}`;
              const diff = currVal - prevVal;
              changes.mockTestChanges[key] = {
                previous: prevVal,
                current: currVal,
                diff: diff,
                improved: subject === 'english' ? diff < 0 : diff > 0, // 영어 등급은 낮을수록 좋음
              };
            }
          }
        });
      }
    });

    // 실기 변화 계산
    const prevPhysical = prev.physical_records ? JSON.parse(prev.physical_records) : {};
    const currPhysical = curr.physical_records ? JSON.parse(curr.physical_records) : {};

    Object.keys(currPhysical).forEach(key => {
      if (prevPhysical[key] && currPhysical[key]) {
        const diff = parseFloat(currPhysical[key].value) - parseFloat(prevPhysical[key].value);
        changes.physicalChanges[key] = {
          previous: prevPhysical[key].value,
          current: currPhysical[key].value,
          diff: Math.round(diff * 100) / 100,
          improved: prevPhysical[key].direction === 'higher' ? diff > 0 : diff < 0,
        };
      }
    });

    res.json(changes);
  } catch (error) {
    logger.error('Failed to compare consultations:', error);
    res.status(500).json({ error: '상담 비교 실패' });
  }
});

/**
 * GET /student-consultations/:studentId/:id
 * 상담 상세 조회
 */
router.get('/:studentId/:id', verifyToken, async (req, res) => {
  try {
    const { studentId, id } = req.params;
    const academyId = req.user?.academy_id || 2;

    const [rows] = await pool.execute(
      `SELECT sc.*,
              s.name as student_name, s.grade, s.gender, s.school, s.student_type
       FROM student_consultations sc
       JOIN students s ON sc.student_id = s.id
       WHERE sc.id = ? AND sc.student_id = ? AND sc.academy_id = ?`,
      [id, studentId, academyId]
    );

    if (rows.length === 0) {
      return res.status(404).json({ error: '상담 기록을 찾을 수 없습니다' });
    }

    const consultation = {
      ...rows[0],
      student_name: rows[0].student_name ? decrypt(rows[0].student_name) : rows[0].student_name,
    };

    res.json({ consultation });
  } catch (error) {
    logger.error('Failed to get consultation detail:', error);
    res.status(500).json({ error: '상담 상세 조회 실패' });
  }
});

/**
 * POST /student-consultations
 * 상담 생성
 */
router.post('/', verifyToken, async (req, res) => {
  try {
    const academyId = req.user?.academy_id || 2;
    const createdBy = req.user?.id;

    const {
      student_id,
      consultation_id,
      consultation_date,
      consultation_type,
      admission_type,
      school_grade_avg,
      mock_test_scores,
      academic_memo,
      physical_record_type,
      physical_records,
      physical_memo,
      target_university_1,
      target_university_2,
      target_memo,
      general_memo,
    } = req.body;

    if (!student_id || !consultation_date || !consultation_type) {
      return res.status(400).json({ error: '필수 필드가 누락되었습니다' });
    }

    const [result] = await pool.execute(
      `INSERT INTO student_consultations (
        academy_id, student_id, consultation_id, consultation_date,
        consultation_type, admission_type,
        school_grade_avg, mock_test_scores, academic_memo,
        physical_record_type, physical_records, physical_memo,
        target_university_1, target_university_2, target_memo,
        general_memo, created_by
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        academyId,
        student_id,
        consultation_id || null,
        consultation_date,
        consultation_type,
        admission_type || 'early',
        school_grade_avg || null,
        mock_test_scores ? JSON.stringify(mock_test_scores) : null,
        academic_memo || null,
        physical_record_type || 'latest',
        physical_records ? JSON.stringify(physical_records) : null,
        physical_memo || null,
        target_university_1 || null,
        target_university_2 || null,
        target_memo || null,
        general_memo || null,
        createdBy || null,
      ]
    );

    // 연결된 consultations 상태 업데이트 (있는 경우)
    if (consultation_id) {
      await pool.execute(
        `UPDATE consultations SET status = 'completed' WHERE id = ?`,
        [consultation_id]
      );
    }

    res.status(201).json({
      message: '상담 기록이 저장되었습니다',
      id: result.insertId,
    });
  } catch (error) {
    logger.error('Failed to create consultation:', error);
    res.status(500).json({ error: '상담 저장 실패' });
  }
});

/**
 * PUT /student-consultations/:id
 * 상담 수정
 */
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user?.academy_id || 2;

    const {
      consultation_date,
      consultation_type,
      admission_type,
      school_grade_avg,
      mock_test_scores,
      academic_memo,
      physical_record_type,
      physical_records,
      physical_memo,
      target_university_1,
      target_university_2,
      target_memo,
      general_memo,
    } = req.body;

    await pool.execute(
      `UPDATE student_consultations SET
        consultation_date = ?,
        consultation_type = ?,
        admission_type = ?,
        school_grade_avg = ?,
        mock_test_scores = ?,
        academic_memo = ?,
        physical_record_type = ?,
        physical_records = ?,
        physical_memo = ?,
        target_university_1 = ?,
        target_university_2 = ?,
        target_memo = ?,
        general_memo = ?
       WHERE id = ? AND academy_id = ?`,
      [
        consultation_date,
        consultation_type,
        admission_type || 'early',
        school_grade_avg || null,
        mock_test_scores ? JSON.stringify(mock_test_scores) : null,
        academic_memo || null,
        physical_record_type || 'latest',
        physical_records ? JSON.stringify(physical_records) : null,
        physical_memo || null,
        target_university_1 || null,
        target_university_2 || null,
        target_memo || null,
        general_memo || null,
        id,
        academyId,
      ]
    );

    res.json({ message: '상담 기록이 수정되었습니다' });
  } catch (error) {
    logger.error('Failed to update consultation:', error);
    res.status(500).json({ error: '상담 수정 실패' });
  }
});

/**
 * DELETE /student-consultations/:id
 * 상담 삭제
 */
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user?.academy_id || 2;

    await pool.execute(
      `DELETE FROM student_consultations WHERE id = ? AND academy_id = ?`,
      [id, academyId]
    );

    res.json({ message: '상담 기록이 삭제되었습니다' });
  } catch (error) {
    logger.error('Failed to delete consultation:', error);
    res.status(500).json({ error: '상담 삭제 실패' });
  }
});

module.exports = router;
