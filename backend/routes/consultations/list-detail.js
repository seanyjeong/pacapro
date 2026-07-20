/**
 * routes/consultations/list-detail — 상담 목록/상세/삭제 (Phase 3 #2)
 *
 * Endpoints:
 *   GET    /            — 상담 목록 (페이징 + 필터: status / startDate / endDate / search /
 *                          consultationType / page / limit, 학생 매칭 (이름+전화 키 매핑))
 *   GET    /:id         — 상담 상세 (학생 연결 정보 + JSON 필드 파싱)
 *   DELETE /:id         — 상담 삭제
 *
 * 인증: verifyToken (endpoint 단위, 원본 보존)
 *
 * DB: pool.execute (ADR-005).
 *   - GET / : COUNT(*) + SELECT (LEFT JOIN students) + GROUP BY status stats + 학생 목록 (필요 시)
 *
 * 주의 (LIMIT/OFFSET prepared statement 호환):
 *   - mysql2 prepared statement 는 LIMIT ? OFFSET ? 의 자리표시자에 정수만 허용한다.
 *     parseInt 결과를 그대로 push (원본 동일) — 정수 보장. 문자열 push 금지.
 *   - 본 endpoint 는 parseInt(limit) / offset 만 push 하므로 정수 보장 (원본 동일 유지).
 *
 * 응답 표면 보존 (ADR-013):
 *   - GET /            : { consultations: [...], pagination: { total, page, limit, totalPages },
 *                          stats: { [status]: count, ... } }
 *                          consultations[i] = { ...decrypted, academicScores, referralSources, matched_student_status }
 *                          프론트 ConsultationListResponse + page.tsx 필터/페이징 직접 소비.
 *   - GET /:id         : { ...consultation (root spread), academicScores, referralSources, checklist }
 *                          프론트 Consultation 타입 + page.tsx 가 직접 소비 (root spread 보존 필수).
 *   - DELETE /:id      : { message }
 *   - 4xx : { error: '<한국어>' }
 *   - 5xx : { error: '<한국어>' } — e.message 누출 0건 (ADR-003)
 *
 * 보안 (ADR-007): decrypt 헬퍼 시그니처 무변경. 학생 이름/전화 복호화는 in-memory only.
 *
 * 라우트 등록 순서 (index.js JSDoc 참조): list-detail 의 `/:id` 와일드카드는 마지막에 등록되어
 * 모든 고정 경로 (`/settings/*`, `/calendar/*`, `/booked-times`, `/by-student/*`,
 * `/direct`, `/learning`) 와 충돌 X.
 */

const { pool, verifyToken, decrypt, decryptConsultationNames, logger } = require('./_utils');

module.exports = function (router) {
    // ============================================
    // GET /paca/consultations — 상담 목록 (페이징 + 필터 + 학생 매칭)
    // ============================================
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
            const [countResult] = await pool.execute(
                `SELECT COUNT(*) as total FROM consultations c ${whereClause}`,
                params
            );
            const total = countResult[0].total;

            // 페이징 — mysql2 prepared statement (pool.execute) 는 LIMIT/OFFSET 자리표시자
            // 바인딩에 정수 인자를 받지 못하는 mysql 5.x 호환 이슈가 있음 (lesson #235).
            // SQL injection 안전을 위해 정수 검증 후 직접 인터폴레이트.
            const safeLimit = Math.max(1, Math.min(1000, parseInt(limit) || 20));
            const safeOffset = Math.max(0, (parseInt(page) - 1) * safeLimit);

            // 목록 조회
            const [consultations] = await pool.execute(
                `SELECT c.*, s.name as linked_student_name, s.is_trial as linked_student_is_trial
                 FROM consultations c
                 LEFT JOIN students s ON c.linked_student_id = s.id
                 AND s.academy_id = c.academy_id
                 ${whereClause}
                 ORDER BY c.preferred_date DESC, c.preferred_time DESC
                 LIMIT ${safeLimit} OFFSET ${safeOffset}`,
                params
            );

            // 상태별 통계
            const [stats] = await pool.execute(
                `SELECT status, COUNT(*) as count
                 FROM consultations
                 WHERE academy_id = ?
                 GROUP BY status`,
                [academyId]
            );

            // 완료된 상담이 있으면 학생 매칭을 위해 학생 목록 조회
            const hasCompletedConsultations = consultations.some((c) => c.status === 'completed');
            const studentsMap = new Map(); // 이름+전화번호 → 학생정보

            if (hasCompletedConsultations) {
                const [students] = await pool.execute(
                    `SELECT id, name, phone, parent_phone, status, is_trial, trial_dates FROM students WHERE academy_id = ?`,
                    [academyId]
                );

                // 복호화 후 Map 생성 (이름+학부모전화번호로 매칭)
                students.forEach((s) => {
                    const decryptedName = s.name ? decrypt(s.name) : '';
                    const decryptedParentPhone = s.parent_phone ? decrypt(s.parent_phone) : '';
                    const decryptedPhone = s.phone ? decrypt(s.phone) : '';

                    // trial_dates 파싱
                    let hasTrial = false;
                    try {
                        const trialDates = s.trial_dates
                            ? (typeof s.trial_dates === 'string' ? JSON.parse(s.trial_dates) : s.trial_dates)
                            : null;
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
                consultations: consultations.map((c) => {
                    // 복호화
                    const decrypted = decryptConsultationNames({ ...c });

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

    // ============================================
    // GET /paca/consultations/:id — 상담 상세 조회 (root spread 보존)
    // ============================================
    router.get('/:id', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;

            const [consultations] = await pool.execute(
                `SELECT c.*, s.name as linked_student_name, s.grade as linked_student_grade, s.is_trial as linked_student_is_trial
                 FROM consultations c
                 LEFT JOIN students s ON c.linked_student_id = s.id
                 AND s.academy_id = c.academy_id
                 WHERE c.id = ? AND c.academy_id = ?`,
                [id, academyId]
            );

            if (consultations.length === 0) {
                return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
            }

            // 복호화
            const consultation = decryptConsultationNames({ ...consultations[0] });

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

    // ============================================
    // DELETE /paca/consultations/:id — 상담 삭제
    // ============================================
    router.delete('/:id', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;

            const [result] = await pool.execute(
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
};
