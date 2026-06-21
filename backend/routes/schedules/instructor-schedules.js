/**
 * paca/schedules/instructor-schedules.js — 강사 근무 일정 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./instructor-schedules')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (3건):
 *   - GET  /date/:date/instructor-schedules — 특정 날짜 강사 근무 일정 + 전체 강사 + 슬롯별 그룹화
 *   - POST /date/:date/instructor-schedules — 특정 날짜 강사 근무 일정 저장 (전체 교체 트랜잭션)
 *   - GET  /instructor-schedules/month      — 월별 강사 일정 통계 (캘린더용, 배정/출근 인원)
 *
 * 인증:
 *   - GET /date/:date/instructor-schedules  = verifyToken + checkPermission('schedules', 'view')
 *   - POST /date/:date/instructor-schedules = verifyToken + checkPermission('schedules', 'edit')
 *   - GET /instructor-schedules/month       = verifyToken + checkPermission('schedules', 'view')
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getMonthlyInstructorStats):
 *     - GET  /date/:date/instructor-schedules → { message, date, instructors, schedules }
 *         instructors: 전체 활성 강사 (복호화)
 *         schedules: { morning: [...], afternoon: [...], evening: [...] }
 *           각 항목: { id, instructor_id, instructor_name (복호화), salary_type,
 *                     scheduled_start_time, scheduled_end_time }
 *     - POST /date/:date/instructor-schedules → { message, date, schedules: insertedSchedules[] }
 *     - GET  /instructor-schedules/month      → { message, year_month, schedules }
 *         schedules: Record<dateStr, { morning: { scheduled, attended }, afternoon: {...}, evening: {...} }>
 *     - 4xx/5xx                                → { error, message }
 *
 * DB 호출 (ADR-005): 원본 db.query / connection.query 그대로 보존 (분리 단계 — pool/conn alias).
 *
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 시그니처 무변경 (강사 이름 복호화).
 *
 * 분리 결정 (ADR-006): 단일 파일 ~290줄 — 분리 불요.
 */

const { db, decrypt, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/schedules/date/:date/instructor-schedules
 * 특정 날짜의 강사 근무 일정 조회
 * Access: owner, admin, staff (with schedules view permission)
 */
router.get('/date/:date/instructor-schedules', verifyToken, checkPermission('schedules', 'view'), async (req, res) => {
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

        // 모든 활성 강사 조회
        const [instructors] = await db.query(
            `SELECT id, name, salary_type, hourly_rate
             FROM instructors
             WHERE academy_id = ? AND status = 'active' AND deleted_at IS NULL
             ORDER BY name`,
            [req.user.academyId]
        );

        // 해당 날짜의 배정된 일정 조회
        const [schedules] = await db.query(
            `SELECT
                isched.id,
                isched.instructor_id,
                isched.time_slot,
                isched.scheduled_start_time,
                isched.scheduled_end_time,
                i.name as instructor_name,
                i.salary_type
             FROM instructor_schedules isched
             JOIN instructors i ON isched.instructor_id = i.id
             WHERE isched.academy_id = ?
             AND isched.work_date = ?
             ORDER BY isched.time_slot, i.name`,
            [req.user.academyId, workDate]
        );

        // 타임슬롯별로 그룹화
        const schedulesBySlot = {
            morning: [],
            afternoon: [],
            evening: []
        };

        schedules.forEach(s => {
            schedulesBySlot[s.time_slot].push({
                id: s.id,
                instructor_id: s.instructor_id,
                instructor_name: decrypt(s.instructor_name),
                salary_type: s.salary_type,
                scheduled_start_time: s.scheduled_start_time,
                scheduled_end_time: s.scheduled_end_time
            });
        });

        // Decrypt instructor names
        const decryptedInstructors = instructors.map(i => ({ ...i, name: decrypt(i.name) }));

        res.json({
            message: 'Instructor schedules retrieved',
            date: workDate,
            instructors: decryptedInstructors,
            schedules: schedulesBySlot
        });
    } catch (error) {
        logger.error('Error fetching instructor schedules:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 근무 일정을 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/schedules/date/:date/instructor-schedules
 * 특정 날짜의 강사 근무 일정 저장 (전체 교체 방식)
 * Body: { schedules: [{ instructor_id, time_slot, scheduled_start_time?, scheduled_end_time? }] }
 * Access: owner, admin, staff (with schedules edit permission)
 */
router.post('/date/:date/instructor-schedules', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const workDate = req.params.date;
    const connection = await db.getConnection();

    try {
        const { schedules } = req.body;

        // Validate date format
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(workDate)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '날짜는 YYYY-MM-DD 형식이어야 합니다.'
            });
        }

        if (!Array.isArray(schedules)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'schedules 는 배열이어야 합니다.'
            });
        }

        await connection.beginTransaction();

        // 해당 날짜의 기존 일정 삭제
        await connection.query(
            'DELETE FROM instructor_schedules WHERE academy_id = ? AND work_date = ?',
            [req.user.academyId, workDate]
        );

        // 새 일정 추가
        const validSlots = ['morning', 'afternoon', 'evening'];
        const insertedSchedules = [];

        for (const schedule of schedules) {
            const { instructor_id, time_slot, scheduled_start_time, scheduled_end_time } = schedule;

            if (!instructor_id || !time_slot) continue;

            if (!validSlots.includes(time_slot)) {
                await connection.rollback();
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `유효하지 않은 time_slot 입니다: ${time_slot}`
                });
            }

            // 강사 확인
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
                `INSERT INTO instructor_schedules
                (academy_id, instructor_id, work_date, time_slot, scheduled_start_time, scheduled_end_time, created_by)
                VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.academyId,
                    instructor_id,
                    workDate,
                    time_slot,
                    scheduled_start_time || null,
                    scheduled_end_time || null,
                    req.user.id
                ]
            );

            insertedSchedules.push({
                instructor_id,
                instructor_name: decrypt(instructors[0].name),
                time_slot,
                scheduled_start_time,
                scheduled_end_time
            });
        }

        await connection.commit();
        connection.release();

        res.json({
            message: `Instructor schedules saved for ${workDate}`,
            date: workDate,
            schedules: insertedSchedules
        });
    } catch (error) {
        await connection.rollback();
        connection.release();
        logger.error('Error saving instructor schedules:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 근무 일정 저장에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/schedules/instructor-schedules/month
 * 특정 월의 모든 강사 일정 조회 (캘린더용)
 * Query: year, month
 * Returns: 날짜별 슬롯별 배정 인원 + 출근 인원 (1/5 형식으로 표시 가능)
 * Access: owner, admin, staff (with schedules view permission)
 */
router.get('/instructor-schedules/month', verifyToken, checkPermission('schedules', 'view'), async (req, res) => {
    const { year, month } = req.query;

    try {
        if (!year || !month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'year 와 month 는 필수입니다.'
            });
        }

        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

        // 배정된 강사 수 조회 (instructor_schedules)
        const [scheduledCounts] = await db.query(
            `SELECT
                isched.work_date,
                isched.time_slot,
                COUNT(DISTINCT isched.instructor_id) as scheduled_count
             FROM instructor_schedules isched
             WHERE isched.academy_id = ?
             AND DATE_FORMAT(isched.work_date, '%Y-%m') = ?
             GROUP BY isched.work_date, isched.time_slot
             ORDER BY isched.work_date, isched.time_slot`,
            [req.user.academyId, yearMonth]
        );

        // 출근한 강사 수 조회 (attendance_status가 present, late, half_day인 경우)
        const [attendedCounts] = await db.query(
            `SELECT
                ia.work_date,
                ia.time_slot,
                COUNT(DISTINCT ia.instructor_id) as attended_count
             FROM instructor_attendance ia
             JOIN instructors i ON ia.instructor_id = i.id
             WHERE i.academy_id = ?
             AND DATE_FORMAT(ia.work_date, '%Y-%m') = ?
             AND ia.attendance_status IN ('present', 'late', 'half_day')
             GROUP BY ia.work_date, ia.time_slot
             ORDER BY ia.work_date, ia.time_slot`,
            [req.user.academyId, yearMonth]
        );

        // 날짜별 → 슬롯별 데이터 매핑
        const scheduleMap = {};

        // 배정 인원 매핑
        scheduledCounts.forEach(s => {
            // dateStrings: true 설정으로 이미 문자열일 수 있음
            const dateStr = typeof s.work_date === 'string'
                ? s.work_date.split('T')[0]
                : s.work_date.toISOString().split('T')[0];
            if (!scheduleMap[dateStr]) {
                scheduleMap[dateStr] = {
                    morning: { scheduled: 0, attended: 0 },
                    afternoon: { scheduled: 0, attended: 0 },
                    evening: { scheduled: 0, attended: 0 }
                };
            }
            scheduleMap[dateStr][s.time_slot].scheduled = s.scheduled_count;
        });

        // 출근 인원 매핑
        attendedCounts.forEach(a => {
            const dateStr = typeof a.work_date === 'string'
                ? a.work_date.split('T')[0]
                : a.work_date.toISOString().split('T')[0];
            if (!scheduleMap[dateStr]) {
                scheduleMap[dateStr] = {
                    morning: { scheduled: 0, attended: 0 },
                    afternoon: { scheduled: 0, attended: 0 },
                    evening: { scheduled: 0, attended: 0 }
                };
            }
            scheduleMap[dateStr][a.time_slot].attended = a.attended_count;
        });

        res.json({
            message: 'Monthly instructor schedules retrieved',
            year_month: yearMonth,
            schedules: scheduleMap
        });
    } catch (error) {
        logger.error('Error fetching monthly instructor schedules:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '월별 강사 일정을 불러오지 못했습니다.'
        });
    }
});

};
