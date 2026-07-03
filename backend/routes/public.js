const express = require('express');
const router = express.Router();
const db = require('../config/database');
const webpush = require('web-push');
const logger = require('../utils/logger');

// VAPID 설정
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

// ============================================
// 공개 API - 인증 불필요
// 학부모가 로그인 없이 상담 신청할 수 있는 API
// ============================================

// GET /paca/public/consultation/:slug - 학원 상담 페이지 정보 조회
router.get('/consultation/:slug', async (req, res) => {
  try {
    const { slug } = req.params;

    // 학원 정보 조회
    const [academies] = await db.query(
      `SELECT a.id, a.name, a.slug,
              cs.is_enabled, cs.page_title, cs.page_description,
              cs.slot_duration, cs.advance_days, cs.referral_sources
       FROM academies a
       LEFT JOIN consultation_settings cs ON a.id = cs.academy_id
       WHERE a.slug = ?`,
      [slug]
    );

    if (academies.length === 0) {
      return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });
    }

    const academy = academies[0];

    // 상담 기능 비활성화 체크
    if (academy.is_enabled === false) {
      return res.status(403).json({ error: '현재 상담 예약이 불가능합니다.' });
    }

    // 요일별 운영 시간 조회
    const [weeklyHours] = await db.query(
      `SELECT day_of_week, is_available, start_time, end_time
       FROM consultation_weekly_hours
       WHERE academy_id = ?
       ORDER BY day_of_week`,
      [academy.id]
    );

    // referral_sources JSON 파싱
    let referralSources = ['블로그/인터넷 검색', '지인 소개', '현수막/전단지', 'SNS', '기타'];
    if (academy.referral_sources) {
      try {
        referralSources = typeof academy.referral_sources === 'string'
          ? JSON.parse(academy.referral_sources)
          : academy.referral_sources;
      } catch (e) {
        logger.error('referral_sources 파싱 오류:', e);
      }
    }

    res.json({
      academy: {
        id: academy.id,
        name: academy.name,
        slug: academy.slug
      },
      settings: {
        pageTitle: academy.page_title || '상담 예약',
        pageDescription: academy.page_description || '',
        slotDuration: academy.slot_duration || 30,
        advanceDays: academy.advance_days || 30,
        referralSources
      },
      weeklyHours: weeklyHours.map(h => ({
        dayOfWeek: h.day_of_week,
        isAvailable: h.is_available === 1,
        startTime: h.start_time,
        endTime: h.end_time
      }))
    });
  } catch (error) {
    logger.error('상담 페이지 정보 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// GET /paca/public/consultation/:slug/slots - 특정 날짜의 가능한 슬롯 조회
router.get('/consultation/:slug/slots', async (req, res) => {
  try {
    const { slug } = req.params;
    const { date } = req.query; // YYYY-MM-DD 형식

    if (!date) {
      return res.status(400).json({ error: '날짜를 선택해주세요.' });
    }

    // 학원 정보 조회
    const [academies] = await db.query(
      `SELECT a.id, cs.slot_duration, cs.max_reservations_per_slot, cs.is_enabled, cs.min_advance_hours
       FROM academies a
       LEFT JOIN consultation_settings cs ON a.id = cs.academy_id
       WHERE a.slug = ?`,
      [slug]
    );

    if (academies.length === 0) {
      return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });
    }

    const academy = academies[0];

    if (academy.is_enabled === false) {
      return res.status(403).json({ error: '현재 상담 예약이 불가능합니다.' });
    }

    const slotDuration = academy.slot_duration || 30;
    const maxReservations = academy.max_reservations_per_slot || 1;
    const minAdvanceHours = academy.min_advance_hours ?? 4;

    // 해당 날짜의 요일 확인 (0=일, 1=월, ...)
    const targetDate = new Date(date);
    const dayOfWeek = targetDate.getDay();

    // 요일별 운영 시간 조회
    const [weeklyHours] = await db.query(
      `SELECT is_available, start_time, end_time
       FROM consultation_weekly_hours
       WHERE academy_id = ? AND day_of_week = ?`,
      [academy.id, dayOfWeek]
    );

    // 해당 요일 휴무 체크
    if (weeklyHours.length === 0 || !weeklyHours[0].is_available) {
      return res.json({ slots: [], message: '해당 날짜는 휴무일입니다.' });
    }

    const { start_time, end_time } = weeklyHours[0];

    // 해당 날짜의 차단된 시간대 조회
    const [blockedSlots] = await db.query(
      `SELECT is_all_day, start_time, end_time, time_slot
       FROM consultation_blocked_slots
       WHERE academy_id = ? AND blocked_date = ?`,
      [academy.id, date]
    );

    // 종일 차단 체크
    const isAllDayBlocked = blockedSlots.some(b => b.is_all_day);
    if (isAllDayBlocked) {
      return res.json({ slots: [], message: '해당 날짜는 예약이 불가능합니다.' });
    }

    // 해당 날짜의 기존 예약 조회
    const [existingReservations] = await db.query(
      `SELECT preferred_time, COUNT(*) as count
       FROM consultations
       WHERE academy_id = ? AND preferred_date = ? AND status NOT IN ('cancelled')
       GROUP BY preferred_time`,
      [academy.id, date]
    );

    // 슬롯 생성
    const slots = [];
    const startParts = start_time.split(':');
    const endParts = end_time.split(':');

    let currentMinutes = parseInt(startParts[0]) * 60 + parseInt(startParts[1]);
    const endMinutes = parseInt(endParts[0]) * 60 + parseInt(endParts[1]);

    while (currentMinutes < endMinutes) {
      const hours = Math.floor(currentMinutes / 60);
      const mins = currentMinutes % 60;
      const timeStr = `${hours.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:00`;

      // 차단된 시간대 체크
      const isBlocked = blockedSlots.some(b => {
        // time_slot 기반 차단 (morning/afternoon/evening)
        if (b.time_slot) {
          const slotHour = hours;
          if (b.time_slot === 'morning' && slotHour < 12) return true;
          if (b.time_slot === 'afternoon' && slotHour >= 12 && slotHour < 18) return true;
          if (b.time_slot === 'evening' && slotHour >= 18) return true;
          return false;
        }
        // 기존 is_all_day / start_time~end_time 기반 차단
        if (b.is_all_day && !b.time_slot) return true;
        if (!b.start_time || !b.end_time) return false;
        return timeStr >= b.start_time && timeStr < b.end_time;
      });

      // 기존 예약 수 체크
      const reservation = existingReservations.find(r => r.preferred_time === timeStr);
      const reservationCount = reservation ? reservation.count : 0;
      const isFullyBooked = reservationCount >= maxReservations;

      // 최소 N시간 전 예약 체크 (DB 설정값 사용)
      const now = new Date();

      // 슬롯 시간 (한국 시간 기준)
      const slotDateTime = new Date(`${date}T${timeStr}+09:00`);

      // 최소 예약 가능 시간 (현재 시간 + minAdvanceHours)
      const minBookableTime = new Date(now.getTime() + (minAdvanceHours * 60 * 60 * 1000));

      const isPast = slotDateTime <= minBookableTime;

      slots.push({
        time: timeStr.substring(0, 5), // HH:MM 형식
        available: !isBlocked && !isFullyBooked && !isPast,
        reason: isBlocked ? 'blocked' : isFullyBooked ? 'fully_booked' : isPast ? 'past' : null
      });

      currentMinutes += slotDuration;
    }

    res.json({
      date,
      slots,
      slotDuration
    });
  } catch (error) {
    logger.error('슬롯 조회 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

// POST /paca/public/consultation/:slug/apply - 상담 신청
router.post('/consultation/:slug/apply', async (req, res) => {
  try {
    const { slug } = req.params;
    const {
      consultationType,
      parentName,
      parentPhone,
      studentName,
      studentPhone,
      studentGrade,
      studentSchool,
      gender,
      academicScores,
      mockTestGrades,
      schoolGradeAvg,
      admissionType,
      targetSchool,
      referrerStudent,
      referralSource,
      referralSources,
      inquiryContent,
      preferredDate,
      preferredTime
    } = req.body;

    // 필수 필드 검증 (학생 이름, 연락처, 학년, 학교, 일정)
    if (!studentName) {
      return res.status(400).json({ error: '학생 이름을 입력해주세요.' });
    }
    if (!studentPhone && !parentPhone) {
      return res.status(400).json({ error: '연락처를 입력해주세요.' });
    }
    if (!studentGrade) {
      return res.status(400).json({ error: '학년을 선택해주세요.' });
    }
    if (!studentSchool) {
      return res.status(400).json({ error: '학교를 입력해주세요.' });
    }
    if (!preferredDate || !preferredTime) {
      return res.status(400).json({ error: '상담 일정을 선택해주세요.' });
    }

    // 연락처: studentPhone 우선, 없으면 parentPhone 사용
    const contactPhone = studentPhone || parentPhone;

    // 학원 정보 조회
    const [academies] = await db.query(
      `SELECT a.id, a.name, cs.is_enabled, cs.send_confirmation_alimtalk
       FROM academies a
       LEFT JOIN consultation_settings cs ON a.id = cs.academy_id
       WHERE a.slug = ?`,
      [slug]
    );

    if (academies.length === 0) {
      return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });
    }

    const academy = academies[0];

    if (academy.is_enabled === false) {
      return res.status(403).json({ error: '현재 상담 예약이 불가능합니다.' });
    }

    // 해당 시간대 예약 가능 여부 재확인
    const [existingCount] = await db.query(
      `SELECT COUNT(*) as count FROM consultations
       WHERE academy_id = ? AND preferred_date = ? AND preferred_time = ?
       AND status NOT IN ('cancelled')`,
      [academy.id, preferredDate, preferredTime + ':00']
    );

    const [settings] = await db.query(
      `SELECT max_reservations_per_slot FROM consultation_settings WHERE academy_id = ?`,
      [academy.id]
    );

    const maxReservations = settings[0]?.max_reservations_per_slot || 1;

    if (existingCount[0].count >= maxReservations) {
      return res.status(409).json({ error: '선택하신 시간대는 이미 예약이 완료되었습니다. 다른 시간을 선택해주세요.' });
    }

    // 기존 학생 매칭 (전화번호로)
    const [existingStudents] = await db.query(
      `SELECT id, name FROM students
       WHERE academy_id = ? AND (phone = ? OR parent_phone = ?)
       AND status = 'active' AND deleted_at IS NULL
       LIMIT 1`,
      [academy.id, contactPhone, contactPhone]
    );

    const linkedStudentId = existingStudents.length > 0 ? existingStudents[0].id : null;

    // 성적 정보 통합 (academicScores에 모의고사, 내신, 입시유형 포함)
    const fullAcademicScores = {
      ...academicScores,
      mockTestGrades: mockTestGrades || null,
      schoolGradeAvg: schoolGradeAvg || null,
      admissionType: admissionType || null
    };

    // referralSource를 referralSources 배열로 변환 (단일값 -> 배열)
    const referralSourcesArray = referralSource ? [referralSource] : (referralSources || null);

    // 상담 신청 저장
    const [result] = await db.query(
      `INSERT INTO consultations (
        academy_id, consultation_type,
        parent_name, parent_phone,
        student_name, student_grade, student_school, gender,
        academic_scores, target_school, referrer_student,
        referral_sources, inquiry_content,
        preferred_date, preferred_time,
        linked_student_id, status
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [
        academy.id,
        consultationType || 'new_registration',
        parentName || studentName, // 학부모 이름이 없으면 학생 이름 사용
        contactPhone,
        studentName,
        studentGrade,
        studentSchool || null,
        gender || null,  // 성별 추가
        JSON.stringify(fullAcademicScores),
        targetSchool || null,
        referrerStudent || null,
        referralSourcesArray ? JSON.stringify(referralSourcesArray) : null,
        inquiryContent || null,
        preferredDate,
        preferredTime + ':00',
        linkedStudentId
      ]
    );

    const consultationId = result.insertId;

    // 새 상담 예약 푸시 알림 발송 (비동기)
    logger.info(`[상담신청] 푸시 알림 발송 시도 - academy ${academy.id}`);
    sendNewConsultationPush(academy.id, academy.name, {
      studentName,
      preferredDate,
      preferredTime,
      consultationId
    }).catch(err => logger.error('[NewConsultationPush] 오류:', err));

    res.status(201).json({
      message: '상담 신청이 완료되었습니다.',
      consultationId,
      // 보안: 학생 이름은 노출하지 않음 (id만 반환)
      linkedStudent: linkedStudentId ? { id: linkedStudentId } : null
    });
  } catch (error) {
    logger.error('상담 신청 오류:', error);
    res.status(500).json({ error: '서버 오류가 발생했습니다.' });
  }
});

/**
 * 새 상담 예약 푸시 알림 발송
 */
async function sendNewConsultationPush(academyId, academyName, consultation) {
    try {
        logger.info(`[NewConsultationPush] 시작 - 학원 ${academyId}`);

        // new_consultation 알림을 활성화한 학원장의 구독만 조회
        const [subscriptions] = await db.query(
            `SELECT ps.*
             FROM push_subscriptions ps
             JOIN users u ON ps.user_id = u.id
             LEFT JOIN user_notification_settings ns ON u.id = ns.user_id
             WHERE u.academy_id = ?
               AND u.role = 'owner'
               AND (ns.new_consultation IS NULL OR ns.new_consultation = TRUE)`,
            [academyId]
        );

        logger.info(`[NewConsultationPush] 구독 ${subscriptions.length}개 조회됨`);

        if (subscriptions.length === 0) {
            logger.info(`[NewConsultationPush] 구독 없음 - 종료`);
            return;
        }

        const dateStr = new Date(consultation.preferredDate).toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric'
        });
        const timeStr = consultation.preferredTime;

        const payload = JSON.stringify({
            title: '📝 새 상담 예약',
            body: `${consultation.studentName} - ${dateStr} ${timeStr}`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'new_consultation',
                url: '/consultations',
                academyId,
                consultationId: consultation.consultationId
            }
        });

        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, payload);
                logger.info(`[NewConsultationPush] 발송 성공 - user ${sub.user_id}`);
            } catch (error) {
                logger.error(`[NewConsultationPush] 발송 실패 - user ${sub.user_id}:`, error.message);
                // 만료된 구독 삭제
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                    logger.info(`[NewConsultationPush] 만료된 구독 삭제 - id ${sub.id}`);
                }
            }
        }

        logger.info(`[NewConsultationPush] 학원 ${academyId}: 새 상담 알림 발송 완료`);
    } catch (error) {
        logger.error('[NewConsultationPush] 오류:', error);
    }
}

router.use(require('./public/reservation'));
router.use(require('./public/checkSlug'));

module.exports = router;
