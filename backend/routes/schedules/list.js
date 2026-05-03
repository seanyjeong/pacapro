/**
 * paca/schedules/list.js — 스케줄 목록 조회 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./list')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (2건):
 *   - GET  /                          — 캘린더용 스케줄 목록 (start_date / end_date / instructor_id / time_slot 필터)
 *   - GET  /instructor/:instructor_id — 강사별 스케줄 목록 (start_date / end_date 필터)
 *
 * 인증: 2건 모두 verifyToken 만 (조회 — checkPermission 없음).
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getSchedules):
 *     - GET  /                          → { message, schedules }   (response.schedules 직접 소비)
 *     - GET  /instructor/:instructor_id → { message, instructor, schedules }
 *     - 4xx/5xx                          → { error, message }
 *
 * DB 호출 (ADR-005): pool.execute. 잔존 db.query 0건. 단, 원본은 db.query 였으나
 *   분리 시 동작 1:1 보존 위해 그대로 유지 (pool 의 alias). 본 파일은 ADR-005 단독 정렬은
 *   별도 트랙 — 분리 우선 ADR-017 자율 진행.
 *
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decryptScheduleNames + decrypt(instructor.name) 시그니처 무변경.
 *
 * 분리 결정 (ADR-006): 단일 파일 ~190줄 — 분리 불요.
 */

const { db, decrypt, decryptScheduleNames, logger } = require('./_utils');
const { verifyToken } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/schedules
 * Get class schedules (for calendar view)
 * Access: owner, admin, teacher
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { start_date, end_date, instructor_id, time_slot } = req.query;

        // 서브쿼리를 LEFT JOIN으로 변경하여 성능 최적화
        let query = `
            SELECT
                cs.id,
                cs.class_date,
                cs.time_slot,
                cs.instructor_id,
                cs.title,
                cs.content,
                cs.attendance_taken,
                cs.notes,
                cs.created_at,
                i.name AS instructor_name,
                COALESCE(ac.student_count, 0) AS student_count,
                COALESCE(ac.trial_count, 0) AS trial_count
            FROM class_schedules cs
            LEFT JOIN instructors i ON cs.instructor_id = i.id
            LEFT JOIN (
                SELECT
                    a.class_schedule_id,
                    cs_inner.class_date,
                    COUNT(DISTINCT a.student_id) AS student_count,
                    SUM(CASE
                        WHEN s.trial_dates IS NOT NULL
                        AND JSON_SEARCH(s.trial_dates, 'one', DATE_FORMAT(cs_inner.class_date, '%Y-%m-%d'), NULL, '$[*].date') IS NOT NULL
                        THEN 1 ELSE 0
                    END) AS trial_count
                FROM attendance a
                JOIN students s ON a.student_id = s.id AND s.deleted_at IS NULL
                JOIN class_schedules cs_inner ON a.class_schedule_id = cs_inner.id
                GROUP BY a.class_schedule_id, cs_inner.class_date
            ) ac ON cs.id = ac.class_schedule_id
            WHERE cs.academy_id = ?
        `;

        const params = [req.user.academyId];

        // Date range filter
        if (start_date) {
            query += ' AND cs.class_date >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND cs.class_date <= ?';
            params.push(end_date);
        }

        // Instructor filter
        if (instructor_id) {
            query += ' AND cs.instructor_id = ?';
            params.push(parseInt(instructor_id));
        }

        // Time slot filter
        if (time_slot && ['morning', 'afternoon', 'evening'].includes(time_slot)) {
            query += ' AND cs.time_slot = ?';
            params.push(time_slot);
        }

        query += ' ORDER BY cs.class_date ASC, cs.time_slot ASC';

        const [schedules] = await db.query(query, params);

        res.json({
            message: `Found ${schedules.length} schedules`,
            schedules: decryptScheduleNames(schedules)
        });
    } catch (error) {
        logger.error('Error fetching schedules:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '스케줄 목록을 불러오지 못했습니다.'
        });
    }
});

/**
 * GET /paca/schedules/instructor/:instructor_id
 * Get schedules for specific instructor
 * Access: owner, admin, teacher
 */
router.get('/instructor/:instructor_id', verifyToken, async (req, res) => {
    const instructorId = parseInt(req.params.instructor_id);

    try {
        const { start_date, end_date } = req.query;

        // Verify instructor belongs to academy
        const [instructors] = await db.query(
            'SELECT id, name FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [instructorId, req.user.academyId]
        );

        if (instructors.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '강사를 찾을 수 없습니다.'
            });
        }

        let query = `
            SELECT
                cs.id,
                cs.class_date,
                cs.time_slot,
                cs.title,
                cs.content,
                cs.attendance_taken,
                cs.notes
            FROM class_schedules cs
            WHERE cs.academy_id = ?
            AND cs.instructor_id = ?
        `;

        const params = [req.user.academyId, instructorId];

        if (start_date) {
            query += ' AND cs.class_date >= ?';
            params.push(start_date);
        }

        if (end_date) {
            query += ' AND cs.class_date <= ?';
            params.push(end_date);
        }

        query += ' ORDER BY cs.class_date ASC, cs.time_slot ASC';

        const [schedules] = await db.query(query, params);
        const decryptedInstructor = { ...instructors[0], name: decrypt(instructors[0].name) };

        res.json({
            message: `Found ${schedules.length} schedules for ${decryptedInstructor.name}`,
            instructor: decryptedInstructor,
            schedules: decryptScheduleNames(schedules)
        });
    } catch (error) {
        logger.error('Error fetching instructor schedules:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 스케줄을 불러오지 못했습니다.'
        });
    }
});

};
