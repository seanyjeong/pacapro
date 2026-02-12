const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkPermission } = require('../middleware/auth');
const { decrypt, encrypt } = require('../utils/encryption');
const { sendAlimtalkSolapi } = require('../utils/solapi');
const { decryptApiKey, sendAlimtalk: sendAlimtalkSens } = require('../utils/naverSens');
const logger = require('../utils/logger');

// 암호화 키 (환경변수에서 가져옴)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

// 이름 필드 복호화 헬퍼
function decryptConsultationNames(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.parent_name) obj.parent_name = decrypt(obj.parent_name);
    if (obj.parent_phone) obj.parent_phone = decrypt(obj.parent_phone);
    if (obj.student_phone) obj.student_phone = decrypt(obj.student_phone);
    if (obj.linked_student_name) obj.linked_student_name = decrypt(obj.linked_student_name);
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}
function decryptConsultationArray(arr) {
    return arr.map(item => decryptConsultationNames({...item}));
}

// 학생 이름/전화번호 복호화 헬퍼
function decryptStudentInfo(student) {
    if (!student) return student;
    if (student.name) student.name = decrypt(student.name);
    if (student.phone) student.phone = decrypt(student.phone);
    if (student.parent_phone) student.parent_phone = decrypt(student.parent_phone);
    return student;
}

/**
 * 예약번호 생성 (C + YYYYMMDD + 3자리 일련번호)
 * 예: C20251215001
 */
async function generateReservationNumber() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `C${dateStr}`;

    // 오늘 날짜의 마지막 예약번호 조회
    const [rows] = await db.query(
        `SELECT reservation_number FROM consultations
         WHERE reservation_number LIKE ?
         ORDER BY reservation_number DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let seq = 1;
    if (rows.length > 0 && rows[0].reservation_number) {
        const lastSeq = parseInt(rows[0].reservation_number.slice(-3));
        seq = lastSeq + 1;
    }

    return `${prefix}${seq.toString().padStart(3, '0')}`;
}

/**
 * 상담확정 알림톡 발송 (service_type에 따라 솔라피/SENS 선택)
 */
async function sendConfirmationAlimtalk(consultation, academyId) {
    try {
        const { student_name, parent_phone, preferred_date, preferred_time, reservation_number } = consultation;

        // 알림 설정 조회 (service_type 포함)
        const [settings] = await db.query(
            `SELECT service_type,
                    solapi_api_key, solapi_api_secret, solapi_pfid, solapi_sender_phone,
                    solapi_consultation_template_id, solapi_consultation_template_content,
                    solapi_consultation_buttons, solapi_consultation_image_url,
                    naver_access_key, naver_secret_key, naver_service_id, kakao_channel_id,
                    sens_consultation_template_code, sens_consultation_template_content,
                    sens_consultation_buttons, sens_consultation_image_url
             FROM notification_settings WHERE academy_id = ?`,
            [academyId]
        );

        if (settings.length === 0) {
            logger.info('[ConsultationAlimtalk] 알림 설정 없음');
            return false;
        }

        const setting = settings[0];
        const serviceType = setting.service_type || 'solapi';

        // 복호화
        const name = decrypt(student_name) || student_name;
        const phone = decrypt(parent_phone) || parent_phone;

        // 날짜 포맷 (2025년 12월 15일)
        const date = new Date(preferred_date);
        const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

        // 시간 포맷 (14:00)
        const timeStr = preferred_time.substring(0, 5);

        // service_type에 따라 분기
        if (serviceType === 'sens') {
            // === SENS 발송 ===
            if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                logger.info('[ConsultationAlimtalk] SENS 설정 미완료');
                return false;
            }

            if (!setting.sens_consultation_template_code) {
                logger.info('[ConsultationAlimtalk] SENS 상담확정 템플릿 코드 미설정');
                return false;
            }

            const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
            if (!decryptedSecret) {
                logger.info('[ConsultationAlimtalk] SENS Secret 복호화 실패');
                return false;
            }

            // 템플릿 변수 치환
            let content = setting.sens_consultation_template_content || '';
            content = content
                .replace(/#{이름}/g, name)
                .replace(/#{날짜}/g, dateStr)
                .replace(/#{시간}/g, timeStr)
                .replace(/#{예약번호}/g, reservation_number);

            // 버튼 파싱
            let buttons = null;
            if (setting.sens_consultation_buttons) {
                try {
                    buttons = typeof setting.sens_consultation_buttons === 'string'
                        ? JSON.parse(setting.sens_consultation_buttons)
                        : setting.sens_consultation_buttons;
                } catch (e) {
                    logger.error('[ConsultationAlimtalk] SENS 버튼 파싱 오류:', e);
                }
            }

            logger.info('[ConsultationAlimtalk] SENS 발송:', { name, phone, dateStr, timeStr, reservation_number });

            const result = await sendAlimtalkSens(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id
                },
                setting.sens_consultation_template_code,
                [{ phone, content, buttons }]
            );

            if (result.success) {
                logger.info('[ConsultationAlimtalk] SENS 발송 성공:', reservation_number);
                await db.query(
                    `INSERT INTO notification_logs
                    (academy_id, recipient_name, recipient_phone, message_type, template_code,
                     message_content, status, request_id, sent_at)
                    VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                    [academyId, name, phone, setting.sens_consultation_template_code, content, result.requestId || null]
                );
                return true;
            } else {
                logger.error('[ConsultationAlimtalk] SENS 발송 실패:', result.error);
                return false;
            }
        } else {
            // === 솔라피 발송 ===
            if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
                logger.info('[ConsultationAlimtalk] 솔라피 설정 미완료');
                return false;
            }

            if (!setting.solapi_consultation_template_id) {
                logger.info('[ConsultationAlimtalk] 상담확정 템플릿 ID 미설정');
                return false;
            }

            const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
            if (!decryptedSecret) {
                logger.info('[ConsultationAlimtalk] 솔라피 Secret 복호화 실패');
                return false;
            }

            // 템플릿 변수 치환
            let content = setting.solapi_consultation_template_content || '';
            content = content
                .replace(/#{이름}/g, name)
                .replace(/#{날짜}/g, dateStr)
                .replace(/#{시간}/g, timeStr)
                .replace(/#{예약번호}/g, reservation_number);

            // 버튼 설정 파싱 및 변수 치환
            let buttons = null;
            if (setting.solapi_consultation_buttons) {
                try {
                    buttons = JSON.parse(setting.solapi_consultation_buttons);
                    buttons = buttons.map(btn => ({
                        ...btn,
                        linkMo: btn.linkMo?.replace(/#{이름}/g, name)
                            .replace(/#{날짜}/g, dateStr)
                            .replace(/#{시간}/g, timeStr)
                            .replace(/#{예약번호}/g, reservation_number),
                        linkPc: btn.linkPc?.replace(/#{이름}/g, name)
                            .replace(/#{날짜}/g, dateStr)
                            .replace(/#{시간}/g, timeStr)
                            .replace(/#{예약번호}/g, reservation_number),
                    }));
                } catch (e) {
                    logger.error('[ConsultationAlimtalk] 솔라피 버튼 파싱 오류:', e);
                }
            }

            const imageUrl = setting.solapi_consultation_image_url || null;

            logger.info('[ConsultationAlimtalk] 솔라피 발송:', { name, phone, dateStr, timeStr, reservation_number, hasButtons: !!buttons, hasImage: !!imageUrl });

            const result = await sendAlimtalkSolapi(
                {
                    solapi_api_key: setting.solapi_api_key,
                    solapi_api_secret: decryptedSecret,
                    solapi_pfid: setting.solapi_pfid,
                    solapi_sender_phone: setting.solapi_sender_phone
                },
                setting.solapi_consultation_template_id,
                [{ phone, content, buttons, imageUrl }]
            );

            if (result.success) {
                logger.info('[ConsultationAlimtalk] 솔라피 발송 성공:', reservation_number);
                await db.query(
                    `INSERT INTO notification_logs
                    (academy_id, recipient_name, recipient_phone, message_type, template_code,
                     message_content, status, request_id, sent_at)
                    VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                    [academyId, name, phone, setting.solapi_consultation_template_id, content, result.groupId || null]
                );
                return true;
            } else {
                logger.error('[ConsultationAlimtalk] 솔라피 발송 실패:', result.error);
                return false;
            }
        }
    } catch (error) {
        logger.error('[ConsultationAlimtalk] 오류:', error.message);
        return false;
    }
}

// ============================================
// 관리자 API - 인증 필요
// 상담 신청 관리 및 설정
// ============================================

// ================== 상담 신청 관리 ==================

// GET /paca/consultations - 상담 신청 목록 조회
router.get('/', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const {
      status,
      startDate,
      endDate,
      search,
      consultationType,
      page = 1,
      limit = 20
    } = req.query;

    let whereClause = 'WHERE c.academy_id = ?';
    const params = [academyId];

    if (status) {
      whereClause += ' AND c.status = ?';
      params.push(status);
    }

    if (startDate) {
      whereClause += ' AND c.preferred_date >= ?';
      params.push(startDate);
    }

    if (endDate) {
      whereClause += ' AND c.preferred_date <= ?';
      params.push(endDate);
    }

    if (consultationType) {
      whereClause += ' AND c.consultation_type = ?';
      params.push(consultationType);
    }

    if (search) {
      whereClause += ' AND (c.parent_name LIKE ? OR c.student_name LIKE ? OR c.parent_phone LIKE ?)';
      const searchTerm = `%${search}%`;
      params.push(searchTerm, searchTerm, searchTerm);
    }

    // 전체 개수 조회
    const [countResult] = await db.query(
      `SELECT COUNT(*) as total FROM consultations c ${whereClause}`,
      params
    );
    const total = countResult[0].total;

    // 페이징
    const offset = (parseInt(page) - 1) * parseInt(limit);
    params.push(parseInt(limit), offset);

    // 목록 조회
    const [consultations] = await db.query(
      `SELECT c.*, s.name as linked_student_name, s.is_trial as linked_student_is_trial
       FROM consultations c
       LEFT JOIN students s ON c.linked_student_id = s.id
       ${whereClause}
       ORDER BY c.preferred_date DESC, c.preferred_time DESC
       LIMIT ? OFFSET ?`,
      params
    );

    // 상태별 통계
    const [stats] = await db.query(
      `SELECT status, COUNT(*) as count
       FROM consultations
       WHERE academy_id = ?
       GROUP BY status`,
      [academyId]
    );

    // 완료된 상담이 있으면 학생 매칭을 위해 학생 목록 조회
    const hasCompletedConsultations = consultations.some(c => c.status === 'completed');
    let studentsMap = new Map(); // 이름+전화번호 → 학생정보

    if (hasCompletedConsultations) {
      const [students] = await db.query(
        `SELECT id, name, phone, parent_phone, status, is_trial, trial_dates FROM students WHERE academy_id = ?`,
        [academyId]
      );

      // 복호화 후 Map 생성 (이름+학부모전화번호로 매칭)
      students.forEach(s => {
        const decryptedName = s.name ? decrypt(s.name) : '';
        const decryptedParentPhone = s.parent_phone ? decrypt(s.parent_phone) : '';
        const decryptedPhone = s.phone ? decrypt(s.phone) : '';

        // trial_dates 파싱
        let hasTrial = false;
        try {
          const trialDates = s.trial_dates ? (typeof s.trial_dates === 'string' ? JSON.parse(s.trial_dates) : s.trial_dates) : null;
          hasTrial = trialDates && Array.isArray(trialDates) && trialDates.length > 0;
        } catch (e) {
          hasTrial = false;
        }

        const studentInfo = { id: s.id, status: s.status, is_trial: s.is_trial, hasTrial };

        // 이름+학부모전화번호 키
        if (decryptedName && decryptedParentPhone) {
          const key = `${decryptedName.trim().toLowerCase()}_${decryptedParentPhone.replace(/[^0-9]/g, '')}`;
          studentsMap.set(key, studentInfo);
        }
        // 이름+학생전화번호 키도 추가
        if (decryptedName && decryptedPhone) {
          const key2 = `${decryptedName.trim().toLowerCase()}_${decryptedPhone.replace(/[^0-9]/g, '')}`;
          if (!studentsMap.has(key2)) {
            studentsMap.set(key2, studentInfo);
          }
        }
      });
    }

    res.json({
      consultations: consultations.map(c => {
        // 복호화
        const decrypted = decryptConsultationNames({...c});

        // JSON 필드가 이미 객체일 수도 있고 문자열일 수도 있음
        let academicScores = null;
        let referralSources = null;

        try {
          academicScores = decrypted.academic_scores
            ? (typeof decrypted.academic_scores === 'string' ? JSON.parse(decrypted.academic_scores) : decrypted.academic_scores)
            : null;
        } catch (e) {
          logger.error('academic_scores 파싱 오류:', e);
        }

        try {
          referralSources = decrypted.referral_sources
            ? (typeof decrypted.referral_sources === 'string' ? JSON.parse(decrypted.referral_sources) : decrypted.referral_sources)
            : null;
        } catch (e) {
          logger.error('referral_sources 파싱 오류:', e);
        }

        // 완료된 상담인 경우 학생 매칭 (이름+전화번호로)
        // 상태 종류:
        // - registered_with_trial: 체험 후 등록 (체험완료 + 등록)
        // - registered_direct: 바로 등록 (등록만)
        // - trial_ongoing: 체험 중 (체험중)
        // - trial_completed: 체험 완료 미등록 (체험완료 + 미등록)
        // - no_trial: 미체험 (미체험)
        let matched_student_status = null;
        if (decrypted.status === 'completed') {
          const consultName = (decrypted.student_name || '').trim().toLowerCase();
          const consultParentPhone = (decrypted.parent_phone || '').replace(/[^0-9]/g, '');
          const consultStudentPhone = (decrypted.student_phone || '').replace(/[^0-9]/g, '');

          // 이름+학부모전화번호로 먼저 매칭
          let matchKey = `${consultName}_${consultParentPhone}`;
          let matched = studentsMap.get(matchKey);

          // 없으면 이름+학생전화번호로 매칭
          if (!matched && consultStudentPhone) {
            matchKey = `${consultName}_${consultStudentPhone}`;
            matched = studentsMap.get(matchKey);
          }

          if (matched) {
            if (matched.status === 'active') {
              // 재원생: 체험 이력 있으면 체험완료+등록, 없으면 바로등록
              matched_student_status = matched.hasTrial ? 'registered_with_trial' : 'registered_direct';
            } else if (matched.status === 'trial') {
              // 체험생: 체험 진행 중
              matched_student_status = 'trial_ongoing';
            } else {
              // 그 외 상태(withdrawn 등): 체험 이력 있으면 체험완료+미등록
              matched_student_status = matched.hasTrial ? 'trial_completed' : 'no_trial';
            }
          } else {
            // 매칭 안됨: 미체험
            matched_student_status = 'no_trial';
          }
        }

        return {
          ...decrypted,
          academicScores,
          referralSources,
          matched_student_status
        };
      }),
      pagination: {
        total,
        page: parseInt(page),
        limit: parseInt(limit),
        totalPages: Math.ceil(total / parseInt(limit))
      },
      stats: stats.reduce((acc, s) => {
        acc[s.status] = s.count;
        return acc;
      }, {})
    });
  } catch (error) {
    logger.error('상담 목록 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /paca/consultations/by-student/:studentId - 학생과 연결된 상담 조회
// 주의: /:id 보다 먼저 정의해야 함!
router.get('/by-student/:studentId', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const { studentId } = req.params;

    const [consultations] = await db.query(
      `SELECT * FROM consultations
       WHERE academy_id = ? AND linked_student_id = ?
       ORDER BY created_at DESC
       LIMIT 1`,
      [academyId, studentId]
    );

    if (consultations.length === 0) {
      return res.status(404).json({ error: '연결된 상담 정보가 없습니다.' });
    }

    const consultation = consultations[0];

    // 민감 정보 복호화
    const decrypted = {
      ...consultation,
      parent_name: decrypt(consultation.parent_name),
      student_name: decrypt(consultation.student_name),
      parent_phone: decrypt(consultation.parent_phone),
    };

    // JSON 필드 파싱
    try {
      if (decrypted.checklist && typeof decrypted.checklist === 'string') {
        decrypted.checklist = JSON.parse(decrypted.checklist);
      }
      if (decrypted.referral_sources && typeof decrypted.referral_sources === 'string') {
        decrypted.referral_sources = JSON.parse(decrypted.referral_sources);
      }
    } catch (e) {
      logger.error('JSON 파싱 오류:', e);
    }

    res.json({ consultation: decrypted });
  } catch (error) {
    logger.error('학생 상담 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /paca/consultations/booked-times - 특정 날짜의 예약된 시간 목록 조회
// 주의: /:id 보다 먼저 정의해야 함!
router.get('/booked-times', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const { date } = req.query;

    if (!date) {
      return res.status(400).json({ error: '날짜가 필요합니다.' });
    }

    // 해당 날짜의 취소/노쇼가 아닌 상담 시간 목록 조회
    const [consultations] = await db.query(
      `SELECT preferred_time
       FROM consultations
       WHERE academy_id = ?
         AND preferred_date = ?
         AND status NOT IN ('cancelled', 'no_show')
       ORDER BY preferred_time`,
      [academyId, date]
    );

    // HH:MM 형식으로 반환
    const bookedTimes = consultations.map(c =>
      c.preferred_time.substring(0, 5)
    );

    res.json({ date, bookedTimes });
  } catch (error) {
    logger.error('예약 시간 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /paca/consultations/:id - 상담 상세 조회
router.get('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;

    const [consultations] = await db.query(
      `SELECT c.*, s.name as linked_student_name, s.grade as linked_student_grade, s.is_trial as linked_student_is_trial
       FROM consultations c
       LEFT JOIN students s ON c.linked_student_id = s.id
       WHERE c.id = ? AND c.academy_id = ?`,
      [id, academyId]
    );

    if (consultations.length === 0) {
      return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
    }

    // 복호화
    const consultation = decryptConsultationNames({...consultations[0]});

    // JSON 필드 파싱 (이미 객체일 수도 있음)
    let academicScores = null;
    let referralSources = null;

    try {
      academicScores = consultation.academic_scores
        ? (typeof consultation.academic_scores === 'string' ? JSON.parse(consultation.academic_scores) : consultation.academic_scores)
        : null;
    } catch (e) {
      logger.error('academic_scores 파싱 오류:', e);
    }

    try {
      referralSources = consultation.referral_sources
        ? (typeof consultation.referral_sources === 'string' ? JSON.parse(consultation.referral_sources) : consultation.referral_sources)
        : null;
    } catch (e) {
      logger.error('referral_sources 파싱 오류:', e);
    }

    // checklist JSON 파싱
    let checklist = null;
    try {
      checklist = consultation.checklist
        ? (typeof consultation.checklist === 'string' ? JSON.parse(consultation.checklist) : consultation.checklist)
        : null;
    } catch (e) {
      logger.error('checklist 파싱 오류:', e);
    }

    res.json({
      ...consultation,
      academicScores,
      referralSources,
      checklist
    });
  } catch (error) {
    logger.error('상담 상세 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// PUT /paca/consultations/:id - 상담 수정 (상태, 메모, 체크리스트, 학생정보)
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;
    const {
      status, adminNotes, preferredDate, preferredTime, checklist, consultationMemo,
      // 학생 정보 수정 필드 추가
      student_name, student_grade, student_school, gender,
      mockTestGrades, schoolGradeAvg, admissionType,
      target_school, referrerStudent, parent_phone
    } = req.body;

    // 기존 상담 확인 (현재 상태 포함)
    const [existing] = await db.query(
      'SELECT * FROM consultations WHERE id = ? AND academy_id = ?',
      [id, academyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
    }

    const currentConsultation = existing[0];
    const wasNotConfirmed = currentConsultation.status !== 'confirmed';
    const willBeConfirmed = status === 'confirmed';

    const updates = [];
    const params = [];

    if (status) {
      updates.push('status = ?');
      params.push(status);
    }

    if (adminNotes !== undefined) {
      updates.push('admin_notes = ?');
      params.push(adminNotes);
    }

    if (preferredDate) {
      updates.push('preferred_date = ?');
      params.push(preferredDate);
    }

    if (preferredTime) {
      updates.push('preferred_time = ?');
      // HH:MM 형식이면 :00 붙이고, 이미 HH:MM:SS면 그대로 사용
      const timeValue = preferredTime.length === 5 ? preferredTime + ':00' : preferredTime;
      params.push(timeValue);
    }

    // 체크리스트 업데이트
    if (checklist !== undefined) {
      updates.push('checklist = ?');
      params.push(JSON.stringify(checklist));
    }

    // 상담 메모 업데이트
    if (consultationMemo !== undefined) {
      updates.push('consultation_memo = ?');
      params.push(consultationMemo);
    }

    // 학생 정보 수정
    if (student_name !== undefined) {
      updates.push('student_name = ?');
      params.push(student_name);
      // parent_name도 같이 업데이트
      updates.push('parent_name = ?');
      params.push(student_name);
    }

    if (student_grade !== undefined) {
      updates.push('student_grade = ?');
      params.push(student_grade);
    }

    if (student_school !== undefined) {
      updates.push('student_school = ?');
      params.push(student_school || null);
    }

    if (parent_phone !== undefined) {
      updates.push('parent_phone = ?');
      params.push(parent_phone ? encrypt(parent_phone) : null);
    }

    if (gender !== undefined) {
      updates.push('gender = ?');
      params.push(gender || null);
    }

    if (target_school !== undefined) {
      updates.push('target_school = ?');
      params.push(target_school || null);
    }

    if (referrerStudent !== undefined) {
      updates.push('referrer_student = ?');
      params.push(referrerStudent || null);
    }

    // 성적 정보 수정 (mockTestGrades, schoolGradeAvg, admissionType 중 하나라도 있으면)
    if (mockTestGrades !== undefined || schoolGradeAvg !== undefined || admissionType !== undefined) {
      // 기존 academic_scores 파싱
      let existingScores = {};
      try {
        existingScores = currentConsultation.academic_scores ? JSON.parse(currentConsultation.academic_scores) : {};
      } catch (e) {}

      const newScores = {
        mockTestGrades: mockTestGrades !== undefined ? mockTestGrades : existingScores.mockTestGrades,
        schoolGradeAvg: schoolGradeAvg !== undefined ? schoolGradeAvg : existingScores.schoolGradeAvg,
        admissionType: admissionType !== undefined ? admissionType : existingScores.admissionType
      };

      updates.push('academic_scores = ?');
      params.push(JSON.stringify(newScores));
    }

    // 상태가 confirmed로 변경되면서 예약번호가 없으면 자동 부여
    let reservationNumber = currentConsultation.reservation_number;
    if (wasNotConfirmed && willBeConfirmed && !reservationNumber) {
      reservationNumber = await generateReservationNumber();
      updates.push('reservation_number = ?');
      params.push(reservationNumber);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: '수정할 내용이 없습니다.' });
    }

    params.push(id);

    await db.query(
      `UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`,
      params
    );

    // 연결된 학생이 있으면 students 테이블도 동기화
    if (currentConsultation.linked_student_id) {
      const studentUpdates = [];
      const studentParams = [];
      if (student_name !== undefined) { studentUpdates.push('name = ?'); studentParams.push(student_name); }
      if (student_grade !== undefined) { studentUpdates.push('grade = ?'); studentParams.push(student_grade); }
      if (student_school !== undefined) { studentUpdates.push('school = ?'); studentParams.push(student_school || null); }
      if (gender !== undefined) { studentUpdates.push('gender = ?'); studentParams.push(gender || null); }
      if (parent_phone !== undefined) { studentUpdates.push('parent_phone = ?'); studentParams.push(parent_phone ? encrypt(parent_phone) : null); }
      if (studentUpdates.length > 0) {
        studentParams.push(currentConsultation.linked_student_id);
        await db.query(`UPDATE students SET ${studentUpdates.join(', ')} WHERE id = ?`, studentParams);
      }
    }

    // 상태가 confirmed로 변경되면 알림톡 발송
    // 단, 재원생 상담(learning)은 알림톡 발송 제외
    const isLearningConsultation = currentConsultation.consultation_type === 'learning';
    if (wasNotConfirmed && willBeConfirmed && !isLearningConsultation) {
      // 업데이트된 정보로 알림톡 발송
      const updatedConsultation = {
        ...currentConsultation,
        preferred_date: preferredDate || currentConsultation.preferred_date,
        preferred_time: preferredTime ? preferredTime + ':00' : currentConsultation.preferred_time,
        reservation_number: reservationNumber
      };

      // 비동기로 알림톡 발송 (에러가 나도 응답은 성공)
      sendConfirmationAlimtalk(updatedConsultation, academyId).catch(err => {
        logger.error('[ConsultationAlimtalk] 비동기 발송 오류:', err);
      });
    } else if (isLearningConsultation) {
      logger.info('[ConsultationAlimtalk] 재원생 상담은 알림톡 발송 제외:', currentConsultation.id);
    }

    res.json({
      message: '상담 정보가 수정되었습니다.',
      reservationNumber: reservationNumber || null,
      alimtalkSent: wasNotConfirmed && willBeConfirmed
    });
  } catch (error) {
    logger.error('상담 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /paca/consultations/:id - 상담 삭제
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;

    const [result] = await db.query(
      'DELETE FROM consultations WHERE id = ? AND academy_id = ?',
      [id, academyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
    }

    res.json({ message: '상담 신청이 삭제되었습니다.' });
  } catch (error) {
    logger.error('상담 삭제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/consultations/direct - 관리자가 직접 상담 등록
router.post('/direct', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const {
      studentName, phone, grade, preferredDate, preferredTime, notes,
      gender, studentSchool, schoolGradeAvg, admissionType, mockTestGrades,
      targetSchool, referrerStudent
    } = req.body;

    // 필수 필드 검증
    if (!studentName || !phone || !grade || !preferredDate || !preferredTime) {
      return res.status(400).json({ error: '학생명, 전화번호, 학년, 상담일시는 필수입니다.' });
    }

    // 성적 정보 JSON 구성
    const academicScores = {
      mockTestGrades: mockTestGrades || {},
      schoolGradeAvg: schoolGradeAvg ?? null,
      admissionType: admissionType || null
    };

    // 상담 등록 (관리자 등록이므로 바로 confirmed 상태)
    // parent_name, parent_phone은 NOT NULL이라 학생 정보로 대체
    const [result] = await db.query(
      `INSERT INTO consultations (
        academy_id, consultation_type, parent_name, parent_phone,
        student_name, student_grade, student_school, gender,
        academic_scores, target_school, referrer_student,
        preferred_date, preferred_time, status, admin_notes,
        checklist, consultation_memo, created_at
      ) VALUES (?, 'new_registration', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NULL, NULL, NOW())`,
      [
        academyId,
        studentName,  // parent_name에 학생명
        phone,        // parent_phone에 전화번호
        studentName,
        grade,
        studentSchool || null,
        gender || null,
        JSON.stringify(academicScores),
        targetSchool || null,
        referrerStudent || null,
        preferredDate,
        preferredTime + ':00',
        notes || null
      ]
    );

    res.status(201).json({
      message: '상담이 등록되었습니다.',
      id: result.insertId
    });
  } catch (error) {
    logger.error('직접 상담 등록 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/consultations/:id/link-student - 기존 학생과 연결
router.post('/:id/link-student', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;
    const { studentId } = req.body;

    // 상담 존재 확인
    const [existing] = await db.query(
      'SELECT id FROM consultations WHERE id = ? AND academy_id = ?',
      [id, academyId]
    );

    if (existing.length === 0) {
      return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
    }

    // 학생 존재 확인
    const [students] = await db.query(
      'SELECT id, name FROM students WHERE id = ? AND academy_id = ?',
      [studentId, academyId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
    }

    await db.query(
      'UPDATE consultations SET linked_student_id = ? WHERE id = ?',
      [studentId, id]
    );

    res.json({
      message: '학생이 연결되었습니다.',
      linkedStudent: decryptConsultationNames({...students[0]})
    });
  } catch (error) {
    logger.error('학생 연결 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/consultations/:id/convert-to-trial - 상담 완료 → 체험 학생 등록
router.post('/:id/convert-to-trial', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;
    const { trialDates, studentPhone } = req.body; // [{ date, timeSlot }, { date, timeSlot }]

    // 필수 검증 (최소 1개 이상)
    if (!trialDates || !Array.isArray(trialDates) || trialDates.length < 1) {
      return res.status(400).json({ error: '최소 1개의 체험 일정을 선택해주세요.' });
    }

    // 상담 정보 조회
    const [consultations] = await db.query(
      'SELECT * FROM consultations WHERE id = ? AND academy_id = ?',
      [id, academyId]
    );

    if (consultations.length === 0) {
      return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
    }

    const consultation = consultations[0];

    // 이미 체험 학생으로 연결되어 있는지 확인
    if (consultation.linked_student_id) {
      return res.status(400).json({ error: '이미 학생으로 등록되어 있습니다.' });
    }

    // 시간대 한글 → 영어 변환
    const timeSlotMap = { '오전': 'morning', '오후': 'afternoon', '저녁': 'evening' };

    // trial_dates JSON 구조 (time_slot 키 사용 - students.js와 통일)
    const trialDatesJson = trialDates.map(d => ({
      date: d.date,
      time_slot: timeSlotMap[d.timeSlot] || d.timeSlot,
      attended: false
    }));

    // 체험 학생 등록 (학생 전화번호 우선, 없으면 학부모 전화번호)
    const phone = studentPhone || consultation.parent_phone;
    // 학생 전화번호가 있으면 학부모 전화번호는 비워둠 (같은 번호 중복 방지)
    const parentPhone = studentPhone ? null : consultation.parent_phone;

    // 민감 정보 암호화 (이미 암호화된 값이면 그대로 사용)
    const isAlreadyEncrypted = (val) => val && typeof val === 'string' && val.startsWith('ENC:');
    const encryptedName = isAlreadyEncrypted(consultation.student_name)
      ? consultation.student_name
      : encrypt(consultation.student_name);
    const encryptedPhone = phone
      ? (isAlreadyEncrypted(phone) ? phone : encrypt(phone))
      : null;
    const encryptedParentPhone = parentPhone
      ? (isAlreadyEncrypted(parentPhone) ? parentPhone : encrypt(parentPhone))
      : null;

    const [studentResult] = await db.query(
      `INSERT INTO students (
        academy_id, name, grade, school, gender, phone, parent_phone, status,
        is_trial, trial_remaining, trial_dates, class_days, monthly_tuition, consultation_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', 1, ?, ?, '[]', 0, ?, NOW())`,
      [
        academyId,
        encryptedName,
        consultation.student_grade,
        consultation.student_school || null,  // 학교명 추가
        consultation.gender || null,  // 성별 추가
        encryptedPhone,
        encryptedParentPhone,
        trialDates.length,  // 체험 횟수 = 선택한 일정 수
        JSON.stringify(trialDatesJson),
        consultation.preferred_date  // 상담일
      ]
    );

    const studentId = studentResult.insertId;

    // 체험 일정을 스케줄에 자동 배정
    for (const trialDate of trialDatesJson) {
      const { date, time_slot } = trialDate;
      if (!date || !time_slot) continue;

      // 해당 날짜의 스케줄 찾기 또는 생성
      let [schedules] = await db.query(
        `SELECT id FROM class_schedules WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
        [academyId, date, time_slot]
      );

      let scheduleId;
      if (schedules.length === 0) {
        // 스케줄 없으면 생성
        const [createResult] = await db.query(
          `INSERT INTO class_schedules (academy_id, class_date, time_slot) VALUES (?, ?, ?)`,
          [academyId, date, time_slot]
        );
        scheduleId = createResult.insertId;
      } else {
        scheduleId = schedules[0].id;
      }

      // 출석 레코드 생성
      await db.query(
        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
         VALUES (?, ?, NULL)
         ON DUPLICATE KEY UPDATE attendance_status = attendance_status`,
        [scheduleId, studentId]
      );
    }

    // 상담 상태 업데이트 (확정 상태 유지 + 학생 연결)
    // NOTE: 체험 등록 시 completed로 변경하면 다시 confirmed로 바꿀 때 알림톡 중복 발송됨
    await db.query(
      `UPDATE consultations SET status = 'confirmed', linked_student_id = ? WHERE id = ?`,
      [studentId, id]
    );

    res.json({
      message: '체험 학생으로 등록되었습니다.',
      studentId,
      trialDates: trialDatesJson
    });
  } catch (error) {
    logger.error('체험 학생 등록 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/consultations/:id/convert-to-pending - 상담 완료 → 미등록관리 (체험 없이)
router.post('/:id/convert-to-pending', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;
    const { studentPhone, memo } = req.body;

    // 상담 정보 조회
    const [consultations] = await db.query(
      'SELECT * FROM consultations WHERE id = ? AND academy_id = ?',
      [id, academyId]
    );

    if (consultations.length === 0) {
      return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
    }

    const consultation = consultations[0];

    // 이미 학생으로 연결되어 있는지 확인
    if (consultation.linked_student_id) {
      return res.status(400).json({ error: '이미 학생으로 등록되어 있습니다.' });
    }

    // 미등록관리 학생 등록 (pending 상태)
    // 미등록관리 학생은 학부모 연락처 저장 안 함 (정식 등록 시 입력)
    const phone = studentPhone || consultation.parent_phone;

    // 민감 정보 암호화 (이미 암호화된 값이면 그대로 사용)
    const isAlreadyEncrypted = (val) => val && typeof val === 'string' && val.startsWith('ENC:');
    const encryptedName = isAlreadyEncrypted(consultation.student_name)
      ? consultation.student_name
      : encrypt(consultation.student_name);
    const encryptedPhone = phone
      ? (isAlreadyEncrypted(phone) ? phone : encrypt(phone))
      : null;

    const [studentResult] = await db.query(
      `INSERT INTO students (
        academy_id, name, grade, school, gender, phone, parent_phone, status,
        is_trial, memo, class_days, monthly_tuition, consultation_date, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', 0, ?, '[]', 0, ?, NOW())`,
      [
        academyId,
        encryptedName,
        consultation.student_grade,
        consultation.student_school,
        consultation.gender || null,  // 성별 추가
        encryptedPhone,
        memo || consultation.inquiry_content || null,
        consultation.preferred_date  // 상담일
      ]
    );

    const studentId = studentResult.insertId;

    // 상담 상태 업데이트 (completed + 학생 연결)
    await db.query(
      `UPDATE consultations SET status = 'completed', linked_student_id = ? WHERE id = ?`,
      [studentId, id]
    );

    res.json({
      message: '미등록관리 학생으로 등록되었습니다.',
      studentId
    });
  } catch (error) {
    logger.error('미등록관리 학생 등록 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// ================== 상담 설정 ==================

// GET /paca/consultations/settings - 상담 설정 조회
router.get('/settings/info', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;

    // 학원 정보 (slug 포함)
    const [academies] = await db.query(
      'SELECT id, name, slug FROM academies WHERE id = ?',
      [academyId]
    );

    // 상담 설정 조회
    const [settings] = await db.query(
      'SELECT * FROM consultation_settings WHERE academy_id = ?',
      [academyId]
    );

    // 요일별 운영 시간
    const [weeklyHours] = await db.query(
      `SELECT day_of_week, is_available, start_time, end_time
       FROM consultation_weekly_hours
       WHERE academy_id = ?
       ORDER BY day_of_week`,
      [academyId]
    );

    // 차단된 날짜들
    const [blockedSlots] = await db.query(
      `SELECT id, blocked_date, is_all_day, start_time, end_time, reason
       FROM consultation_blocked_slots
       WHERE academy_id = ? AND blocked_date >= CURDATE()
       ORDER BY blocked_date`,
      [academyId]
    );

    const setting = settings[0] || {};

    res.json({
      academy: academies[0],
      settings: {
        isEnabled: setting.is_enabled ?? true,
        pageTitle: setting.page_title || '상담 예약',
        pageDescription: setting.page_description || '',
        slotDuration: setting.slot_duration || 30,
        maxReservationsPerSlot: setting.max_reservations_per_slot || 1,
        advanceDays: setting.advance_days || 30,
        referralSources: setting.referral_sources
          ? (typeof setting.referral_sources === 'string'
              ? JSON.parse(setting.referral_sources)
              : setting.referral_sources)
          : ['블로그/인터넷 검색', '지인 소개', '현수막/전단지', 'SNS', '기타'],
        sendConfirmationAlimtalk: setting.send_confirmation_alimtalk ?? true,
        confirmationTemplateCode: setting.confirmation_template_code || '',
        minAdvanceHours: setting.min_advance_hours ?? 4
      },
      weeklyHours: weeklyHours.map(h => ({
        dayOfWeek: h.day_of_week,
        isAvailable: h.is_available === 1,
        startTime: h.start_time,
        endTime: h.end_time
      })),
      blockedSlots
    });
  } catch (error) {
    logger.error('상담 설정 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// PUT /paca/consultations/settings - 상담 설정 수정
router.put('/settings/info', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const {
      slug,
      isEnabled,
      pageTitle,
      pageDescription,
      slotDuration,
      maxReservationsPerSlot,
      advanceDays,
      referralSources,
      sendConfirmationAlimtalk,
      confirmationTemplateCode,
      minAdvanceHours
    } = req.body;

    // slug 업데이트 (학원 테이블)
    if (slug !== undefined) {
      // slug 유효성 검사
      if (!/^[a-z0-9-]+$/.test(slug)) {
        return res.status(400).json({ error: 'slug는 영문 소문자, 숫자, 하이픈만 사용 가능합니다.' });
      }

      // 중복 체크
      const [existing] = await db.query(
        'SELECT id FROM academies WHERE slug = ? AND id != ?',
        [slug, academyId]
      );

      if (existing.length > 0) {
        return res.status(409).json({ error: '이미 사용 중인 주소입니다.' });
      }

      await db.query('UPDATE academies SET slug = ? WHERE id = ?', [slug, academyId]);
    }

    // 설정 UPSERT
    await db.query(
      `INSERT INTO consultation_settings (
        academy_id, is_enabled, page_title, page_description,
        slot_duration, max_reservations_per_slot, advance_days,
        referral_sources, send_confirmation_alimtalk, confirmation_template_code,
        min_advance_hours
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        is_enabled = VALUES(is_enabled),
        page_title = VALUES(page_title),
        page_description = VALUES(page_description),
        slot_duration = VALUES(slot_duration),
        max_reservations_per_slot = VALUES(max_reservations_per_slot),
        advance_days = VALUES(advance_days),
        referral_sources = VALUES(referral_sources),
        send_confirmation_alimtalk = VALUES(send_confirmation_alimtalk),
        confirmation_template_code = VALUES(confirmation_template_code),
        min_advance_hours = VALUES(min_advance_hours)`,
      [
        academyId,
        isEnabled ?? true,
        pageTitle || '상담 예약',
        pageDescription || '',
        slotDuration || 30,
        maxReservationsPerSlot || 1,
        advanceDays || 30,
        referralSources ? JSON.stringify(referralSources) : '["블로그/인터넷 검색", "지인 소개", "현수막/전단지", "SNS", "기타"]',
        sendConfirmationAlimtalk ?? true,
        confirmationTemplateCode || null,
        minAdvanceHours ?? 4
      ]
    );

    res.json({ message: '설정이 저장되었습니다.' });
  } catch (error) {
    logger.error('상담 설정 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// PUT /paca/consultations/settings/weekly-hours - 요일별 운영 시간 수정
router.put('/settings/weekly-hours', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const { weeklyHours } = req.body;

    if (!Array.isArray(weeklyHours) || weeklyHours.length !== 7) {
      return res.status(400).json({ error: '7일 치 운영 시간 정보가 필요합니다.' });
    }

    // 기존 데이터 삭제 후 재생성
    await db.query('DELETE FROM consultation_weekly_hours WHERE academy_id = ?', [academyId]);

    for (const hour of weeklyHours) {
      await db.query(
        `INSERT INTO consultation_weekly_hours
         (academy_id, day_of_week, is_available, start_time, end_time)
         VALUES (?, ?, ?, ?, ?)`,
        [
          academyId,
          hour.dayOfWeek,
          hour.isAvailable,
          hour.startTime || null,
          hour.endTime || null
        ]
      );
    }

    res.json({ message: '운영 시간이 저장되었습니다.' });
  } catch (error) {
    logger.error('운영 시간 수정 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/consultations/settings/blocked-slots - 시간대 차단 추가
router.post('/settings/blocked-slots', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const userId = req.user.id;
    const { blockedDate, isAllDay, startTime, endTime, reason } = req.body;

    if (!blockedDate) {
      return res.status(400).json({ error: '날짜를 선택해주세요.' });
    }

    const [result] = await db.query(
      `INSERT INTO consultation_blocked_slots
       (academy_id, blocked_date, is_all_day, start_time, end_time, reason, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        academyId,
        blockedDate,
        isAllDay ?? true,
        isAllDay ? null : startTime,
        isAllDay ? null : endTime,
        reason || null,
        userId
      ]
    );

    res.status(201).json({
      message: '시간대가 차단되었습니다.',
      id: result.insertId
    });
  } catch (error) {
    logger.error('시간대 차단 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// DELETE /paca/consultations/settings/blocked-slots/:id - 시간대 차단 해제
router.delete('/settings/blocked-slots/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const academyId = req.user.academy_id;

    const [result] = await db.query(
      'DELETE FROM consultation_blocked_slots WHERE id = ? AND academy_id = ?',
      [id, academyId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: '차단된 시간대를 찾을 수 없습니다.' });
    }

    res.json({ message: '차단이 해제되었습니다.' });
  } catch (error) {
    logger.error('차단 해제 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /paca/consultations/calendar - 캘린더용 상담 일정 조회
router.get('/calendar/events', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
    }

    const [consultations] = await db.query(
      `SELECT c.id, c.student_name, c.parent_name, c.preferred_date, c.preferred_time,
              c.status, c.consultation_type, c.learning_type, c.linked_student_id,
              s.name as linked_student_name
       FROM consultations c
       LEFT JOIN students s ON c.linked_student_id = s.id
       WHERE c.academy_id = ? AND c.preferred_date >= ? AND c.preferred_date <= ?
       ORDER BY c.preferred_date, c.preferred_time`,
      [academyId, startDate, endDate]
    );

    // 날짜별로 그룹화 (복호화 적용)
    const eventsByDate = consultations.reduce((acc, c) => {
      const date = c.preferred_date;
      if (!acc[date]) {
        acc[date] = [];
      }
      acc[date].push(decryptConsultationNames({...c}));
      return acc;
    }, {});

    res.json({ events: eventsByDate });
  } catch (error) {
    logger.error('캘린더 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/consultations/learning - 재원생 상담 일정 등록
router.post('/learning', verifyToken, async (req, res) => {
  try {
    const academyId = req.user.academy_id;
    const {
      studentId,
      preferredDate,
      preferredTime,
      learningType, // regular, admission, parent, counseling
      adminNotes
    } = req.body;

    // 필수 필드 검증
    if (!studentId || !preferredDate || !preferredTime || !learningType) {
      return res.status(400).json({ error: '학생, 날짜, 시간, 상담유형은 필수입니다.' });
    }

    // 학생 정보 조회
    const [students] = await db.query(
      'SELECT id, name, phone, grade FROM students WHERE id = ? AND academy_id = ?',
      [studentId, academyId]
    );

    if (students.length === 0) {
      return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
    }

    const student = students[0];

    // 상담 일정 등록 (consultation_type = 'learning')
    const [result] = await db.query(
      `INSERT INTO consultations (
        academy_id, consultation_type, learning_type, linked_student_id,
        parent_name, parent_phone, student_name, student_grade,
        preferred_date, preferred_time, status, admin_notes, created_at
      ) VALUES (?, 'learning', ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NOW())`,
      [
        academyId,
        learningType,
        studentId,
        student.name,  // 이미 암호화된 값
        student.phone || '',  // 이미 암호화된 값
        student.name,  // 이미 암호화된 값
        student.grade,
        preferredDate,
        preferredTime + ':00',
        adminNotes || null
      ]
    );

    res.status(201).json({
      message: '재원생 상담 일정이 등록되었습니다.',
      id: result.insertId
    });
  } catch (error) {
    logger.error('재원생 상담 등록 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

module.exports = router;
