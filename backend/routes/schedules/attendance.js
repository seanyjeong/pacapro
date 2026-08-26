/**
 * paca/schedules/attendance.js — 학생 출결 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./attendance')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (1건):
 *   - GET /:id/attendance — 출석 현황 조회 (시즌/비시즌 동적 학생 매칭 + 보충 학생 + 정렬)
 *   - POST 제출은 attendance-submit.js에서 처리한다.
 *
 * 인증: verifyToken 만 적용한다.
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getAttendance/submitAttendance):
 *     - GET  /:id/attendance → { message, schedule, season, students }
 *         schedule 객체: { id, class_date, time_slot, instructor_name, title, attendance_taken }
 *         season 객체:   { id, season_name, season_type, target_grades } 또는 null
 *         students 배열: 각 항목 { student_id, student_name (복호화), student_number, student_type,
 *                                  is_trial, attendance_status, makeup_date, notes, is_expected,
 *                                  is_makeup, original_date?, is_season_student }
 *     - 4xx/5xx               → { error, message }
 *
 * 동적 조회 방식 (GET):
 *   1. 스케줄 날짜 기준 활성 시즌 확인
 *   2. 시즌 있으면 → 시즌 등록 학생 중 시간대 맞는 학년 조회
 *   3. 시즌 없으면 → class_days 매칭 학생 (고1/고2/공무원/성인 등)
 *   4. 보충 학생 추가 (a.makeup_date = 해당 날짜 + a.attendance_status='makeup')
 *   5. 정렬: 체험 → 일반 → 보충, 가나다순
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
 * 분리 결정 (ADR-006): 조회와 제출을 각각 한 파일의 한 기능으로 분리한다.
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

};
