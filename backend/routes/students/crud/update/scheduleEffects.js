const {
    parseClassDaysWithSlots,
    extractDayNumbers,
    reassignStudentSchedules,
    logger,
} = require('../_utils');

async function reassignClassSchedules(context) {
    const {
        pool,
        studentId,
        academyId,
        classDays,
        timeSlot,
        oldClassDaysRaw,
        oldDayNumbers,
        oldTimeSlot,
        currentTimeSlot,
        isScheduledClassDays,
        updatedStudent,
    } = context;

    let reassignResult = null;
    if (classDays !== undefined && !isScheduledClassDays) {
        const newClassDays = classDays || [];
        const newSlots = parseClassDaysWithSlots(newClassDays, currentTimeSlot);
        const newDayNumbers = extractDayNumbers(newSlots);
        const oldSlots = parseClassDaysWithSlots(oldClassDaysRaw, oldTimeSlot);
        const oldSet = new Set(oldDayNumbers);
        const newSet = new Set(newDayNumbers);
        const daysChanged = oldDayNumbers.length !== newDayNumbers.length
            || oldDayNumbers.some((day) => !newSet.has(day))
            || newDayNumbers.some((day) => !oldSet.has(day));
        const timeSlotsChanged = !daysChanged && newSlots.some((newSlot) => {
            const oldSlot = oldSlots.find((slot) => slot.day === newSlot.day);
            return oldSlot && oldSlot.timeSlot !== newSlot.timeSlot;
        });

        if ((daysChanged || timeSlotsChanged) && newSlots.length > 0) {
            try {
                reassignResult = await reassignStudentSchedules(
                    pool,
                    studentId,
                    academyId,
                    oldClassDaysRaw,
                    newClassDays,
                    currentTimeSlot
                );
            } catch (error) {
                logger.error('Reassign failed:', error);
            }
        }
    }

    if (timeSlot !== undefined && timeSlot !== oldTimeSlot && classDays === undefined) {
        const currentClassDaysRaw = updatedStudent.class_days
            ? (typeof updatedStudent.class_days === 'string'
                ? JSON.parse(updatedStudent.class_days)
                : updatedStudent.class_days)
            : [];
        const hasPerDayTimeSlots = Array.isArray(currentClassDaysRaw)
            && currentClassDaysRaw.length > 0
            && typeof currentClassDaysRaw[0] === 'object'
            && currentClassDaysRaw[0].day !== undefined;

        if (currentClassDaysRaw.length > 0 && !hasPerDayTimeSlots) {
            try {
                await reassignStudentSchedules(
                    pool,
                    studentId,
                    academyId,
                    currentClassDaysRaw,
                    currentClassDaysRaw,
                    timeSlot
                );
            } catch (error) {
                logger.error('Time slot reassign failed:', error);
            }
        }
    }

    return reassignResult;
}

async function reassignTrialSchedules(context) {
    const { pool, studentId, academyId, isTrial, trialDates } = context;
    if (!isTrial || trialDates === undefined || trialDates.length === 0) return null;

    try {
        await pool.execute(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND a.attendance_status IS NULL`,
            [studentId, academyId]
        );

        let assigned = 0;
        for (const trialDate of trialDates) {
            const { date, time_slot: trialTimeSlot, attended } = trialDate;
            if (!date || !trialTimeSlot || attended) continue;

            const [schedules] = await pool.execute(
                `SELECT id FROM class_schedules
                 WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                [academyId, date, trialTimeSlot]
            );
            let scheduleId = schedules[0]?.id;
            if (!scheduleId) {
                const [createResult] = await pool.execute(
                    `INSERT INTO class_schedules (academy_id, class_date, time_slot)
                     VALUES (?, ?, ?)`,
                    [academyId, date, trialTimeSlot]
                );
                scheduleId = createResult.insertId;
            }

            await pool.execute(
                `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                 VALUES (?, ?, NULL)
                 ON DUPLICATE KEY UPDATE attendance_status = attendance_status`,
                [scheduleId, studentId]
            );
            assigned++;
        }
        logger.info(`[Trial] Student ${studentId}: reassigned ${assigned} unattended schedules`);
        return { assigned };
    } catch (error) {
        logger.error('Trial schedule reassign failed:', error);
        return null;
    }
}

async function cleanupStatusSchedules(context) {
    const { pool, studentId, academyId, status, oldStatus } = context;
    const result = { pauseInfo: null, trialCancelInfo: null, pendingInfo: null };
    const today = new Date().toISOString().split('T')[0];

    if (status === 'paused' && oldStatus !== 'paused') {
        try {
            const [deleteResult] = await pool.execute(
                `DELETE a FROM attendance a
                 JOIN class_schedules cs ON a.class_schedule_id = cs.id
                 WHERE a.student_id = ?
                   AND cs.academy_id = ?
                   AND (
                     cs.class_date = ?
                     OR (cs.class_date > ? AND a.attendance_status IS NULL)
                   )`,
                [studentId, academyId, today, today]
            );
            if (deleteResult.affectedRows > 0) {
                result.pauseInfo = {
                    deletedSchedules: deleteResult.affectedRows,
                    message: `미래 스케줄 ${deleteResult.affectedRows}건 삭제됨`,
                };
            }
        } catch (error) {
            logger.error('Pause schedule cleanup failed:', error);
        }
    }

    if (oldStatus === 'trial' && status === 'pending') {
        try {
            const [deleteResult] = await pool.execute(
                `DELETE a FROM attendance a
                 JOIN class_schedules cs ON a.class_schedule_id = cs.id
                 WHERE a.student_id = ?
                 AND cs.academy_id = ?
                 AND cs.class_date >= ?
                 AND a.attendance_status IS NULL`,
                [studentId, academyId, today]
            );
            if (deleteResult.affectedRows > 0) {
                result.trialCancelInfo = {
                    deletedSchedules: deleteResult.affectedRows,
                    message: `체험 스케줄 ${deleteResult.affectedRows}건 삭제됨`,
                };
                logger.info(`[Trial Cancel] Student ${studentId}: deleted ${deleteResult.affectedRows} future schedules`);
            }
        } catch (error) {
            logger.error('Trial cancel schedule cleanup failed:', error);
        }
    }

    if (status === 'pending' && oldStatus !== 'pending' && oldStatus !== 'trial') {
        try {
            const [deleteResult] = await pool.execute(
                `DELETE a FROM attendance a
                 JOIN class_schedules cs ON a.class_schedule_id = cs.id
                 WHERE a.student_id = ?
                 AND cs.academy_id = ?
                 AND cs.class_date >= ?
                 AND a.attendance_status IS NULL`,
                [studentId, academyId, today]
            );
            if (deleteResult.affectedRows > 0) {
                result.pendingInfo = {
                    deletedSchedules: deleteResult.affectedRows,
                    message: `미등록 전환으로 미래 스케줄 ${deleteResult.affectedRows}건 삭제됨`,
                };
                logger.info(`[Pending] Student ${studentId}: deleted ${deleteResult.affectedRows} future schedules`);
            }
        } catch (error) {
            logger.error('Pending schedule cleanup failed:', error);
        }
    }

    return result;
}

module.exports = {
    reassignClassSchedules,
    reassignTrialSchedules,
    cleanupStatusSchedules,
};
