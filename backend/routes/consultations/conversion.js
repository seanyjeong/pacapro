/**
 * routes/consultations/conversion — 상담 → 학생 전환 (Phase 3 #2)
 *
 * Endpoints:
 *   POST /:id/convert-to-trial    — 상담 완료 → 체험 학생 등록 (trial_dates 자동 스케줄 배정)
 *   POST /:id/convert-to-pending  — 상담 완료 → 미등록관리 학생 등록 (체험 없이)
 *
 * 인증: verifyToken (endpoint 단위, 원본 보존)
 *
 * DB: pool.execute (ADR-005).
 *   - SELECT consultation
 *   - INSERT students (이름/전화/학부모전화 암호화)
 *   - convert-to-trial: trial_dates 만큼 SELECT class_schedules → INSERT class_schedules (없을 때) →
 *                        INSERT attendance (ON DUPLICATE KEY UPDATE)
 *   - UPDATE consultations 상태 + linked_student_id
 *
 * 응답 표면 보존 (ADR-013):
 *   - convert-to-trial   : { message, studentId, trialDates: [{date, time_slot, attended}, ...] }
 *   - convert-to-pending : { message, studentId }
 *   - 400 : { error: '<한국어>' } — 입력 검증 / 이미 등록
 *   - 404 : { error: '<한국어>' } — 상담 미존재
 *   - 5xx : { error: '<한국어>' } — e.message 누출 0건 (ADR-003)
 *
 * 보안 (ADR-007): encrypt 시그니처 무변경. 이미 암호화된 값 (`ENC:` prefix) 은 재암호화 X
 * (원본 동일 isAlreadyEncrypted 가드 보존).
 *
 * 라우트 등록 순서 (index.js JSDoc 참조): conversion 은 `/:id/convert-*` 패턴이라 list-detail
 * 의 `/:id` 와 segment 수가 달라 충돌 X. write 의 `/:id/link-student` 와 같은 형태.
 */

const { pool, verifyToken, encrypt, logger, createPendingStudentFromConsultation } = require('./_utils');

module.exports = function (router) {
    // ============================================
    // POST /paca/consultations/:id/convert-to-trial — 체험 학생 등록
    // ============================================
    router.post('/:id/convert-to-trial', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;
            const { trialDates, studentPhone } = req.body; // [{ date, timeSlot }, ...]

            // 필수 검증 (최소 1개 이상)
            if (!trialDates || !Array.isArray(trialDates) || trialDates.length < 1) {
                return res.status(400).json({ error: '최소 1개의 체험 일정을 선택해주세요.' });
            }

            // 상담 정보 조회
            const [consultations] = await pool.execute(
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

            // trial_dates JSON 구조 (time_slot 키 사용 - students.js 와 통일)
            const trialDatesJson = trialDates.map((d) => ({
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

            const [studentResult] = await pool.execute(
                `INSERT INTO students (
                    academy_id, name, grade, school, gender, phone, parent_phone, status,
                    is_trial, trial_remaining, trial_dates, class_days, monthly_tuition, consultation_date, created_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, 'trial', 1, ?, ?, '[]', 0, ?, NOW())`,
                [
                    academyId,
                    encryptedName,
                    consultation.student_grade,
                    consultation.student_school || null,
                    consultation.gender || null,
                    encryptedPhone,
                    encryptedParentPhone,
                    trialDates.length,
                    JSON.stringify(trialDatesJson),
                    consultation.preferred_date
                ]
            );

            const studentId = studentResult.insertId;

            // 체험 일정을 스케줄에 자동 배정
            for (const trialDate of trialDatesJson) {
                const { date, time_slot } = trialDate;
                if (!date || !time_slot) continue;

                // 해당 날짜의 스케줄 찾기 또는 생성
                const [schedules] = await pool.execute(
                    `SELECT id FROM class_schedules WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                    [academyId, date, time_slot]
                );

                let scheduleId;
                if (schedules.length === 0) {
                    // 스케줄 없으면 생성
                    const [createResult] = await pool.execute(
                        `INSERT INTO class_schedules (academy_id, class_date, time_slot) VALUES (?, ?, ?)`,
                        [academyId, date, time_slot]
                    );
                    scheduleId = createResult.insertId;
                } else {
                    scheduleId = schedules[0].id;
                }

                // 출석 레코드 생성
                await pool.execute(
                    `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                     VALUES (?, ?, NULL)
                     ON DUPLICATE KEY UPDATE attendance_status = attendance_status`,
                    [scheduleId, studentId]
                );
            }

            // 상담 상태 업데이트 (확정 상태 유지 + 학생 연결)
            // NOTE: 체험 등록 시 completed로 변경하면 다시 confirmed로 바꿀 때 알림톡 중복 발송됨
            await pool.execute(
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

    // ============================================
    // POST /paca/consultations/:id/convert-to-pending — 미등록관리 학생 등록
    // ============================================
    router.post('/:id/convert-to-pending', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;
            const { studentPhone, memo } = req.body;

            // 상담 정보 조회
            const [consultations] = await pool.execute(
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

            // 미등록관리 학생 등록 (pending 상태) — 공용 헬퍼 (_utils.js)
            const studentId = await createPendingStudentFromConsultation(consultation, { studentPhone, memo });

            res.json({
                message: '미등록관리 학생으로 등록되었습니다.',
                studentId
            });
        } catch (error) {
            logger.error('미등록관리 학생 등록 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });
};
