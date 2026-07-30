/**
 * backend/utils/attendanceNotify.js
 *
 * 출결 기록 후 보호자 알림톡 발송 유틸.
 *
 * 모드 (notification_settings):
 *   - attendance_send_mode = 'immediate'        → 즉시 발송 (기존)
 *   - attendance_send_mode = 'after_class_start' → 수업시작 + N분 후 큐 일괄
 *
 * export:
 *   notifyAttendance({ pool, decrypt, academyId, scheduleId, classDate, timeSlot, targets })
 *   cancelQueuedAttendanceNotify({ pool, academyId, scheduleId, studentIds })
 *   processAttendanceNotificationQueue()  // 스케줄러
 */

const pool = require('../config/database');
const { decrypt } = require('./encryption');
const { sendAlimtalkSolapi } = require('./solapi');
const { sendAlimtalk, decryptApiKey } = require('./naverSens');
const logger = require('./logger');

const SEND_STATUSES = new Set(['present', 'late', 'absent', 'excused']);
const ALLOWED_DELAYS = new Set([10, 15, 20, 30]);
const SLOT_TIME_COLUMNS = {
    morning: 'morning_class_time',
    afternoon: 'afternoon_class_time',
    evening: 'evening_class_time',
};
const DEFAULT_SLOT_RANGES = {
    morning: '09:30-12:00',
    afternoon: '14:00-18:00',
    evening: '18:30-21:00',
};

function sanitizeNotes(notes) {
    if (!notes) return '';
    return String(notes)
        .replace(/#\{[^}]*\}/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);
}

function buildAttendanceStatus(status, notes) {
    if (status === 'present') return '출석';
    if (status === 'late') return '지각';
    const reason = sanitizeNotes(notes);
    return reason ? `결석(사유: ${reason})` : '결석';
}

function buildContent(templateContent, vars) {
    let content = templateContent || '';
    content = content
        .replace(/#{학원명}/g, vars.academyName)
        .replace(/#{이름}/g, vars.name)
        .replace(/#{월}/g, vars.month)
        .replace(/#{일}/g, vars.day)
        .replace(/#{요일}/g, vars.dayName)
        .replace(/#{출결상태}/g, vars.attendanceStatus);
    return content;
}

function formatClassDateParts(classDate) {
    const dateStr = typeof classDate === 'string'
        ? classDate
        : classDate.toISOString().split('T')[0];
    const dateObj = new Date(`${dateStr}T00:00:00`);
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    return {
        dateStr,
        month: `${dateObj.getMonth() + 1}월`,
        day: `${dateObj.getDate()}일`,
        dayName: dayNames[dateObj.getDay()],
    };
}

function parseSlotStartTime(range) {
    // "09:30-12:00" | "09:30" → { hour, minute }
    const start = String(range || '').split('-')[0].trim();
    const m = start.match(/^(\d{1,2}):(\d{2})$/);
    if (!m) return null;
    return { hour: Number(m[1]), minute: Number(m[2]) };
}

function toMysqlDatetime(date) {
    const y = date.getFullYear();
    const mo = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const h = String(date.getHours()).padStart(2, '0');
    const mi = String(date.getMinutes()).padStart(2, '0');
    const s = String(date.getSeconds()).padStart(2, '0');
    return `${y}-${mo}-${d} ${h}:${mi}:${s}`;
}

/**
 * 수업 시작 시각 + delay → 발송 예정 시각 (KST wall-clock 기준, 서버 로컬이 KST라고 가정)
 * 이미 지났으면 즉시(now) 반환 → 호출측에서 immediate 처리 가능
 */
async function computeScheduledSendAt(db, academyId, classDate, timeSlot, delayMinutes) {
    const col = SLOT_TIME_COLUMNS[timeSlot] || 'evening_class_time';
    const [rows] = await db.execute(
        `SELECT ${col} AS slot_range FROM academy_settings WHERE academy_id = ? LIMIT 1`,
        [academyId]
    );
    const range = (rows[0] && rows[0].slot_range) || DEFAULT_SLOT_RANGES[timeSlot] || DEFAULT_SLOT_RANGES.evening;
    const start = parseSlotStartTime(range) || parseSlotStartTime(DEFAULT_SLOT_RANGES.evening);

    const dateStr = typeof classDate === 'string'
        ? classDate
        : classDate.toISOString().split('T')[0];
    const base = new Date(`${dateStr}T00:00:00`);
    base.setHours(start.hour, start.minute, 0, 0);
    base.setMinutes(base.getMinutes() + (Number(delayMinutes) || 15));

    const now = new Date();
    return base.getTime() <= now.getTime() ? now : base;
}

async function sendOneAttendanceMessage({
    db,
    dec,
    setting,
    academyId,
    academyName,
    dateParts,
    student_id,
    attendance_status,
    notes,
}) {
    const [studentRows] = await db.execute(
        'SELECT name, parent_phone FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
        [student_id, academyId]
    );
    if (studentRows.length === 0) return { skipped: true, reason: 'no_student' };

    const studentRow = studentRows[0];
    const studentName = dec(studentRow.name);
    const parentPhone = studentRow.parent_phone ? dec(studentRow.parent_phone) : null;
    const phoneDigits = parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '';
    if (!/^01[0-9]{8,9}$/.test(phoneDigits)) {
        return { skipped: true, reason: 'invalid_phone' };
    }

    const attendanceStatusText = buildAttendanceStatus(attendance_status, notes);
    const serviceType = setting.service_type || 'sens';
    const content = buildContent(
        serviceType === 'solapi'
            ? (setting.solapi_attendance_template_content || '')
            : (setting.sens_attendance_template_content || ''),
        {
            academyName,
            name: studentName,
            month: dateParts.month,
            day: dateParts.day,
            dayName: dateParts.dayName,
            attendanceStatus: attendanceStatusText,
        }
    );

    let result;
    let templateRef = null;

    if (serviceType === 'solapi') {
        const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, process.env.ENCRYPTION_KEY);
        if (!decryptedSolapiSecret) {
            logger.error('[AttendanceNotify] 솔라피 API Secret 복호화 실패, academyId=' + academyId);
            return { success: false, error: 'solapi_secret' };
        }
        templateRef = setting.solapi_attendance_template_id;
        if (!templateRef) return { skipped: true, reason: 'no_template' };

        let buttons = null;
        if (setting.solapi_attendance_buttons) {
            try { buttons = JSON.parse(setting.solapi_attendance_buttons); } catch (e) { /* ignore */ }
        }
        const imageUrl = setting.solapi_attendance_image_url || null;
        result = await sendAlimtalkSolapi(
            {
                solapi_api_key: setting.solapi_api_key,
                solapi_api_secret: decryptedSolapiSecret,
                solapi_pfid: setting.solapi_pfid,
                solapi_sender_phone: setting.solapi_sender_phone,
            },
            templateRef,
            [{
                phone: parentPhone,
                content,
                buttons,
                imageUrl,
                studentId: student_id,
                studentName,
            }]
        );
    } else {
        templateRef = setting.sens_attendance_template_code;
        if (!templateRef) return { skipped: true, reason: 'no_template' };
        const decryptedSensSecret = decryptApiKey(setting.naver_secret_key, process.env.ENCRYPTION_KEY);
        if (!decryptedSensSecret) {
            logger.error('[AttendanceNotify] SENS Secret 복호화 실패, academyId=' + academyId);
            return { success: false, error: 'sens_secret' };
        }
        let buttons = null;
        if (setting.sens_attendance_buttons) {
            try { buttons = JSON.parse(setting.sens_attendance_buttons); } catch (e) { /* ignore */ }
        }
        result = await sendAlimtalk(
            {
                naver_access_key: setting.naver_access_key,
                naver_secret_key: decryptedSensSecret,
                naver_service_id: setting.naver_service_id,
                kakao_channel_id: setting.kakao_channel_id,
            },
            templateRef,
            [{
                phone: parentPhone,
                content,
                buttons,
                studentId: student_id,
                studentName,
            }]
        );
    }

    try {
        await db.execute(
            `INSERT INTO notification_logs
            (academy_id, student_id, recipient_name, recipient_phone,
             message_type, template_code, message_content, status, request_id,
             error_message, sent_at)
            VALUES (?, ?, ?, ?, 'alimtalk', ?, ?, ?, ?, ?, NOW())`,
            [
                academyId,
                student_id,
                studentName,
                parentPhone,
                templateRef,
                content,
                result.success ? 'sent' : 'failed',
                result.groupId || result.requestId || null,
                result.success ? null : (result.error || 'Unknown error'),
            ]
        );
    } catch (logErr) {
        logger.error(`[AttendanceNotify] 로그 적재 실패(발송은 완료) student_id=${student_id}:`, logErr);
    }

    return {
        success: !!result.success,
        error: result.success ? null : (result.error || 'send_failed'),
    };
}

async function enqueueAttendance({
    db,
    academyId,
    scheduleId,
    classDate,
    timeSlot,
    delayMinutes,
    student_id,
    attendance_status,
    notes,
}) {
    const scheduled = await computeScheduledSendAt(
        db,
        academyId,
        classDate,
        timeSlot || 'evening',
        delayMinutes
    );
    const dateStr = typeof classDate === 'string'
        ? classDate
        : classDate.toISOString().split('T')[0];
    const slot = ['morning', 'afternoon', 'evening'].includes(timeSlot) ? timeSlot : 'evening';

    await db.execute(
        `INSERT INTO attendance_notification_queue
         (academy_id, student_id, class_schedule_id, class_date, time_slot,
          attendance_status, notes, scheduled_send_at, status)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')
         ON DUPLICATE KEY UPDATE
           attendance_status = VALUES(attendance_status),
           notes = VALUES(notes),
           scheduled_send_at = VALUES(scheduled_send_at),
           status = 'pending',
           error_message = NULL,
           sent_at = NULL,
           updated_at = NOW()`,
        [
            academyId,
            student_id,
            scheduleId,
            dateStr,
            slot,
            attendance_status,
            sanitizeNotes(notes) || null,
            toMysqlDatetime(scheduled),
        ]
    );

    return scheduled;
}

/**
 * 출결 체크 직후 호출
 */
async function notifyAttendance({
    pool: callerPool,
    decrypt: callerDecrypt,
    academyId,
    scheduleId,
    classDate,
    timeSlot,
    targets,
}) {
    const db = callerPool || pool;
    const dec = callerDecrypt || decrypt;
    if (!targets || targets.length === 0) return;

    const [rows] = await db.execute(
        `SELECT ns.*, a.name AS academy_name
         FROM notification_settings ns
         JOIN academies a ON ns.academy_id = a.id
         WHERE ns.academy_id = ?`,
        [academyId]
    );
    if (rows.length === 0) return;

    const setting = rows[0];
    if (!setting.attendance_alimtalk_enabled) return;

    const mode = setting.attendance_send_mode === 'after_class_start' ? 'after_class_start' : 'immediate';
    let delayMinutes = parseInt(setting.attendance_delay_minutes, 10);
    if (!ALLOWED_DELAYS.has(delayMinutes)) delayMinutes = 15;

    const academyName = setting.academy_name || '학원';
    const dateParts = formatClassDateParts(classDate);

    for (const target of targets) {
        const { student_id, attendance_status, notes, prevStatus } = target;
        if (!SEND_STATUSES.has(attendance_status)) continue;
        if (attendance_status === prevStatus) continue;

        try {
            if (mode === 'after_class_start') {
                const scheduled = await enqueueAttendance({
                    db,
                    academyId,
                    scheduleId,
                    classDate,
                    timeSlot,
                    delayMinutes,
                    student_id,
                    attendance_status,
                    notes,
                });
                // 이미 발송 시각이 지났으면 즉시 발송 (큐는 스케줄러가 곧 처리, 또는 여기서 바로)
                if (scheduled.getTime() <= Date.now() + 5000) {
                    const sendResult = await sendOneAttendanceMessage({
                        db,
                        dec,
                        setting,
                        academyId,
                        academyName,
                        dateParts,
                        student_id,
                        attendance_status,
                        notes,
                    });
                    if (!sendResult.skipped) {
                        await db.execute(
                            `UPDATE attendance_notification_queue
                             SET status = ?, sent_at = NOW(), error_message = ?, updated_at = NOW()
                             WHERE academy_id = ? AND student_id = ? AND class_schedule_id = ?`,
                            [
                                sendResult.success ? 'sent' : 'failed',
                                sendResult.success ? null : (sendResult.error || 'failed'),
                                academyId,
                                student_id,
                                scheduleId,
                            ]
                        );
                    }
                }
            } else {
                await sendOneAttendanceMessage({
                    db,
                    dec,
                    setting,
                    academyId,
                    academyName,
                    dateParts,
                    student_id,
                    attendance_status,
                    notes,
                });
            }
        } catch (studentErr) {
            logger.error(`[AttendanceNotify] student_id=${student_id} 처리 실패:`, studentErr);
        }
    }
}

/**
 * 출결 취소(none) 시 pending 큐 취소
 */
async function cancelQueuedAttendanceNotify({
    pool: callerPool,
    academyId,
    scheduleId,
    studentIds,
}) {
    const db = callerPool || pool;
    if (!studentIds || studentIds.length === 0) return;
    const placeholders = studentIds.map(() => '?').join(',');
    await db.execute(
        `UPDATE attendance_notification_queue
         SET status = 'cancelled', updated_at = NOW()
         WHERE academy_id = ?
           AND class_schedule_id = ?
           AND student_id IN (${placeholders})
           AND status = 'pending'`,
        [academyId, scheduleId, ...studentIds]
    );
}

/**
 * 스케줄러: 발송 시각 지난 pending 일괄 처리
 */
async function processAttendanceNotificationQueue() {
    const db = pool;
    const [due] = await db.execute(
        `SELECT q.*, a.name AS academy_name
         FROM attendance_notification_queue q
         JOIN academies a ON a.id = q.academy_id
         WHERE q.status = 'pending'
           AND q.scheduled_send_at <= NOW()
         ORDER BY q.scheduled_send_at ASC
         LIMIT 200`
    );

    if (!due.length) return { processed: 0 };

    let processed = 0;
    for (const row of due) {
        try {
            const [settingsRows] = await db.execute(
                `SELECT ns.*, a.name AS academy_name
                 FROM notification_settings ns
                 JOIN academies a ON ns.academy_id = a.id
                 WHERE ns.academy_id = ?`,
                [row.academy_id]
            );
            if (!settingsRows.length || !settingsRows[0].attendance_alimtalk_enabled) {
                await db.execute(
                    `UPDATE attendance_notification_queue
                     SET status = 'cancelled', error_message = 'disabled', updated_at = NOW()
                     WHERE id = ?`,
                    [row.id]
                );
                continue;
            }

            // 발송 직전 최신 출결 상태 반영 (큐 이후 수정됐을 수 있음)
            const [attRows] = await db.execute(
                `SELECT attendance_status, notes FROM attendance
                 WHERE class_schedule_id = ? AND student_id = ?`,
                [row.class_schedule_id, row.student_id]
            );
            let status = row.attendance_status;
            let notes = row.notes;
            if (attRows.length > 0) {
                if (!attRows[0].attendance_status || !SEND_STATUSES.has(attRows[0].attendance_status)) {
                    await db.execute(
                        `UPDATE attendance_notification_queue
                         SET status = 'cancelled', error_message = 'cleared', updated_at = NOW()
                         WHERE id = ?`,
                        [row.id]
                    );
                    continue;
                }
                status = attRows[0].attendance_status;
                notes = attRows[0].notes;
            }

            const setting = settingsRows[0];
            const dateParts = formatClassDateParts(row.class_date);
            const sendResult = await sendOneAttendanceMessage({
                db,
                dec: decrypt,
                setting,
                academyId: row.academy_id,
                academyName: setting.academy_name || row.academy_name || '학원',
                dateParts,
                student_id: row.student_id,
                attendance_status: status,
                notes,
            });

            if (sendResult.skipped) {
                await db.execute(
                    `UPDATE attendance_notification_queue
                     SET status = 'cancelled', error_message = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [sendResult.reason || 'skipped', row.id]
                );
            } else {
                await db.execute(
                    `UPDATE attendance_notification_queue
                     SET status = ?, sent_at = NOW(), error_message = ?,
                         attendance_status = ?, notes = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [
                        sendResult.success ? 'sent' : 'failed',
                        sendResult.success ? null : (sendResult.error || 'failed'),
                        status,
                        sanitizeNotes(notes) || null,
                        row.id,
                    ]
                );
            }
            processed += 1;
        } catch (err) {
            logger.error(`[AttendanceNotifyQueue] id=${row.id} 실패:`, err);
            try {
                await db.execute(
                    `UPDATE attendance_notification_queue
                     SET status = 'failed', error_message = ?, updated_at = NOW()
                     WHERE id = ?`,
                    [String(err.message || 'error').slice(0, 500), row.id]
                );
            } catch (e) { /* ignore */ }
        }
    }

    if (processed > 0) {
        logger.info(`[AttendanceNotifyQueue] processed=${processed}`);
    }
    return { processed };
}

module.exports = {
    notifyAttendance,
    cancelQueuedAttendanceNotify,
    processAttendanceNotificationQueue,
};
