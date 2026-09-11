/**
 * POST /paca/schedules/:id/attendance
 * 출석 저장과 체험 상태 즉시 재계산을 한 트랜잭션에서 처리한다.
 */

const { db, decrypt, logger } = require('./_utils');
const { verifyToken } = require('../../middleware/auth');
const {
    applyTrialAttendanceChange,
    getAttendanceContext,
} = require('../../services/trialStatusService');

module.exports = function registerAttendanceSubmit(router) {
    router.post('/:id/attendance', verifyToken, async (req, res) => {
        const scheduleId = parseInt(req.params.id);
        const connection = await db.getConnection();

        try {
            const { attendance_records: attendanceRecords } = req.body;
            const individual = req.body.mode === 'individual';
            if (req.body.mode !== undefined && !individual) {
                connection.release();
                return res.status(400).json({ error: 'Validation Error', message: '출석 저장 방식을 확인해주세요.' });
            }
            logger.info(`[Attendance] Schedule ${scheduleId}, received:`, JSON.stringify(attendanceRecords));

            if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
                connection.release();
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'attendance_records 는 비어있지 않은 배열이어야 합니다.',
                });
            }

            const [schedules] = await connection.query(
                'SELECT id, class_date, time_slot FROM class_schedules WHERE id = ? AND academy_id = ?',
                [scheduleId, req.user.academyId]
            );
            if (schedules.length === 0) {
                connection.release();
                return res.status(404).json({
                    error: 'Not Found',
                    message: '수업을 찾을 수 없습니다.',
                });
            }

            const schedule = schedules[0];
            await connection.beginTransaction();
            const processedRecords = [];
            const notifyTargets = [];

            for (const record of attendanceRecords) {
                const result = await processAttendanceRecord({
                    connection,
                    record,
                    req,
                    res,
                    schedule,
                    scheduleId,
                });
                if (result.responseSent) return undefined;
                if (result.processedRecord) processedRecords.push(result.processedRecord);
                if (result.notifyTarget) notifyTargets.push(result.notifyTarget);
            }

            // 개별 정정은 전체 출석 제출과 달리 반 전체를 마감하거나 알림을 보내지 않는다.
            if (!individual) {
                await connection.query(
                    'UPDATE class_schedules SET attendance_taken = true WHERE id = ?',
                    [scheduleId]
                );
            }
            await connection.commit();
            connection.release();

            res.json({
                message: `Attendance recorded for ${processedRecords.length} students`,
                schedule_id: scheduleId,
                class_date: schedule.class_date,
                attendance_records: processedRecords,
            });
            if (!individual) queueAttendanceNotifications({
                academyId: req.user.academyId,
                notifyTargets,
                schedule,
                scheduleId,
            });
        } catch (error) {
            await connection.rollback();
            connection.release();
            logger.error('Error recording attendance:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '출석 기록에 실패했습니다.',
            });
        }
    });
};

async function processAttendanceRecord({ connection, record, req, res, schedule, scheduleId }) {
    const { student_id: studentId, attendance_status: status, makeup_date: makeupDate, notes } = record;
    if (!status) return {};

    const validationMessage = validateAttendanceStatus(status, makeupDate);
    if (validationMessage) {
        await connection.rollback();
        connection.release();
        res.status(400).json({ error: 'Validation Error', message: validationMessage });
        return { responseSent: true };
    }

    const context = await getAttendanceContext({
        academyId: req.user.academyId,
        connection,
        scheduleId,
        studentId,
    });
    if (!context) {
        await connection.rollback();
        connection.release();
        res.status(404).json({ error: 'Not Found', message: '학생을 찾을 수 없습니다.' });
        return { responseSent: true };
    }

    if (status === 'none') {
        await clearAttendance({ connection, scheduleId, studentId });
        await applyTrialAttendanceChange({
            attendanceStatus: status,
            connection,
            context,
            schedule,
        });
        await cancelQueuedNotification({
            academyId: req.user.academyId,
            connection,
            scheduleId,
            studentId,
        });
        return {
            processedRecord: { student_id: studentId, attendance_status: null, cleared: true },
        };
    }

    await upsertAttendance({
        connection,
        makeupDate,
        notes,
        recordedBy: req.user.id,
        scheduleId,
        status,
        studentId,
    });
    const trialState = await applyTrialAttendanceChange({
        attendanceStatus: status,
        connection,
        context,
        schedule,
    });
    return {
        notifyTarget: {
            student_id: studentId,
            attendance_status: status,
            notes: notes || null,
            prevStatus: context.previousAttendanceStatus,
        },
        processedRecord: {
            student_id: studentId,
            student_name: decrypt(context.student.name),
            attendance_status: status,
            makeup_date: status === 'makeup' ? makeupDate : null,
            notes: notes || '',
            is_trial: trialState.isTrial,
            trial_remaining: trialState.trialRemaining,
        },
    };
}

function validateAttendanceStatus(status, makeupDate) {
    const validStatuses = ['present', 'absent', 'late', 'excused', 'makeup', 'none'];
    if (!validStatuses.includes(status)) {
        return '출석 상태를 다시 선택해주세요.';
    }
    if (status === 'makeup' && !/^\d{4}-\d{2}-\d{2}$/.test(makeupDate || '')) {
        return '보충 날짜를 선택해주세요.';
    }
    return null;
}

async function clearAttendance({ connection, scheduleId, studentId }) {
    await connection.query(
        'UPDATE attendance SET attendance_status = NULL, notes = NULL, makeup_date = NULL WHERE class_schedule_id = ? AND student_id = ?',
        [scheduleId, studentId]
    );
}

async function upsertAttendance({
    connection,
    makeupDate,
    notes,
    recordedBy,
    scheduleId,
    status,
    studentId,
}) {
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
        [scheduleId, studentId, status, status === 'makeup' ? makeupDate : null, notes || null, recordedBy]
    );
}

async function cancelQueuedNotification({ academyId, connection, scheduleId, studentId }) {
    try {
        await require('../../utils/attendanceNotify').cancelQueuedAttendanceNotify({
            pool: connection,
            academyId,
            scheduleId,
            studentIds: [studentId],
        });
    } catch (error) {
        logger.error('[Attendance] queue cancel failed:', error);
    }
}

function queueAttendanceNotifications({ academyId, notifyTargets, schedule, scheduleId }) {
    if (notifyTargets.length === 0) return;
    setImmediate(() => require('../../utils/attendanceNotify').notifyAttendance({
        pool: db,
        decrypt,
        academyId,
        scheduleId,
        classDate: schedule.class_date,
        timeSlot: schedule.time_slot,
        targets: notifyTargets,
    }).catch((error) => logger.error('[AttendanceNotify]', error)));
}
