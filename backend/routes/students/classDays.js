const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { parseClassDaysWithSlots, reassignStudentSchedules } = require('./_utils');

module.exports = function(router) {

// ===== 수업일 관리 전용 API =====

/**
 * GET /paca/students/class-days
 * 재원(active) 학생 전체 수업일 목록 반환
 * Access: owner, admin, staff
 */
router.get('/class-days', verifyToken, checkPermission('class_days', 'view'), async (req, res) => {
    try {
        const academyId = req.user.academyId;

        const [students] = await db.query(
            `SELECT id, name, grade, class_days, weekly_count, time_slot,
                    class_days_next, class_days_effective_from
             FROM students
             WHERE academy_id = ?
             AND deleted_at IS NULL
             AND status = 'active'
             ORDER BY grade ASC, name ASC`,
            [academyId]
        );

        // 이름 복호화
        const decryptedStudents = students.map(s => ({
            ...s,
            name: decrypt(s.name),
            class_days: parseClassDaysWithSlots(s.class_days, s.time_slot || 'evening'),
            class_days_next: s.class_days_next
                ? parseClassDaysWithSlots(s.class_days_next, s.time_slot || 'evening')
                : null,
        }));

        res.json({
            message: 'Success',
            students: decryptedStudents
        });
    } catch (error) {
        logger.error('Error fetching class-days:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '수업일 목록 조회에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/students/class-days/bulk
 * 여러 학생 수업일 일괄 변경
 * Access: owner, admin
 */
router.put('/class-days/bulk', verifyToken, checkPermission('class_days', 'edit'), async (req, res) => {
    const { effective_from, students: studentUpdates } = req.body;

    if (!Array.isArray(studentUpdates) || studentUpdates.length === 0) {
        return res.status(400).json({
            error: 'Validation Error',
            message: '변경할 학생 목록이 필요합니다.'
        });
    }

    try {
        const academyId = req.user.academyId;
        const now = new Date();
        const currentMonthFirst = new Date(now.getFullYear(), now.getMonth(), 1);
        const effectiveDate = effective_from ? new Date(effective_from + 'T00:00:00') : null;
        const isImmediate = !effectiveDate || effectiveDate <= currentMonthFirst;

        const results = [];

        for (const update of studentUpdates) {
            const { id, class_days } = update;
            if (!id || !Array.isArray(class_days)) continue;

            try {
                if (isImmediate) {
                    const [rows] = await db.query(
                        'SELECT class_days, time_slot FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                        [id, academyId]
                    );
                    if (rows.length === 0) continue;

                    const oldClassDays = rows[0].class_days
                        ? (typeof rows[0].class_days === 'string' ? JSON.parse(rows[0].class_days) : rows[0].class_days)
                        : [];
                    const timeSlot = rows[0].time_slot || 'evening';

                    const normalizedDays = parseClassDaysWithSlots(class_days, timeSlot);
                    await db.query(
                        `UPDATE students
                         SET class_days = ?, weekly_count = ?,
                             class_days_next = NULL, class_days_effective_from = NULL,
                             updated_at = NOW()
                         WHERE id = ? AND academy_id = ?`,
                        [JSON.stringify(normalizedDays), normalizedDays.length, id, academyId]
                    );

                    if (class_days.length > 0) {
                        try {
                            await reassignStudentSchedules(db, id, academyId, oldClassDays, class_days, timeSlot);
                        } catch (e) {
                            logger.error(`Reassign failed for student ${id}:`, e);
                        }
                    }

                    results.push({ id, mode: 'immediate', success: true });
                } else {
                    const normalizedNext = parseClassDaysWithSlots(class_days, timeSlot);
                    await db.query(
                        `UPDATE students
                         SET class_days_next = ?, class_days_effective_from = ?,
                             updated_at = NOW()
                         WHERE id = ? AND academy_id = ?`,
                        [JSON.stringify(normalizedNext), effective_from, id, academyId]
                    );

                    results.push({ id, mode: 'scheduled', success: true });
                }
            } catch (err) {
                logger.error(`Bulk class-days update failed for student ${id}:`, err);
                results.push({ id, success: false, error: err.message });
            }
        }

        const successCount = results.filter(r => r.success).length;
        res.json({
            message: `${successCount}명의 수업일이 ${isImmediate ? '즉시 변경' : '예약 변경'}되었습니다.`,
            mode: isImmediate ? 'immediate' : 'scheduled',
            results
        });
    } catch (error) {
        logger.error('Error in bulk class-days update:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '일괄 수업일 변경에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/students/:id/class-days
 * 개별 학생 수업일 변경 (즉시 또는 예약)
 * Access: owner, admin
 */
router.put('/:id/class-days', verifyToken, checkPermission('class_days', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { class_days, effective_from } = req.body;

    if (!class_days || !Array.isArray(class_days)) {
        return res.status(400).json({
            error: 'Validation Error',
            message: 'class_days는 배열이어야 합니다.'
        });
    }

    try {
        const [students] = await db.query(
            'SELECT id, class_days, time_slot, student_type FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const now = new Date();
        const currentMonthFirst = new Date(now.getFullYear(), now.getMonth(), 1);
        const effectiveDate = effective_from ? new Date(effective_from + 'T00:00:00') : null;
        const isImmediate = !effectiveDate || effectiveDate <= currentMonthFirst;

        if (isImmediate) {
            const oldClassDays = students[0].class_days
                ? (typeof students[0].class_days === 'string'
                    ? JSON.parse(students[0].class_days)
                    : students[0].class_days)
                : [];
            const timeSlot = students[0].time_slot || 'evening';

            // 학원비 자동 계산
            let newTuition = null;
            const weeklyCount = class_days.length;
            if (weeklyCount > 0) {
                const [settings] = await db.query(
                    'SELECT settings FROM academy_settings WHERE academy_id = ?',
                    [req.user.academyId]
                );
                if (settings.length > 0 && settings[0].settings) {
                    const parsed = typeof settings[0].settings === 'string'
                        ? JSON.parse(settings[0].settings)
                        : settings[0].settings;
                    const studentType = students[0].student_type || 'exam';
                    const tuitionTable = studentType === 'adult' ? parsed.adult_tuition : parsed.exam_tuition;
                    if (tuitionTable) {
                        newTuition = tuitionTable[`weekly_${weeklyCount}`] || null;
                    }
                }
            }

            const normalizedClassDays = parseClassDaysWithSlots(class_days, timeSlot);
            await db.query(
                `UPDATE students
                 SET class_days = ?, weekly_count = ?, ${newTuition !== null ? 'monthly_tuition = ?,' : ''}
                     class_days_next = NULL, class_days_effective_from = NULL,
                     updated_at = NOW()
                 WHERE id = ?`,
                newTuition !== null
                    ? [JSON.stringify(normalizedClassDays), weeklyCount, newTuition, studentId]
                    : [JSON.stringify(normalizedClassDays), weeklyCount, studentId]
            );

            let reassignResult = null;
            if (normalizedClassDays.length > 0) {
                try {
                    reassignResult = await reassignStudentSchedules(
                        db, studentId, req.user.academyId, oldClassDays, normalizedClassDays, timeSlot
                    );
                } catch (reassignError) {
                    logger.error('Reassign failed:', reassignError);
                }
            }

            res.json({
                message: '수업일이 즉시 변경되었습니다.',
                mode: 'immediate',
                class_days,
                reassignResult
            });
        } else {
            const normalizedNext = parseClassDaysWithSlots(class_days, timeSlot);
            await db.query(
                `UPDATE students
                 SET class_days_next = ?, class_days_effective_from = ?,
                     updated_at = NOW()
                 WHERE id = ?`,
                [JSON.stringify(normalizedNext), effective_from, studentId]
            );

            res.json({
                message: `${effective_from}부터 수업일이 변경 예정입니다.`,
                mode: 'scheduled',
                class_days_next: class_days,
                effective_from
            });
        }
    } catch (error) {
        logger.error('Error updating class-days:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '수업일 변경에 실패했습니다.'
        });
    }
});

/**
 * DELETE /paca/students/:id/class-days-schedule
 * 예약된 수업일 변경 취소
 * Access: owner, admin
 */
router.delete('/:id/class-days-schedule', verifyToken, checkPermission('class_days', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        await db.query(
            `UPDATE students
             SET class_days_next = NULL, class_days_effective_from = NULL,
                 updated_at = NOW()
             WHERE id = ? AND academy_id = ?`,
            [studentId, req.user.academyId]
        );

        res.json({ message: '예약된 수업일 변경이 취소되었습니다.' });
    } catch (error) {
        logger.error('Error canceling class-days schedule:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '예약 취소에 실패했습니다.'
        });
    }
});

};
