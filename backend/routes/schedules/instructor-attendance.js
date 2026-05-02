/**
 * paca/schedules/instructor-attendance.js — 강사 출결 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./instructor-attendance')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (4건):
 *   - GET  /:id/instructor-attendance        — 특정 스케줄의 강사 출결 + 학원 강사 목록
 *   - POST /:id/instructor-attendance        — 스케줄 기반 강사 출결 UPSERT (트랜잭션 + 급여 자동 계산)
 *   - GET  /date/:date/instructor-attendance — 날짜 기반 강사 출결 + 배정 강사 + 승인 미배정 출근
 *   - POST /date/:date/instructor-attendance — 날짜 기반 강사 출결 UPSERT (스케줄 없이도 가능)
 *
 * 인증:
 *   - GET /:id/instructor-attendance  = verifyToken
 *   - POST /:id/instructor-attendance = verifyToken + checkPermission('schedules', 'edit')
 *   - GET /date/:date/...             = verifyToken
 *   - POST /date/:date/...            = verifyToken + checkPermission('schedules', 'edit')
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getInstructorAttendanceByDate / submitInstructorAttendance):
 *     - GET  /:id/instructor-attendance        → { message, schedule, attendances }
 *     - POST /:id/instructor-attendance        → { message, schedule_id, class_date, attendance_records[] }
 *     - GET  /date/:date/instructor-attendance → { message, date, attendances, instructors, instructors_by_slot }
 *         instructors_by_slot: { morning: [...], afternoon: [...], evening: [...] }
 *           각 강사: { id, name (복호화), salary_type, scheduled_start_time, scheduled_end_time,
 *                     source: 'scheduled' | 'approved' }
 *     - POST /date/:date/instructor-attendance → { message, date, attendance_records[] }
 *     - 4xx/5xx                                 → { error, message }
 *
 * DB 호출 (ADR-005): 원본 db.query / connection.query 그대로 보존 (분리 단계 — pool/conn alias).
 *
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007):
 *   - decrypt 시그니처 무변경 (강사 이름 복호화).
 *   - updateSalaryFromAttendance(connection, instructor_id, academyId, work_date, status) 시그니처 무변경.
 *
 * 분리 결정 (ADR-006): 단일 파일 ~510줄 — 4 endpoint 강사 출결 도메인 응집도 강결합. 분리 불요.
 */

const { db, decrypt, updateSalaryFromAttendance, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/schedules/:id/instructor-attendance
 * Get instructor attendance for a specific schedule
 * Access: owner, admin, teacher
 */
router.get('/:id/instructor-attendance', verifyToken, async (req, res) => {
    const scheduleId = parseInt(req.params.id);

    try {
        // Get schedule details
        const [schedules] = await db.query(
            `SELECT
                cs.id,
                cs.class_date,
                cs.time_slot,
                cs.instructor_id,
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

        // Get instructor attendance records for this date
        const [attendances] = await db.query(
            `SELECT
                ia.id,
                ia.instructor_id,
                i.name AS instructor_name,
                ia.time_slot,
                ia.attendance_status,
                ia.check_in_time,
                ia.check_out_time,
                ia.notes
            FROM instructor_attendance ia
            JOIN instructors i ON ia.instructor_id = i.id
            WHERE ia.work_date = ?
            AND i.academy_id = ?
            ORDER BY ia.time_slot, i.name`,
            [schedule.class_date, req.user.academyId]
        );

        // 강사 출결 복호화
        const decryptedAttendances = attendances.map(a => ({
            ...a,
            instructor_name: a.instructor_name ? decrypt(a.instructor_name) : a.instructor_name
        }));

        res.json({
            message: 'Instructor attendance retrieved',
            schedule: {
                id: schedule.id,
                class_date: schedule.class_date,
                time_slot: schedule.time_slot,
                instructor_id: schedule.instructor_id,
                instructor_name: decrypt(schedule.instructor_name)
            },
            attendances: decryptedAttendances
        });
    } catch (error) {
        logger.error('Error fetching instructor attendance:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 출결 정보를 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/schedules/:id/instructor-attendance
 * Record instructor attendance for a schedule
 * Access: owner, admin
 */
router.post('/:id/instructor-attendance', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const scheduleId = parseInt(req.params.id);
    const connection = await db.getConnection();

    try {
        const { attendances } = req.body;

        // Validation
        if (!Array.isArray(attendances) || attendances.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'attendances 는 비어있지 않은 배열이어야 합니다.'
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

        await connection.beginTransaction();

        const validStatuses = ['present', 'absent', 'late', 'half_day'];
        const processedRecords = [];

        for (const record of attendances) {
            const { instructor_id, time_slot, attendance_status, check_in_time, check_out_time, notes } = record;

            // Validate attendance_status
            if (!validStatuses.includes(attendance_status)) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `유효하지 않은 출결 상태입니다: ${attendance_status}. (허용: ${validStatuses.join(', ')})`
                });
            }

            // Validate time_slot
            const useTimeSlot = time_slot || schedule.time_slot;
            if (!['morning', 'afternoon', 'evening'].includes(useTimeSlot)) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '유효하지 않은 time_slot 입니다.'
                });
            }

            // Verify instructor exists
            const [instructors] = await connection.query(
                'SELECT id, name FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    error: 'Not Found',
                    message: `강사를 찾을 수 없습니다 (ID: ${instructor_id})`
                });
            }

            // UPSERT instructor attendance record
            await connection.query(
                `INSERT INTO instructor_attendance
                (instructor_id, work_date, time_slot, attendance_status, check_in_time, check_out_time, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                attendance_status = VALUES(attendance_status),
                check_in_time = VALUES(check_in_time),
                check_out_time = VALUES(check_out_time),
                notes = VALUES(notes),
                updated_at = CURRENT_TIMESTAMP`,
                [instructor_id, schedule.class_date, useTimeSlot, attendance_status, check_in_time || null, check_out_time || null, notes || null]
            );

            processedRecords.push({
                instructor_id,
                instructor_name: decrypt(instructors[0].name),
                time_slot: useTimeSlot,
                attendance_status,
                check_in_time,
                check_out_time
            });

            // 급여 자동 계산/업데이트
            await updateSalaryFromAttendance(connection, instructor_id, req.user.academyId, schedule.class_date, attendance_status);
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `Instructor attendance recorded for ${processedRecords.length} records`,
            schedule_id: scheduleId,
            class_date: schedule.class_date,
            attendance_records: processedRecords
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error recording instructor attendance:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 출결 기록에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/schedules/date/:date/instructor-attendance
 * Get instructor attendance for a specific date
 * 배정된 강사만 해당 타임슬롯에 표시
 * Access: owner, admin, teacher
 */
router.get('/date/:date/instructor-attendance', verifyToken, async (req, res) => {
    const workDate = req.params.date;

    try {
        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(workDate)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '날짜는 YYYY-MM-DD 형식이어야 합니다.'
            });
        }

        // Get ALL active instructors for this academy (참고용)
        const [allActiveInstructors] = await db.query(
            `SELECT id, name, salary_type
            FROM instructors
            WHERE academy_id = ?
            AND status = 'active'
            AND deleted_at IS NULL
            ORDER BY name`,
            [req.user.academyId]
        );

        // 해당 날짜에 배정된 강사 조회 (instructor_schedules 테이블)
        const [scheduledInstructors] = await db.query(
            `SELECT
                isched.instructor_id,
                isched.time_slot,
                isched.scheduled_start_time,
                isched.scheduled_end_time,
                i.name,
                i.salary_type,
                'scheduled' as source
            FROM instructor_schedules isched
            JOIN instructors i ON isched.instructor_id = i.id
            WHERE isched.academy_id = ?
            AND isched.work_date = ?
            AND i.deleted_at IS NULL
            ORDER BY isched.time_slot, i.name`,
            [req.user.academyId, workDate]
        );

        // 승인된 미배정 출근 강사 조회 (overtime_approvals 테이블)
        const [approvedExtraDays] = await db.query(
            `SELECT
                oa.instructor_id,
                oa.time_slot,
                oa.original_end_time as scheduled_start_time,
                oa.actual_end_time as scheduled_end_time,
                i.name,
                i.salary_type,
                'approved' as source
            FROM overtime_approvals oa
            JOIN instructors i ON oa.instructor_id = i.id
            WHERE oa.academy_id = ?
            AND oa.work_date = ?
            AND oa.request_type = 'extra_day'
            AND oa.status = 'approved'
            AND i.deleted_at IS NULL
            ORDER BY oa.time_slot, i.name`,
            [req.user.academyId, workDate]
        );

        // 타임슬롯별로 강사 그룹화 (배정 + 승인된 강사)
        const instructorsBySlot = {
            morning: [],
            afternoon: [],
            evening: []
        };

        // 배정된 강사 추가 (복호화)
        scheduledInstructors.forEach(s => {
            instructorsBySlot[s.time_slot].push({
                id: s.instructor_id,
                name: s.name ? decrypt(s.name) : s.name,
                salary_type: s.salary_type,
                scheduled_start_time: s.scheduled_start_time,
                scheduled_end_time: s.scheduled_end_time,
                source: 'scheduled'
            });
        });

        // 승인된 미배정 출근 강사 추가 (중복 체크, 복호화)
        approvedExtraDays.forEach(s => {
            if (s.time_slot) {
                const existing = instructorsBySlot[s.time_slot].find(i => i.id === s.instructor_id);
                if (!existing) {
                    instructorsBySlot[s.time_slot].push({
                        id: s.instructor_id,
                        name: s.name ? decrypt(s.name) : s.name,
                        salary_type: s.salary_type,
                        scheduled_start_time: s.scheduled_start_time,
                        scheduled_end_time: s.scheduled_end_time,
                        source: 'approved'  // 승인된 미배정 출근
                    });
                }
            }
        });

        // Get existing attendance records for this date
        const [attendances] = await db.query(
            `SELECT
                ia.id,
                ia.instructor_id,
                i.name AS instructor_name,
                ia.time_slot,
                ia.attendance_status,
                ia.check_in_time,
                ia.check_out_time,
                ia.notes
            FROM instructor_attendance ia
            JOIN instructors i ON ia.instructor_id = i.id
            WHERE ia.work_date = ?
            AND i.academy_id = ?
            ORDER BY ia.time_slot, i.name`,
            [workDate, req.user.academyId]
        );

        // 출결 기록 복호화
        const decryptedAttendances = attendances.map(a => ({
            ...a,
            instructor_name: a.instructor_name ? decrypt(a.instructor_name) : a.instructor_name
        }));

        // 전체 강사 목록 복호화
        const decryptedInstructors = allActiveInstructors.map(i => ({
            ...i,
            name: i.name ? decrypt(i.name) : i.name
        }));

        res.json({
            message: 'Instructor attendance retrieved',
            date: workDate,
            attendances: decryptedAttendances,
            instructors: decryptedInstructors,  // 전체 강사 목록 (참고용)
            instructors_by_slot: instructorsBySlot  // 배정된 강사만 (이미 복호화됨)
        });
    } catch (error) {
        logger.error('Error fetching instructor attendance by date:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 출결 정보를 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/schedules/date/:date/instructor-attendance
 * Record instructor attendance for a specific date (without schedule)
 * Access: owner, admin, staff (with schedules edit permission)
 */
router.post('/date/:date/instructor-attendance', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const workDate = req.params.date;
    const connection = await db.getConnection();

    try {
        const { attendances } = req.body;

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(workDate)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '날짜는 YYYY-MM-DD 형식이어야 합니다.'
            });
        }

        if (!Array.isArray(attendances) || attendances.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'attendances 는 비어있지 않은 배열이어야 합니다.'
            });
        }

        await connection.beginTransaction();

        const validStatuses = ['present', 'absent', 'late', 'half_day', 'none'];
        const processedRecords = [];

        for (const record of attendances) {
            const { instructor_id, time_slot, attendance_status, check_in_time, check_out_time, notes } = record;

            if (!validStatuses.includes(attendance_status)) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `유효하지 않은 출결 상태입니다: ${attendance_status}`
                });
            }

            // attendance_status가 'none'이면 출근 상태만 NULL로 (강사는 목록에 유지)
            if (attendance_status === 'none') {
                logger.info(`[InstructorAttendance] Clearing attendance status for instructor ${instructor_id}`);
                await connection.query(
                    `UPDATE instructor_attendance SET attendance_status = NULL, check_in_time = NULL, check_out_time = NULL
                     WHERE instructor_id = ? AND work_date = ? AND time_slot = ?`,
                    [instructor_id, workDate, time_slot]
                );
                processedRecords.push({
                    instructor_id,
                    time_slot,
                    attendance_status: null,
                    cleared: true
                });
                continue;
            }

            if (!['morning', 'afternoon', 'evening'].includes(time_slot)) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '유효하지 않은 time_slot 입니다.'
                });
            }

            const [instructors] = await connection.query(
                'SELECT id, name FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                await connection.rollback();
                connection.release();
                return res.status(404).json({
                    error: 'Not Found',
                    message: `강사를 찾을 수 없습니다 (ID: ${instructor_id})`
                });
            }

            await connection.query(
                `INSERT INTO instructor_attendance
                (instructor_id, work_date, time_slot, attendance_status, check_in_time, check_out_time, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                attendance_status = VALUES(attendance_status),
                check_in_time = VALUES(check_in_time),
                check_out_time = VALUES(check_out_time),
                notes = VALUES(notes),
                updated_at = CURRENT_TIMESTAMP`,
                [instructor_id, workDate, time_slot, attendance_status, check_in_time || null, check_out_time || null, notes || null]
            );

            processedRecords.push({
                instructor_id,
                instructor_name: decrypt(instructors[0].name),
                time_slot,
                attendance_status
            });

            // 급여 자동 계산/업데이트
            await updateSalaryFromAttendance(connection, instructor_id, req.user.academyId, workDate, attendance_status);
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `Instructor attendance recorded for ${processedRecords.length} records`,
            date: workDate,
            attendance_records: processedRecords
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error recording instructor attendance:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 출결 기록에 실패했습니다.'
        });
    }
});

};
