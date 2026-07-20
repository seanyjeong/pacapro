/**
 * paca/schedules/slot.js — 타임슬롯별 학생 배정/이동 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./slot')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (4건) — 모두 정적 /slot/* 경로 (/:id 보다 먼저 등록 필수):
 *   - GET    /slot         — 특정 날짜/타임슬롯 정보 + 배정 학생 + 가용 학생 (자동 생성/추가 로직 포함)
 *   - POST   /slot/student — 학생을 특정 슬롯에 추가 (보충 학생 옵션)
 *   - DELETE /slot/student — 학생을 특정 슬롯에서 제거
 *   - POST   /slot/move    — 학생을 다른 슬롯으로 이동
 *
 * 인증: GET = verifyToken / 나머지 3건 = verifyToken + checkPermission('schedules', 'edit').
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getSlotData):
 *     - GET    /slot         → { schedule: { id, students[] } | null, available_students }
 *     - POST   /slot/student → { message }
 *     - DELETE /slot/student → { message }
 *     - POST   /slot/move    → { message }
 *     - 4xx/5xx              → { error, message }
 *
 *   GET /slot 의 schedule 객체 안 students 배열은 정렬 (체험 → 일반 → 보충, 가나다순).
 *   학생 객체는 student_id / student_name (복호화) / grade / attendance_status / season_type /
 *   is_trial / trial_remaining / phone (복호화) / parent_phone (복호화) / is_makeup 등 포함.
 *
 * DB 호출 (ADR-005): 원본 db.query 그대로 보존 (분리 단계 — pool alias). ADR-005 단독 정렬은 별도 트랙.
 *
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007):
 *   - decrypt 시그니처 무변경 (학생 이름 / 전화 / 학부모 전화 복호화).
 *   - validateAttendance 시그니처 무변경 — 학생-학원 소속 검증 (POST /slot/student 의 보안 가드).
 *
 * 분리 결정 (ADR-006): 단일 파일 ~290줄 — 분리 불요.
 */

const { db, decrypt, validateAttendance, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/schedules/slot
 * 특정 날짜/타임슬롯의 정보 조회
 * Query: date, time_slot
 */
router.get('/slot', verifyToken, async (req, res) => {
    try {
        const { date, time_slot } = req.query;

        if (!date || !time_slot) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'date 와 time_slot 은 필수입니다.'
            });
        }

        // 해당 슬롯의 스케줄 조회
        const [schedules] = await db.query(
            `SELECT cs.*, i.name as instructor_name
             FROM class_schedules cs
             LEFT JOIN instructors i ON cs.instructor_id = i.id
             WHERE cs.academy_id = ? AND cs.class_date = ? AND cs.time_slot = ?`,
            [req.user.academyId, date, time_slot]
        );

        let schedule = schedules[0] || null;

        // 해당 요일 + 시간대에 수업이 있는 학생 조회 (enrollment_date 이전 제외)
        const dayOfWeek = new Date(date + 'T00:00:00').getDay();
        const [eligibleStudents] = await db.query(
            `SELECT s.id
             FROM students s
             WHERE s.academy_id = ?
             AND s.status = 'active'
             AND s.deleted_at IS NULL
             AND (
                (JSON_CONTAINS(s.class_days, CAST(? AS JSON)) AND s.time_slot = ?)
                OR JSON_CONTAINS(s.class_days, CAST(? AS JSON))
             )
             AND (s.enrollment_date IS NULL OR s.enrollment_date <= ?)`,
            [req.user.academyId, JSON.stringify(dayOfWeek), time_slot, JSON.stringify({day: dayOfWeek, timeSlot: time_slot}), date]
        );

        // 스케줄이 없으면: 현재 월까지만 + 해당 시간대에 학생이 있을 때만 자동 생성
        if (!schedule) {
            const now = new Date();
            const currentYearMonth = now.getFullYear() * 100 + (now.getMonth() + 1);
            const requestDate = new Date(date + 'T00:00:00');
            const requestYearMonth = requestDate.getFullYear() * 100 + (requestDate.getMonth() + 1);

            if (requestYearMonth > currentYearMonth) {
                // 다음 달 이후는 자동 생성하지 않음 (cron이 월말에 배정)
                return res.json({ schedule: null, students: [] });
            }
            if (eligibleStudents.length === 0) {
                // 해당 시간대에 학생이 없으면 빈 응답 반환 (스케줄 생성하지 않음)
                return res.json({ schedule: null, students: [] });
            }
            const [result] = await db.query(
                `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                 VALUES (?, ?, ?, 0)`,
                [req.user.academyId, date, time_slot]
            );
            schedule = { id: result.insertId, class_date: date, time_slot, attendance_taken: 0 };
        }

        // 아직 출석 기록 없는 학생 자동 추가 (enrollment_date 이전은 제외)
        const [missingStudents] = await db.query(
            `SELECT s.id
             FROM students s
             WHERE s.academy_id = ?
             AND s.status = 'active'
             AND s.deleted_at IS NULL
             AND (
                (JSON_CONTAINS(s.class_days, CAST(? AS JSON)) AND s.time_slot = ?)
                OR JSON_CONTAINS(s.class_days, CAST(? AS JSON))
             )
             AND s.id NOT IN (
                SELECT a.student_id FROM attendance a
                WHERE a.class_schedule_id = ?
             )
             AND (s.enrollment_date IS NULL OR s.enrollment_date <= ?)`,
            [req.user.academyId, JSON.stringify(dayOfWeek), time_slot, JSON.stringify({day: dayOfWeek, timeSlot: time_slot}), schedule.id, date]
        );

        // 누락된 학생들 자동 추가 (attendance_status = NULL로 추가)
        if (missingStudents.length > 0) {
            const values = missingStudents.map(s => [schedule.id, s.id, null, 0]);
            await db.query(
                `INSERT IGNORE INTO attendance (class_schedule_id, student_id, attendance_status, is_makeup)
                 VALUES ?`,
                [values]
            );
        }

        // 스케줄이 있으면 배정된 학생 조회 (시즌 정보, 체험생 정보, 전화번호, 보충 여부 포함)
        let students = [];
        if (schedule) {
            const [attendanceRecords] = await db.query(
                `SELECT DISTINCT a.student_id, s.name as student_name, s.grade, a.attendance_status,
                        a.notes,
                        s.is_trial, s.trial_remaining, s.trial_dates,
                        s.phone, s.parent_phone,
                        a.is_makeup,
                        (SELECT se2.season_type
                         FROM student_seasons ss2
                         JOIN seasons se2 ON ss2.season_id = se2.id
                         AND se2.academy_id = s.academy_id
                         WHERE ss2.student_id = s.id
                         AND ss2.is_cancelled = 0
                         AND ss2.payment_status != 'cancelled'
                         AND se2.status = 'active'
                         AND ? BETWEEN se2.season_start_date AND se2.season_end_date
                         LIMIT 1) as season_type
                 FROM attendance a
                 JOIN students s ON a.student_id = s.id
                 AND s.academy_id = ?
                 WHERE a.class_schedule_id = ?
                 AND s.deleted_at IS NULL
                 ORDER BY season_type IS NOT NULL DESC, s.name`,
                [date, req.user.academyId, schedule.id]
            );
            // 복호화
            students = attendanceRecords.map(s => ({
                ...s,
                student_name: s.student_name ? decrypt(s.student_name) : s.student_name,
                phone: s.phone ? decrypt(s.phone) : s.phone,
                parent_phone: s.parent_phone ? decrypt(s.parent_phone) : s.parent_phone
            }));

            // 정렬: 체험 먼저 → 일반 → 보충, 같은 그룹 내 가나다순
            students.sort((a, b) => {
                if (a.is_trial && !b.is_trial) return -1;
                if (!a.is_trial && b.is_trial) return 1;
                if (a.is_makeup && !b.is_makeup) return 1;
                if (!a.is_makeup && b.is_makeup) return -1;
                return (a.student_name || '').localeCompare(b.student_name || '', 'ko');
            });
        }

        // 해당 요일에 수업이 있는 학생 중 아직 배정되지 않은 학생 조회 (이미 자동 추가했으므로 비어있을 것)
        const [availableStudentsRaw] = await db.query(
            `SELECT s.id, s.name, s.grade, s.student_type, s.class_days
             FROM students s
             WHERE s.academy_id = ?
             AND s.status = 'active'
             AND s.deleted_at IS NULL
             AND (
                JSON_CONTAINS(s.class_days, CAST(? AS JSON))
                OR JSON_CONTAINS(s.class_days, CAST(? AS JSON))
             )
             AND s.id NOT IN (
                SELECT a.student_id FROM attendance a
                JOIN class_schedules cs ON a.class_schedule_id = cs.id
                WHERE cs.class_date = ? AND cs.academy_id = ?
             )
             ORDER BY s.name`,
            [req.user.academyId, JSON.stringify(dayOfWeek), JSON.stringify({day: dayOfWeek}), date, req.user.academyId]
        );

        // 복호화
        const availableStudents = availableStudentsRaw.map(s => ({
            ...s,
            name: s.name ? decrypt(s.name) : s.name
        }));

        res.json({
            schedule: schedule ? {
                ...schedule,
                instructor_name: schedule.instructor_name ? decrypt(schedule.instructor_name) : schedule.instructor_name,
                students
            } : null,
            available_students: availableStudents
        });
    } catch (error) {
        logger.error('Error fetching slot data:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '슬롯 정보를 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/schedules/slot/student
 * 학생을 특정 슬롯에 추가
 */
router.post('/slot/student', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const { date, time_slot, student_id } = req.body;

        if (!date || !time_slot || !student_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'date, time_slot, student_id 는 필수입니다.'
            });
        }

        // 해당 슬롯의 스케줄 조회 또는 생성
        let [schedules] = await db.query(
            `SELECT id FROM class_schedules
             WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
            [req.user.academyId, date, time_slot]
        );

        let scheduleId;
        if (schedules.length === 0) {
            // 스케줄이 없으면 생성
            const [result] = await db.query(
                `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                 VALUES (?, ?, ?, false)`,
                [req.user.academyId, date, time_slot]
            );
            scheduleId = result.insertId;
        } else {
            scheduleId = schedules[0].id;
        }

        // 이미 배정되어 있는지 확인
        const [existing] = await db.query(
            `SELECT id FROM attendance
             WHERE class_schedule_id = ? AND student_id = ?`,
            [scheduleId, student_id]
        );

        if (existing.length > 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 해당 수업에 배정된 학생입니다.'
            });
        }

        // [보안] 학생이 현재 학원 소속인지 검증
        const validation = await validateAttendance(student_id, scheduleId);
        if (!validation.valid) {
            logger.error(`[SECURITY] Blocked: ${validation.error}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: '해당 학생은 이 학원 소속이 아닙니다.'
            });
        }

        // 출석 기록 생성 (보충 학생이면 is_makeup = 1)
        const is_makeup = req.body.is_makeup ? 1 : 0;
        await db.query(
            `INSERT INTO attendance (class_schedule_id, student_id, attendance_status, is_makeup)
             VALUES (?, ?, NULL, ?)`,
            [scheduleId, student_id, is_makeup]
        );

        res.json({ message: is_makeup ? '보충 학생이 추가되었습니다.' : '학생이 배정되었습니다.' });
    } catch (error) {
        logger.error('Error adding student to slot:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 배정에 실패했습니다.'
        });
    }
});

/**
 * DELETE /paca/schedules/slot/student
 * 학생을 특정 슬롯에서 제거
 */
router.delete('/slot/student', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const { date, time_slot, student_id } = req.query;

        if (!date || !time_slot || !student_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'date, time_slot, student_id 는 필수입니다.'
            });
        }

        // 해당 슬롯의 스케줄 조회
        const [schedules] = await db.query(
            `SELECT id FROM class_schedules
             WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
            [req.user.academyId, date, time_slot]
        );

        if (schedules.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '해당 수업을 찾을 수 없습니다.'
            });
        }

        const validation = await validateAttendance(student_id, schedules[0].id);
        if (!validation.valid) {
            logger.error(`[SECURITY] Blocked slot removal: ${validation.error}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: '해당 학생은 이 학원 소속이 아닙니다.'
            });
        }

        // 출석 기록 삭제
        await db.query(
            `DELETE FROM attendance
             WHERE class_schedule_id = ? AND student_id = ?`,
            [schedules[0].id, student_id]
        );

        res.json({ message: '학생이 제거되었습니다.' });
    } catch (error) {
        logger.error('Error removing student from slot:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 제거에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/schedules/slot/move
 * 학생을 다른 슬롯으로 이동
 */
router.post('/slot/move', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const { date, from_slot, to_slot, student_id } = req.body;

        if (!date || !from_slot || !to_slot || !student_id) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'date, from_slot, to_slot, student_id 는 필수입니다.'
            });
        }

        // 출발 슬롯 스케줄 조회
        const [fromSchedules] = await db.query(
            `SELECT id FROM class_schedules
             WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
            [req.user.academyId, date, from_slot]
        );

        if (fromSchedules.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '출발 수업을 찾을 수 없습니다.'
            });
        }

        const validation = await validateAttendance(student_id, fromSchedules[0].id);
        if (!validation.valid) {
            logger.error(`[SECURITY] Blocked slot move: ${validation.error}`);
            return res.status(403).json({
                error: 'Forbidden',
                message: '해당 학생은 이 학원 소속이 아닙니다.'
            });
        }

        // 도착 슬롯 스케줄 조회 또는 생성
        let [toSchedules] = await db.query(
            `SELECT id FROM class_schedules
             WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
            [req.user.academyId, date, to_slot]
        );

        let toScheduleId;
        if (toSchedules.length === 0) {
            // 스케줄 생성
            const [result] = await db.query(
                `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                 VALUES (?, ?, ?, false)`,
                [req.user.academyId, date, to_slot]
            );
            toScheduleId = result.insertId;
        } else {
            toScheduleId = toSchedules[0].id;
        }

        // 출석 기록 이동 (class_schedule_id 변경)
        await db.query(
            `UPDATE attendance
             SET class_schedule_id = ?
             WHERE class_schedule_id = ? AND student_id = ?`,
            [toScheduleId, fromSchedules[0].id, student_id]
        );

        res.json({ message: '학생이 이동되었습니다.' });
    } catch (error) {
        logger.error('Error moving student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 이동에 실패했습니다.'
        });
    }
});

};
