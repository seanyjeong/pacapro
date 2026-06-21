/**
 * routes/consultations/calendar — 캘린더/검색 조회 (Phase 3 #2)
 *
 * Endpoints:
 *   GET /calendar/events         — 캘린더용 상담 일정 (날짜별 그룹화)
 *   GET /booked-times            — 특정 날짜의 예약된 시간 목록
 *   GET /by-student/:studentId   — 학생과 연결된 최신 상담 1건
 *
 * 인증: verifyToken (endpoint 단위, 원본 보존)
 *
 * DB: pool.execute (ADR-005).
 *
 * 응답 표면 보존 (ADR-013):
 *   - GET /calendar/events : { events: { [date]: [...] } }
 *   - GET /booked-times    : { date, bookedTimes: ['HH:MM', ...] }
 *   - GET /by-student/:id  : { consultation: {...} } — 프론트 pending-student-list / trial-student-list 직접 소비
 *   - 4xx : { error: '<한국어>' } — 입력 검증 / 미존재
 *   - 5xx : { error: '<한국어>' } — e.message 누출 0건 (ADR-003)
 *
 * 보안 (ADR-007): decrypt 헬퍼 시그니처 무변경, by-student 의 학생/학부모 정보 복호화.
 *
 * 라우트 등록 순서 (index.js JSDoc 참조):
 *  - 본 sub-라우터의 모든 경로는 고정 prefix (`/calendar/`, `/booked-times`, `/by-student/`).
 *    `/:id` 와일드카드 (list-detail / write / conversion) 보다 먼저 등록되어야 매칭 충돌 회피.
 */

const { pool, verifyToken, decrypt, decryptConsultationNames, logger } = require('./_utils');

module.exports = function (router) {
    // ============================================
    // GET /paca/consultations/calendar/events — 캘린더용 상담 일정
    // ============================================
    router.get('/calendar/events', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const { startDate, endDate } = req.query;

            if (!startDate || !endDate) {
                return res.status(400).json({ error: '시작일과 종료일이 필요합니다.' });
            }

            const [consultations] = await pool.execute(
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
                acc[date].push(decryptConsultationNames({ ...c }));
                return acc;
            }, {});

            res.json({ events: eventsByDate });
        } catch (error) {
            logger.error('캘린더 조회 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });

    // ============================================
    // GET /paca/consultations/booked-times — 특정 날짜의 예약된 시간 목록
    //   주의: /:id 보다 먼저 등록 (index.js 등록 순서 참조)
    // ============================================
    router.get('/booked-times', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const { date } = req.query;

            if (!date) {
                return res.status(400).json({ error: '날짜가 필요합니다.' });
            }

            // 해당 날짜의 취소/노쇼가 아닌 상담 시간 목록 조회
            const [consultations] = await pool.execute(
                `SELECT preferred_time
                 FROM consultations
                 WHERE academy_id = ?
                   AND preferred_date = ?
                   AND status NOT IN ('cancelled', 'no_show')
                 ORDER BY preferred_time`,
                [academyId, date]
            );

            // HH:MM 형식으로 반환
            const bookedTimes = consultations.map((c) => c.preferred_time.substring(0, 5));

            res.json({ date, bookedTimes });
        } catch (error) {
            logger.error('예약 시간 조회 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });

    // ============================================
    // GET /paca/consultations/by-student/:studentId — 학생과 연결된 상담 조회
    //   주의: /:id 보다 먼저 등록 (index.js 등록 순서 참조)
    // ============================================
    router.get('/by-student/:studentId', verifyToken, async (req, res) => {
        try {
            const academyId = req.user.academy_id;
            const { studentId } = req.params;

            const [consultations] = await pool.execute(
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

            // 민감 정보 복호화 (원본 동일 — 일부 필드만 명시 복호화)
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
};
