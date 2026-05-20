/**
 * paca/schedules/attendance.js — 학생 출결 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./attendance')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (2건):
 *   - GET  /:id/attendance — 출석 현황 조회 (시즌/비시즌 동적 학생 매칭 + 보충 학생 + 정렬)
 *   - POST /:id/attendance — 출석 일괄 제출 (트랜잭션 + 체험생 trial_remaining 차감/복구 + 자동 pending 전환)
 *
 * 인증: 2건 모두 verifyToken 만 (강사도 출석 입력 가능).
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getAttendance/submitAttendance):
 *     - GET  /:id/attendance → { message, schedule, season, students }
 *         schedule 객체: { id, class_date, time_slot, instructor_name, title, attendance_taken }
 *         season 객체:   { id, season_name, season_type, target_grades } 또는 null
 *         students 배열: 각 항목 { student_id, student_name (복호화), student_number, student_type,
 *                                  is_trial, attendance_status, makeup_date, notes, is_expected,
 *                                  is_makeup, original_date?, is_season_student }
 *     - POST /:id/attendance → { message, schedule_id, class_date, attendance_records[] }
 *         attendance_records: { student_id, student_name (복호화), attendance_status, makeup_date,
 *                               notes, is_trial, trial_remaining } 또는 { student_id,
 *                               attendance_status: null, cleared: true } (none 처리)
 *     - 4xx/5xx               → { error, message }
 *
 * 동적 조회 방식 (GET):
 *   1. 스케줄 날짜 기준 활성 시즌 확인
 *   2. 시즌 있으면 → 시즌 등록 학생 중 시간대 맞는 학년 조회
 *   3. 시즌 없으면 → class_days 매칭 학생 (고1/고2/공무원/성인 등)
 *   4. 보충 학생 추가 (a.makeup_date = 해당 날짜 + a.attendance_status='makeup')
 *   5. 정렬: 체험 → 일반 → 보충, 가나다순
 *
 * POST 트랜잭션 흐름:
 *   - attendance_status='none' → attendance UPDATE 만 (status NULL 로) + 체험생이었으면 trial_remaining +1 복구
 *   - 정상 status (present/absent/late/excused/makeup) → UPSERT attendance + 체험생이면 trial_remaining -1 차감
 *   - trial_remaining 0 도달 시 students.status='pending', is_trial=0 자동 전환
 *   - FOR UPDATE 행 잠금으로 동시 출석체크 시 중복 차감 방지
 *
 * DB 호출 (ADR-005): 원본 db.query / connection.query 그대로 보존 (분리 단계 — pool/conn alias).
 *
 * ADR-016 IN 절: GET 의 `s.grade IN (?)` 1건 — 원본 db.query 자동 펼침 의존. 분리 단계에서는
 *   원본 동작 1:1 보존 (db.query 잔존). pool.execute 단독 마이그레이션 시 명시 전개 필요.
 *
 * 보안 (ADR-007):
 *   - decrypt 시그니처 무변경 (학생 이름 + 강사 이름 복호화).
 *   - FOR UPDATE 행 잠금 보존 (보안 가드).
 *
 * 분리 결정 (ADR-006): 단일 파일 ~510줄 — POST endpoint 가 매우 크지만 단일 트랜잭션 +
 *   체험생 차감/복구 로직 강결합으로 추가 분리 시 회귀 위험. ADR-015 분리 미루기.
 */

const { db, decrypt, logger } = require('./_utils');
const { verifyToken } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/schedules/:id/attendance
 * Get attendance status for a specific class
 *
 * 동적 조회 방식:
 * 1. 스케줄 날짜 기준으로 활성 시즌 확인
 * 2. 시즌이 있으면 → 해당 시즌에 등록된 학생 중 시간대에 맞는 학년 학생 조회
 * 3. 시즌이 없으면 → class_days 매칭 학생 조회 (고1, 고2, 공무원/성인)
 *
 * Access: owner, admin, teacher
 */
router.get('/:id/attendance', verifyToken, async (req, res) => {
    const scheduleId = parseInt(req.params.id);

    try {
        // Get schedule details
        const [schedules] = await db.query(
            `SELECT
                cs.id,
                cs.class_date,
                cs.time_slot,
                cs.title,
                cs.attendance_taken,
                i.name AS instructor_name
            FROM class_schedules cs
            LEFT JOIN instructors i ON cs.instructor_id = i.id
            WHERE cs.id = ?
            AND cs.academy_id = ?`,
            [scheduleId, req.user.academyId]
        );

        if (schedules.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '수업을 찾을 수 없습니다.'
            });
        }

        const schedule = schedules[0];
        const classDateStr = typeof schedule.class_date === 'string'
            ? schedule.class_date
            : schedule.class_date.toISOString().split('T')[0];
        const classDate = new Date(classDateStr + 'T00:00:00');
        const dayOfWeek = classDate.getDay();

        let students = [];
        let seasonInfo = null;

        // 1. 스케줄 날짜에 활성화된 시즌 찾기
        const [activeSeasons] = await db.query(
            `SELECT id, season_name, season_type, grade_time_slots, operating_days
            FROM seasons
            WHERE academy_id = ?
            AND status = 'active'
            AND season_start_date <= ?
            AND season_end_date >= ?`,
            [req.user.academyId, classDateStr, classDateStr]
        );

        if (activeSeasons.length > 0) {
            // 시즌 기간 내 - 시즌 등록 학생 조회
            const season = activeSeasons[0];
            const gradeTimeSlots = typeof season.grade_time_slots === 'string'
                ? JSON.parse(season.grade_time_slots)
                : season.grade_time_slots;

            // 현재 시간대에 맞는 학년 찾기
            let targetGrades = [];
            if (gradeTimeSlots) {
                for (const [grade, timeSlots] of Object.entries(gradeTimeSlots)) {
                    // timeSlots가 배열인 경우 includes로 체크, 문자열인 경우 직접 비교
                    const slots = Array.isArray(timeSlots) ? timeSlots : [timeSlots];
                    if (slots.includes(schedule.time_slot)) {
                        targetGrades.push(grade);
                    }
                }
            }

            // 해당 시간대에 배정된 학년이 없으면 모든 시즌 등록 학생
            if (targetGrades.length === 0) {
                targetGrades = ['고3', 'N수'];
            }

            seasonInfo = {
                id: season.id,
                season_name: season.season_name,
                season_type: season.season_type,
                target_grades: targetGrades
            };

            // 시즌에 등록된 학생 중 해당 학년 학생 조회
            const [seasonStudents] = await db.query(
                `SELECT
                    s.id AS student_id,
                    s.name AS student_name,
                    s.student_number,
                    s.student_type,
                    s.is_trial,
                    s.grade,
                    s.class_days,
                    ss.id AS season_registration_id,
                    a.attendance_status,
                    a.makeup_date,
                    a.notes AS attendance_notes
                FROM students s
                INNER JOIN student_seasons ss ON ss.student_id = s.id AND ss.season_id = ?
                LEFT JOIN attendance a ON a.student_id = s.id AND a.class_schedule_id = ?
                WHERE s.academy_id = ?
                AND s.status = 'active'
                AND s.deleted_at IS NULL
                AND ss.payment_status != 'cancelled'
                AND s.grade IN (?)
                ORDER BY s.name ASC`,
                [season.id, scheduleId, req.user.academyId, targetGrades]
            );

            students = seasonStudents;
        }

        // 2. 비시즌 또는 시즌 학생 외에 class_days 매칭 학생도 조회 (고1, 고2, 공무원/성인)
        // 시즌에 등록되지 않은 학생 중 해당 요일에 수업 있는 학생
        const [regularStudents] = await db.query(
            `SELECT
                s.id AS student_id,
                s.name AS student_name,
                s.student_number,
                s.student_type,
                s.is_trial,
                s.grade,
                s.class_days,
                NULL AS season_registration_id,
                a.attendance_status,
                a.makeup_date,
                a.notes AS attendance_notes
            FROM students s
            LEFT JOIN student_seasons ss ON ss.student_id = s.id
                AND ss.payment_status != 'cancelled'
                AND ss.season_id IN (
                    SELECT id FROM seasons
                    WHERE academy_id = ? AND status = 'active'
                    AND season_start_date <= ? AND season_end_date >= ?
                )
            LEFT JOIN attendance a ON a.student_id = s.id AND a.class_schedule_id = ?
            WHERE s.academy_id = ?
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            AND ss.id IS NULL
            AND (
                JSON_CONTAINS(s.class_days, CAST(? AS JSON))
                OR JSON_CONTAINS(s.class_days, CAST(? AS JSON))
            )
            ORDER BY s.name ASC`,
            [req.user.academyId, classDateStr, classDateStr, scheduleId, req.user.academyId, JSON.stringify(dayOfWeek), JSON.stringify({day: dayOfWeek})]
        );

        // 기존 학생 ID Set 생성
        const existingIds = new Set(students.map(s => s.student_id));
        // 중복 제거하며 추가
        for (const student of regularStudents) {
            if (!existingIds.has(student.student_id)) {
                students.push(student);
            }
        }

        // 3. Get students who have makeup scheduled for this date
        const [makeupStudents] = await db.query(
            `SELECT
                s.id AS student_id,
                s.name AS student_name,
                s.student_number,
                s.student_type,
                a.attendance_status AS original_status,
                cs.class_date AS original_date,
                a.notes AS attendance_notes
            FROM attendance a
            INNER JOIN students s ON a.student_id = s.id
            INNER JOIN class_schedules cs ON a.class_schedule_id = cs.id
            WHERE a.makeup_date = ?
            AND a.attendance_status = 'makeup'
            AND s.academy_id = ?
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            ORDER BY s.name ASC`,
            [classDateStr, req.user.academyId]
        );

        // 4. Create student list with attendance info (decrypt names)
        const studentsWithInfo = students.map(student => ({
            student_id: student.student_id,
            student_name: decrypt(student.student_name),
            student_number: student.student_number,
            student_type: student.student_type,
            is_trial: !!student.is_trial,
            attendance_status: student.attendance_status || null,
            makeup_date: student.makeup_date || null,
            notes: student.attendance_notes || '',
            is_expected: true,
            is_makeup: false,
            is_season_student: !!student.season_registration_id
        }));

        // 5. Add makeup students (avoid duplicates)
        const existingStudentIds = new Set(studentsWithInfo.map(s => s.student_id));
        for (const makeup of makeupStudents) {
            if (!existingStudentIds.has(makeup.student_id)) {
                const originalDateStr = typeof makeup.original_date === 'string'
                    ? makeup.original_date
                    : makeup.original_date?.toISOString().split('T')[0];
                studentsWithInfo.push({
                    student_id: makeup.student_id,
                    student_name: decrypt(makeup.student_name),
                    student_number: makeup.student_number,
                    student_type: makeup.student_type,
                    attendance_status: 'present', // 보충으로 온 학생은 기본적으로 출석 처리 제안
                    makeup_date: null,
                    notes: makeup.attendance_notes || '',
                    is_expected: false,
                    is_makeup: true,
                    original_date: originalDateStr,
                    is_season_student: false
                });
            }
        }

        // 정렬: 체험생 먼저, 그 다음 가나다순
        studentsWithInfo.sort((a, b) => {
            // 1. 체험생 우선
            if (a.is_trial && !b.is_trial) return -1;
            if (!a.is_trial && b.is_trial) return 1;
            // 2. 보충 학생은 뒤로
            if (a.is_makeup && !b.is_makeup) return 1;
            if (!a.is_makeup && b.is_makeup) return -1;
            // 3. 가나다순
            return (a.student_name || '').localeCompare(b.student_name || '', 'ko');
        });

        res.json({
            message: 'Attendance records retrieved',
            schedule: {
                id: schedule.id,
                class_date: schedule.class_date,
                time_slot: schedule.time_slot,
                instructor_name: decrypt(schedule.instructor_name),
                title: schedule.title,
                attendance_taken: schedule.attendance_taken
            },
            season: seasonInfo ? {
                id: seasonInfo.id,
                season_name: seasonInfo.season_name,
                season_type: seasonInfo.season_type,
                target_grades: seasonInfo.target_grades
            } : null,
            students: studentsWithInfo
        });
    } catch (error) {
        logger.error('Error fetching attendance:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '출석 정보를 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/schedules/:id/attendance
 * Take attendance for a class
 * Access: owner, admin, teacher
 */
router.post('/:id/attendance', verifyToken, async (req, res) => {
    const scheduleId = parseInt(req.params.id);
    const connection = await db.getConnection();

    try {
        const { attendance_records } = req.body;

        // 디버깅 로그
        logger.info(`[Attendance] Schedule ${scheduleId}, received:`, JSON.stringify(attendance_records));

        // Validation
        if (!Array.isArray(attendance_records) || attendance_records.length === 0) {
            logger.info(`[Attendance] Validation failed - empty or not array`);
            connection.release();
            return res.status(400).json({
                error: 'Validation Error',
                message: 'attendance_records 는 비어있지 않은 배열이어야 합니다.'
            });
        }

        // Check if schedule exists
        const [schedules] = await connection.query(
            'SELECT id, class_date, time_slot FROM class_schedules WHERE id = ? AND academy_id = ?',
            [scheduleId, req.user.academyId]
        );

        if (schedules.length === 0) {
            connection.release();
            return res.status(404).json({
                error: 'Not Found',
                message: '수업을 찾을 수 없습니다.'
            });
        }

        const schedule = schedules[0];

        // Start transaction
        await connection.beginTransaction();

        const validStatuses = ['present', 'absent', 'late', 'excused', 'makeup'];
        const processedRecords = [];
        const notifyTargets = [];

        for (const record of attendance_records) {
            const { student_id, attendance_status, makeup_date, notes } = record;

            // attendance_status가 'none'이면 출석 상태만 NULL로 (학생은 목록에 유지)
            if (attendance_status === 'none') {
                logger.info(`[Attendance] Clearing attendance status for student ${student_id}`);

                // 체험생의 경우 기존 출석 상태 확인하여 trial_remaining 복구
                const [existingAtt] = await connection.query(
                    `SELECT a.attendance_status, s.id, s.is_trial, s.trial_remaining, s.status as student_status
                     FROM attendance a
                     JOIN students s ON a.student_id = s.id
                     WHERE a.class_schedule_id = ? AND a.student_id = ?`,
                    [scheduleId, student_id]
                );

                if (existingAtt.length > 0) {
                    const existing = existingAtt[0];
                    const wasAttended = ['present', 'late'].includes(existing.attendance_status);

                    // 체험생이었거나 현재 pending인데 원래 체험생이었던 경우, 출석했던 기록이 있으면 복구
                    if (wasAttended && (existing.is_trial || existing.student_status === 'pending')) {
                        // 현재 학생의 trial_dates 조회
                        const [studentData] = await connection.query(
                            'SELECT trial_dates FROM students WHERE id = ?',
                            [student_id]
                        );

                        // trial_remaining 복구
                        await connection.query(
                            'UPDATE students SET trial_remaining = trial_remaining + 1, is_trial = 1, status = ? WHERE id = ?',
                            ['trial', student_id]
                        );

                        // trial_dates의 attended 상태도 false로 복구
                        if (studentData.length > 0 && studentData[0].trial_dates) {
                            try {
                                let trialDates = studentData[0].trial_dates;
                                // JSON 문자열인 경우 파싱 (MySQL JSON 타입은 이미 객체로 반환될 수 있음)
                                if (typeof trialDates === 'string') {
                                    trialDates = JSON.parse(trialDates);
                                }
                                const dateObj = new Date(schedule.class_date);
                                const classDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                                const classTimeSlot = schedule.time_slot;

                                let idx = trialDates.findIndex(td => td.date === classDate && td.time_slot === classTimeSlot);
                                if (idx === -1) {
                                    idx = trialDates.findIndex(td => td.date === classDate && !td.time_slot);
                                }
                                if (idx !== -1 && trialDates[idx].attended) {
                                    trialDates[idx].attended = false;
                                    await connection.query(
                                        'UPDATE students SET trial_dates = ? WHERE id = ?',
                                        [JSON.stringify(trialDates), student_id]
                                    );
                                }
                            } catch (e) {
                                logger.error('Failed to restore trial_dates attended status:', e);
                            }
                        }

                        logger.info(`[Attendance] 체험생 ${student_id} 출석 취소 → trial_remaining +1, 상태 trial로 복구`);
                    }
                }

                await connection.query(
                    `UPDATE attendance SET attendance_status = NULL, notes = NULL WHERE class_schedule_id = ? AND student_id = ?`,
                    [scheduleId, student_id]
                );
                processedRecords.push({
                    student_id,
                    attendance_status: null,
                    cleared: true
                });
                continue;
            }

            // attendance_status가 null이거나 없으면 스킵 (중복 클릭 방지)
            if (!attendance_status) {
                logger.info(`[Attendance] Skipping student ${student_id} - no attendance_status`);
                continue;
            }

            // Validate attendance_status
            if (!validStatuses.includes(attendance_status)) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `유효하지 않은 출석 상태입니다: ${attendance_status}. (허용: ${validStatuses.join(', ')})`
                });
            }

            // Validate makeup_date if status is makeup
            if (attendance_status === 'makeup') {
                if (!makeup_date) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: '보충 처리 시 makeup_date 가 필요합니다.'
                    });
                }
                // Validate date format
                const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
                if (!dateRegex.test(makeup_date)) {
                    await connection.rollback();
                    connection.release();
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: 'makeup_date 는 YYYY-MM-DD 형식이어야 합니다.'
                    });
                }
            }

            // Verify student exists and belongs to academy
            // FOR UPDATE로 행 잠금하여 동시 출석체크 시 중복 차감 방지
            const [students] = await connection.query(
                'SELECT id, name, is_trial, trial_remaining, trial_dates FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL FOR UPDATE',
                [student_id, req.user.academyId]
            );

            if (students.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    error: 'Not Found',
                    message: `학생을 찾을 수 없습니다 (ID: ${student_id})`
                });
            }

            const student = students[0];

            // 기존 출석 상태 확인 (이미 출석 처리된 경우 중복 차감 방지)
            const [existingAttendance] = await connection.query(
                `SELECT attendance_status FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                [scheduleId, student_id]
            );
            const prevStatus = existingAttendance.length > 0
                ? existingAttendance[0].attendance_status
                : null;
            const wasAlreadyPresent = existingAttendance.length > 0 &&
                ['present', 'late'].includes(existingAttendance[0].attendance_status);

            // UPSERT attendance record with makeup_date
            await connection.query(
                `INSERT INTO attendance
                (class_schedule_id, student_id, attendance_status, makeup_date, notes, recorded_by)
                VALUES (?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                attendance_status = VALUES(attendance_status),
                makeup_date = VALUES(makeup_date),
                notes = VALUES(notes),
                recorded_by = VALUES(recorded_by),
                updated_at = CURRENT_TIMESTAMP`,
                [scheduleId, student_id, attendance_status, attendance_status === 'makeup' ? makeup_date : null, notes || null, req.user.id]
            );

            // 알림톡 발송 대상 수집 (트랜잭션 커밋 후 비동기 발송용)
            notifyTargets.push({ student_id, attendance_status, notes: notes || null, prevStatus });

            // 체험생이고 출석(present) 또는 지각(late)인 경우 trial_remaining 차감
            const isAttended = ['present', 'late'].includes(attendance_status);
            if (student.is_trial && isAttended && !wasAlreadyPresent && student.trial_remaining > 0) {
                await connection.query(
                    'UPDATE students SET trial_remaining = trial_remaining - 1 WHERE id = ?',
                    [student_id]
                );

                // trial_dates의 attended 상태도 업데이트 (현재 출석 체크하는 날짜 + 시간대 기준)
                if (student.trial_dates) {
                    try {
                        let trialDates = student.trial_dates;
                        // JSON 문자열인 경우 파싱 (MySQL JSON 타입은 이미 객체로 반환될 수 있음)
                        if (typeof trialDates === 'string') {
                            trialDates = JSON.parse(trialDates);
                        }
                        // 현재 스케줄 날짜를 YYYY-MM-DD 형식으로 변환 (UTC 문제 방지)
                        const dateObj = new Date(schedule.class_date);
                        const classDate = `${dateObj.getFullYear()}-${String(dateObj.getMonth() + 1).padStart(2, '0')}-${String(dateObj.getDate()).padStart(2, '0')}`;
                        const classTimeSlot = schedule.time_slot;
                        // 현재 날짜 + 시간대에 해당하는 항목 찾기
                        let idx = trialDates.findIndex(td => td.date === classDate && td.time_slot === classTimeSlot);
                        // time_slot이 없는 기존 데이터 호환: 날짜만으로도 매칭
                        if (idx === -1) {
                            idx = trialDates.findIndex(td => td.date === classDate && !td.time_slot);
                        }
                        if (idx !== -1 && !trialDates[idx].attended) {
                            trialDates[idx].attended = true;
                            await connection.query(
                                'UPDATE students SET trial_dates = ? WHERE id = ?',
                                [JSON.stringify(trialDates), student_id]
                            );
                        }
                    } catch (e) {
                        logger.error('Failed to update trial_dates:', e);
                    }
                }

                // 체험 횟수가 0이 되면 미등록관리(pending)로 자동 변경
                if (student.trial_remaining - 1 <= 0) {
                    await connection.query(
                        'UPDATE students SET status = ?, is_trial = 0 WHERE id = ?',
                        ['pending', student_id]
                    );
                    logger.info(`체험생 ${student_id} 체험 완료 → 미등록관리로 자동 변경`);
                }
            }

            processedRecords.push({
                student_id,
                student_name: decrypt(student.name),
                attendance_status,
                makeup_date: attendance_status === 'makeup' ? makeup_date : null,
                notes: notes || '',
                is_trial: student.is_trial,
                trial_remaining: student.is_trial && isAttended && !wasAlreadyPresent
                    ? student.trial_remaining - 1
                    : student.trial_remaining
            });
        }

        // Mark attendance as taken
        await connection.query(
            'UPDATE class_schedules SET attendance_taken = true WHERE id = ?',
            [scheduleId]
        );

        // Commit transaction
        await connection.commit();
        connection.release();

        res.json({
            message: `Attendance recorded for ${processedRecords.length} students`,
            schedule_id: scheduleId,
            class_date: schedule.class_date,
            attendance_records: processedRecords
        });

        // 출결 알림톡 비동기 발송 (fire-and-forget — 발송 실패가 출결 응답을 깨지 않음)
        if (notifyTargets.length > 0) {
            setImmediate(() =>
                require('../../utils/attendanceNotify').notifyAttendance({
                    pool: db,
                    decrypt,
                    academyId: req.user.academyId,
                    scheduleId,
                    classDate: schedule.class_date,
                    targets: notifyTargets
                }).catch(e => logger.error('[AttendanceNotify]', e))
            );
        }
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error recording attendance:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '출석 기록에 실패했습니다.'
        });
    }
});

};
