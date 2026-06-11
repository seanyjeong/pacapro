/**
 * routes/consultations/write — 상담 수정/등록/연결 (Phase 3 #2)
 *
 * Endpoints:
 *   PUT  /:id              — 상담 수정 (상태 / 메모 / 일정 / 체크리스트 / 학생정보 dynamic update)
 *                            상태 confirmed 전환 시 예약번호 자동 발급 + 알림톡 비동기 발송
 *                            (단, learning 타입 상담은 알림톡 발송 제외)
 *                            연결된 학생이 있으면 students 테이블도 동기화
 *                            상태 completed 전환 시 학생 미연결 신규상담이면
 *                            미등록관리(pending) 학생 자동 생성 + 연결 (learning 제외)
 *   POST /direct           — 관리자가 직접 상담 등록 (201, consultation_type='new_registration', status='confirmed')
 *   POST /:id/link-student — 상담을 기존 학생과 연결 (linked_student_id UPDATE)
 *
 * 인증: verifyToken (endpoint 단위, 원본 보존)
 *
 * DB: pool.execute (ADR-005).
 *
 * 응답 표면 보존 (ADR-013):
 *   - PUT /:id              : { message, reservationNumber, alimtalkSent }
 *   - POST /direct          : { message, id } (201)
 *   - POST /:id/link-student: { message, linkedStudent: {...decrypted student row} }
 *   - 4xx : { error: '<한국어>' }
 *   - 5xx : { error: '<한국어>' } — e.message 누출 0건 (ADR-003)
 *
 * 보안 (ADR-007):
 *   - encrypt 시그니처 무변경 (parent_phone 암호화).
 *   - sendConfirmationAlimtalk 헬퍼 호출 셰이프 무변경.
 *   - decryptConsultationNames 헬퍼 호출 셰이프 무변경 (link-student 응답).
 *
 * 분리 미루기 (ADR-015): PUT /:id 는 18+ 필드 dynamic update + camelCase/snake_case 호환 +
 * academic_scores JSON 머지 + reservation_number 자동 발급 + 학생 동기화 + 알림톡 분기까지
 * 강결합. 본 sub-라우터 안에서 ADR-005 / ADR-003 정렬만 수행. 추가 분리는 Phase 3 후반
 * 또는 응답 표면 표준화 트랙 진입 시 별도 검토.
 */

const {
    pool,
    verifyToken,
    encrypt,
    decryptConsultationNames,
    generateReservationNumber,
    createPendingStudentFromConsultation,
    sendConfirmationAlimtalk,
    logger,
} = require('./_utils');

module.exports = function (router) {
    // ============================================
    // PUT /paca/consultations/:id — 상담 수정 (상태/메모/체크리스트/학생정보)
    // ============================================
    router.put('/:id', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;
            const {
                status, adminNotes, preferredDate, preferredTime, checklist, consultationMemo,
                // 학생 정보 수정 필드 (snake_case + camelCase 둘 다 지원)
                student_name, student_grade, student_school, gender,
                studentName, studentGrade, studentSchool,
                mockTestGrades, schoolGradeAvg, admissionType,
                target_school, targetSchool, referrerStudent,
                parent_phone, parentPhone
            } = req.body;

            // camelCase → snake_case 호환
            const _student_name = student_name || studentName;
            const _student_grade = student_grade || studentGrade;
            const _student_school = student_school !== undefined ? student_school : studentSchool;
            const _parent_phone = parent_phone !== undefined ? parent_phone : parentPhone;
            const _target_school = target_school !== undefined ? target_school : targetSchool;

            // 기존 상담 확인 (현재 상태 포함)
            const [existing] = await pool.execute(
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
            if (_student_name !== undefined) {
                updates.push('student_name = ?');
                params.push(_student_name);
                // parent_name 도 같이 업데이트
                updates.push('parent_name = ?');
                params.push(_student_name);
            }

            if (_student_grade !== undefined) {
                updates.push('student_grade = ?');
                params.push(_student_grade);
            }

            if (_student_school !== undefined) {
                updates.push('student_school = ?');
                params.push(_student_school || null);
            }

            if (_parent_phone !== undefined) {
                updates.push('parent_phone = ?');
                params.push(_parent_phone ? encrypt(_parent_phone) : null);
            }

            if (gender !== undefined) {
                updates.push('gender = ?');
                params.push(gender || null);
            }

            if (_target_school !== undefined) {
                updates.push('target_school = ?');
                params.push(_target_school || null);
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
                } catch (e) {
                    existingScores = {};
                }

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

            await pool.execute(
                `UPDATE consultations SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            // 연결된 학생이 있으면 students 테이블도 동기화
            if (currentConsultation.linked_student_id) {
                const studentUpdates = [];
                const studentParams = [];
                if (_student_name !== undefined) { studentUpdates.push('name = ?'); studentParams.push(_student_name); }
                if (_student_grade !== undefined) { studentUpdates.push('grade = ?'); studentParams.push(_student_grade); }
                if (_student_school !== undefined) { studentUpdates.push('school = ?'); studentParams.push(_student_school || null); }
                if (gender !== undefined) { studentUpdates.push('gender = ?'); studentParams.push(gender || null); }
                if (_parent_phone !== undefined) { studentUpdates.push('parent_phone = ?'); studentParams.push(_parent_phone ? encrypt(_parent_phone) : null); }
                if (studentUpdates.length > 0) {
                    studentParams.push(currentConsultation.linked_student_id);
                    await pool.execute(`UPDATE students SET ${studentUpdates.join(', ')} WHERE id = ?`, studentParams);
                }
            }

            // 상태가 completed 로 변경되는데 학생 미연결 신규상담이면 미등록관리(pending) 학생 자동 생성
            // (체험등록/미등록관리 버튼을 안 누르고 상담만 완료한 학생도 미등록관리 탭에 잡히도록)
            const wasNotCompleted = currentConsultation.status !== 'completed';
            const willBeCompleted = status === 'completed';
            if (wasNotCompleted && willBeCompleted
                && !currentConsultation.linked_student_id
                && currentConsultation.consultation_type !== 'learning') {
                try {
                    // 같은 요청에서 수정된 학생 정보가 있으면 반영한 값으로 생성
                    const consultationForPending = {
                        ...currentConsultation,
                        student_name: _student_name !== undefined ? _student_name : currentConsultation.student_name,
                        student_grade: _student_grade !== undefined ? _student_grade : currentConsultation.student_grade,
                        student_school: _student_school !== undefined ? (_student_school || null) : currentConsultation.student_school,
                        gender: gender !== undefined ? (gender || null) : currentConsultation.gender,
                        parent_phone: _parent_phone !== undefined ? _parent_phone : currentConsultation.parent_phone,
                        preferred_date: preferredDate || currentConsultation.preferred_date,
                    };
                    const pendingStudentId = await createPendingStudentFromConsultation(consultationForPending, {
                        memo: consultationMemo !== undefined ? consultationMemo : currentConsultation.consultation_memo,
                    });
                    logger.info(`[ConsultationAutoPending] 상담 ${id} 완료 → 미등록관리 학생 ${pendingStudentId} 자동 생성`);
                } catch (err) {
                    // 자동 전환 실패해도 상담 수정 자체는 성공 처리
                    logger.error('[ConsultationAutoPending] 자동 전환 오류:', err);
                }
            }

            // 상태가 confirmed 로 변경되면 알림톡 발송
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
                sendConfirmationAlimtalk(updatedConsultation, academyId).catch((err) => {
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

    // ============================================
    // POST /paca/consultations/direct — 관리자가 직접 상담 등록
    //   주의: /:id 보다 먼저 등록 (index.js 등록 순서 참조)
    // ============================================
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

            // 상담 등록 (관리자 등록이므로 바로 confirmed)
            // parent_name, parent_phone 은 NOT NULL 이라 학생 정보로 대체
            const [result] = await pool.execute(
                `INSERT INTO consultations (
                    academy_id, consultation_type, parent_name, parent_phone,
                    student_name, student_grade, student_school, gender,
                    academic_scores, target_school, referrer_student,
                    preferred_date, preferred_time, status, admin_notes,
                    checklist, consultation_memo, created_at
                ) VALUES (?, 'new_registration', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'confirmed', ?, NULL, NULL, NOW())`,
                [
                    academyId,
                    studentName,  // parent_name 에 학생명
                    phone,        // parent_phone 에 전화번호
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

    // ============================================
    // POST /paca/consultations/:id/link-student — 기존 학생과 연결
    // ============================================
    router.post('/:id/link-student', verifyToken, async (req, res) => {
        try {
            const { id } = req.params;
            const academyId = req.user.academy_id;
            const { studentId } = req.body;

            // 상담 존재 확인
            const [existing] = await pool.execute(
                'SELECT id FROM consultations WHERE id = ? AND academy_id = ?',
                [id, academyId]
            );

            if (existing.length === 0) {
                return res.status(404).json({ error: '상담 신청을 찾을 수 없습니다.' });
            }

            // 학생 존재 확인
            const [students] = await pool.execute(
                'SELECT id, name FROM students WHERE id = ? AND academy_id = ?',
                [studentId, academyId]
            );

            if (students.length === 0) {
                return res.status(404).json({ error: '학생을 찾을 수 없습니다.' });
            }

            await pool.execute(
                'UPDATE consultations SET linked_student_id = ? WHERE id = ?',
                [studentId, id]
            );

            res.json({
                message: '학생이 연결되었습니다.',
                linkedStudent: decryptConsultationNames({ ...students[0] })
            });
        } catch (error) {
            logger.error('학생 연결 오류:', error);
            res.status(500).json({ error: '서버 오류가 발생했습니다.' });
        }
    });
};
