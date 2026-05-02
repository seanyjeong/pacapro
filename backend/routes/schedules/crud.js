/**
 * paca/schedules/crud.js — 스케줄 단건 CRUD 라우터 (Phase 3 #7)
 *
 * 마운트: paca.js → routes/schedules/index.js → require('./crud')(router)
 *         mount path: '/paca/schedules'
 *
 * Endpoint (5건):
 *   - GET    /:id                    — 스케줄 상세 조회
 *   - POST   /                       — 신규 스케줄 생성 (instructor_id 선택)
 *   - PUT    /:id/assign-instructor  — 강사 배정 + 선택적으로 instructor_attendance UPSERT
 *   - PUT    /:id                    — 스케줄 수정 (dynamic update — class_date/time_slot/instructor_id/title/content/notes)
 *   - DELETE /:id                    — 스케줄 삭제 (CASCADE attendance)
 *
 * 인증: GET = verifyToken / 나머지 4건 = verifyToken + checkPermission('schedules', 'edit').
 *
 * 등록 순서 핵심 (express 매칭):
 *   /:id/assign-instructor (정적 suffix) 는 PUT /:id (와일드카드) 보다 먼저 등록.
 *   본 sub-라우터 안에서 처리 — PUT /:id/assign-instructor → PUT /:id 순서 보존 (원본 schedules.js
 *   라인 707 vs 795 동일).
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/schedules.ts (getSchedule/createSchedule/updateSchedule/deleteSchedule):
 *     - GET    /:id                    → { message, schedule }
 *     - POST   / (201)                 → { message, schedule }
 *     - PUT    /:id/assign-instructor → { message, schedule }
 *     - PUT    /:id                    → { message, schedule }
 *     - DELETE /:id                    → { message }
 *     - 4xx/5xx                         → { error, message }
 *
 * DB 호출 (ADR-005): 원본 db.query 그대로 보존 (분리 단계 — pool alias).
 *
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): decrypt 시그니처 무변경 (instructor_name / instructor_phone 복호화).
 *
 * 분리 결정 (ADR-006): 단일 파일 ~390줄 — 분리 불요.
 */

const { db, decrypt, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/schedules/:id
 * Get schedule details
 * Access: owner, admin, teacher
 */
router.get('/:id', verifyToken, async (req, res) => {
    const scheduleId = parseInt(req.params.id);

    try {
        const [schedules] = await db.query(
            `SELECT
                cs.*,
                i.name AS instructor_name,
                i.phone AS instructor_phone
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
        res.json({
            message: 'Schedule found',
            schedule: {
                ...schedule,
                instructor_name: schedule.instructor_name ? decrypt(schedule.instructor_name) : schedule.instructor_name,
                instructor_phone: schedule.instructor_phone ? decrypt(schedule.instructor_phone) : schedule.instructor_phone
            }
        });
    } catch (error) {
        logger.error('Error fetching schedule:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '수업 정보를 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/schedules
 * Create new class schedule
 * instructor_id는 선택사항 (나중에 배정 가능)
 * Access: owner, admin only
 */
router.post('/', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    try {
        const { class_date, time_slot, instructor_id, title, content, notes } = req.body;

        // Validation - instructor_id는 선택사항
        if (!class_date || !time_slot) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'class_date 와 time_slot 은 필수입니다.'
            });
        }

        // Validate time_slot
        if (!['morning', 'afternoon', 'evening'].includes(time_slot)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'time_slot 은 morning, afternoon, evening 중 하나여야 합니다.'
            });
        }

        // Validate date format (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(class_date)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'class_date 는 YYYY-MM-DD 형식이어야 합니다.'
            });
        }

        // Verify instructor exists if provided
        if (instructor_id) {
            const [instructors] = await db.query(
                'SELECT id FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사를 찾을 수 없거나 학원 소속이 아닙니다.'
                });
            }
        }

        // Check for duplicate schedule (same date, time_slot)
        const [existing] = await db.query(
            `SELECT id FROM class_schedules
            WHERE academy_id = ?
            AND class_date = ?
            AND time_slot = ?`,
            [req.user.academyId, class_date, time_slot]
        );

        if (existing.length > 0) {
            return res.status(409).json({
                error: 'Conflict',
                message: '해당 날짜와 시간대에 이미 수업이 있습니다.'
            });
        }

        // Create schedule (instructor_id can be null)
        const [result] = await db.query(
            `INSERT INTO class_schedules
            (academy_id, class_date, time_slot, instructor_id, title, content, notes)
            VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [req.user.academyId, class_date, time_slot, instructor_id || null, title || null, content || null, notes || null]
        );

        // Fetch created schedule
        const [newSchedule] = await db.query(
            `SELECT cs.*, i.name AS instructor_name
            FROM class_schedules cs
            LEFT JOIN instructors i ON cs.instructor_id = i.id
            WHERE cs.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: 'Schedule created successfully',
            schedule: newSchedule[0]
        });
    } catch (error) {
        logger.error('Error creating schedule:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '수업 생성에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/schedules/:id/assign-instructor
 * Assign instructor to a schedule (강사 배정)
 * Access: owner, admin only
 *
 * 등록 순서: PUT /:id 보다 먼저 등록 (정적 suffix /assign-instructor 우선).
 */
router.put('/:id/assign-instructor', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const scheduleId = parseInt(req.params.id);

    try {
        const { instructor_id, time_slots } = req.body;

        // Check if schedule exists
        const [schedules] = await db.query(
            'SELECT id, class_date, time_slot FROM class_schedules WHERE id = ? AND academy_id = ?',
            [scheduleId, req.user.academyId]
        );

        if (schedules.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '수업을 찾을 수 없습니다.'
            });
        }

        // Validate instructor if provided
        if (instructor_id) {
            const [instructors] = await db.query(
                'SELECT id, name FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사를 찾을 수 없습니다.'
                });
            }
        }

        // Update schedule with instructor
        await db.query(
            'UPDATE class_schedules SET instructor_id = ? WHERE id = ?',
            [instructor_id || null, scheduleId]
        );

        // If time_slots array provided, create/update instructor attendance records
        if (Array.isArray(time_slots) && time_slots.length > 0 && instructor_id) {
            const schedule = schedules[0];

            for (const slot of time_slots) {
                if (!['morning', 'afternoon', 'evening'].includes(slot)) continue;

                // UPSERT instructor attendance
                await db.query(
                    `INSERT INTO instructor_attendance
                    (instructor_id, class_schedule_id, work_date, time_slot, attendance_status)
                    VALUES (?, ?, ?, ?, 'present')
                    ON DUPLICATE KEY UPDATE
                    class_schedule_id = VALUES(class_schedule_id),
                    attendance_status = 'present',
                    updated_at = CURRENT_TIMESTAMP`,
                    [instructor_id, scheduleId, schedule.class_date, slot]
                );
            }
        }

        // Fetch updated schedule
        const [updated] = await db.query(
            `SELECT cs.*, i.name AS instructor_name
            FROM class_schedules cs
            LEFT JOIN instructors i ON cs.instructor_id = i.id
            WHERE cs.id = ?`,
            [scheduleId]
        );

        res.json({
            message: 'Instructor assigned successfully',
            schedule: updated[0]
        });
    } catch (error) {
        logger.error('Error assigning instructor:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '강사 배정에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/schedules/:id
 * Update class schedule
 * Access: owner, admin only
 */
router.put('/:id', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const scheduleId = parseInt(req.params.id);

    try {
        const { class_date, time_slot, instructor_id, title, content, notes } = req.body;

        // Check if schedule exists
        const [schedules] = await db.query(
            'SELECT id FROM class_schedules WHERE id = ? AND academy_id = ?',
            [scheduleId, req.user.academyId]
        );

        if (schedules.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '수업을 찾을 수 없습니다.'
            });
        }

        // Validate time_slot if provided
        if (time_slot && !['morning', 'afternoon', 'evening'].includes(time_slot)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'time_slot 은 morning, afternoon, evening 중 하나여야 합니다.'
            });
        }

        // Verify instructor if provided
        if (instructor_id) {
            const [instructors] = await db.query(
                'SELECT id FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사를 찾을 수 없습니다.'
                });
            }
        }

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (class_date !== undefined) {
            updates.push('class_date = ?');
            params.push(class_date);
        }
        if (time_slot !== undefined) {
            updates.push('time_slot = ?');
            params.push(time_slot);
        }
        if (instructor_id !== undefined) {
            updates.push('instructor_id = ?');
            params.push(instructor_id);
        }
        if (title !== undefined) {
            updates.push('title = ?');
            params.push(title);
        }
        if (content !== undefined) {
            updates.push('content = ?');
            params.push(content);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '수정할 필드가 없습니다.'
            });
        }

        params.push(scheduleId);

        await db.query(
            `UPDATE class_schedules SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Fetch updated schedule
        const [updated] = await db.query(
            `SELECT cs.*, i.name AS instructor_name
            FROM class_schedules cs
            LEFT JOIN instructors i ON cs.instructor_id = i.id
            WHERE cs.id = ?`,
            [scheduleId]
        );

        res.json({
            message: 'Schedule updated successfully',
            schedule: updated[0]
        });
    } catch (error) {
        logger.error('Error updating schedule:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '수업 수정에 실패했습니다.'
        });
    }
});

/**
 * DELETE /paca/schedules/:id
 * Delete class schedule
 * Access: owner, admin only
 */
router.delete('/:id', verifyToken, checkPermission('schedules', 'edit'), async (req, res) => {
    const scheduleId = parseInt(req.params.id);

    try {
        // Check if schedule exists
        const [schedules] = await db.query(
            'SELECT id FROM class_schedules WHERE id = ? AND academy_id = ?',
            [scheduleId, req.user.academyId]
        );

        if (schedules.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '수업을 찾을 수 없습니다.'
            });
        }

        // Delete schedule (CASCADE will delete attendance records)
        await db.query('DELETE FROM class_schedules WHERE id = ?', [scheduleId]);

        res.json({
            message: 'Schedule deleted successfully'
        });
    } catch (error) {
        logger.error('Error deleting schedule:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '수업 삭제에 실패했습니다.'
        });
    }
});

};
