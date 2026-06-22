/**
 * backend/utils/attendanceNotify.js
 *
 * 출결 기록 후 보호자 알림톡 비동기 발송 유틸.
 *
 * export: async notifyAttendance({ pool, decrypt, academyId, scheduleId, classDate, targets })
 *   - targets: [{ student_id, attendance_status, notes, prevStatus }]
 *   - fire-and-forget 용 (호출측 setImmediate 내에서 .catch 처리)
 *
 * 발송 조건 (Design §2.3):
 *   - attendance_status ∈ {present, late, absent, excused}
 *   - attendance_status !== prevStatus  (동일 상태 재기록 skip)
 *
 * #{출결상태} 조립 (Plan §8 확정):
 *   present              → "출석"
 *   late                 → "지각"
 *   absent|excused +notes → "결석(사유: {notes})"
 *   absent|excused -notes → "결석"
 *
 * 발송 헬퍼 시그니처 (solapi.js / naverSens.js 확인 결과):
 *   sendAlimtalkSolapi(settings, templateId, recipients, buttons?)
 *   sendAlimtalk(settings, templateCode, recipients)
 *   recipients[].content = 변수 치환 완료된 전체 텍스트
 *
 * notification_logs INSERT 컬럼: auto.js L486 패턴 동일.
 */

const pool = require('../config/database');
const { decrypt } = require('./encryption');
const { sendAlimtalkSolapi } = require('./solapi');
const { sendAlimtalk, decryptApiKey } = require('./naverSens');
const logger = require('./logger');

const SEND_STATUSES = new Set(['present', 'late', 'absent', 'excused']);

/**
 * 결석 사유(notes, 사용자 입력) 정제 — 카카오 본문 안정성/재치환 방지
 *  - #{...} 템플릿 변수 패턴 제거 (강사가 #{이름} 등 넣어 혼동 메시지 방지)
 *  - 개행·연속공백 → 공백 1 (승인 템플릿 본문 포맷 보호)
 *  - 길이 상한 50자
 */
function sanitizeNotes(notes) {
    if (!notes) return '';
    return String(notes)
        .replace(/#\{[^}]*\}/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 50);
}

/**
 * #{출결상태} 문자열 조립 (Plan §8)
 */
function buildAttendanceStatus(status, notes) {
    if (status === 'present') return '출석';
    if (status === 'late') return '지각';
    // absent | excused
    const reason = sanitizeNotes(notes);
    return reason ? `결석(사유: ${reason})` : '결석';
}

/**
 * 변수 치환 (auto.js L457-459 패턴 복제)
 */
function buildContent(templateContent, vars) {
    let content = templateContent;
    content = content
        .replace(/#{학원명}/g, vars.academyName)
        .replace(/#{이름}/g, vars.name)
        .replace(/#{월}/g, vars.month)
        .replace(/#{일}/g, vars.day)
        .replace(/#{요일}/g, vars.dayName)
        .replace(/#{출결상태}/g, vars.attendanceStatus);
    return content;
}

/**
 * 출결 알림톡 발송
 * @param {Object} params
 * @param {Object} params.pool - mysql2 promise pool (호출측 전달)
 * @param {Function} params.decrypt - 복호화 함수 (호출측 전달 or 내부 import)
 * @param {number} params.academyId
 * @param {number} params.scheduleId
 * @param {string|Date} params.classDate - YYYY-MM-DD
 * @param {Array} params.targets - [{ student_id, attendance_status, notes, prevStatus }]
 */
async function notifyAttendance({ pool: callerPool, decrypt: callerDecrypt, academyId, scheduleId, classDate, targets }) {
    // 자체 pool/decrypt 사용 (호출측 release된 connection 재사용 금지 — Design §5)
    const db = callerPool || pool;
    const dec = callerDecrypt || decrypt;

    if (!targets || targets.length === 0) return;

    // notification_settings 조회 (academy_name 은 academies JOIN — auto.js L57-60 패턴)
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

    const serviceType = setting.service_type || 'sens';

    // classDate 파싱 (YYYY-MM-DD 문자열 또는 Date 객체)
    const dateStr = typeof classDate === 'string'
        ? classDate
        : classDate.toISOString().split('T')[0];
    const dateObj = new Date(dateStr + 'T00:00:00');
    const month = String(dateObj.getMonth() + 1) + '월';   // "5월" (단위 포함)
    const day   = String(dateObj.getDate()) + '일';        // "18일"
    const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
    const dayName = dayNames[dateObj.getDay()];
    const academyName = setting.academy_name || '학원';

    for (const target of targets) {
        const { student_id, attendance_status, notes, prevStatus } = target;

        // 발송 조건 검사
        if (!SEND_STATUSES.has(attendance_status)) continue;
        if (attendance_status === prevStatus) continue;

        try {
            // 학생 이름 + 보호자 폰 조회
            const [studentRows] = await db.execute(
                'SELECT name, parent_phone FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [student_id, academyId]
            );
            if (studentRows.length === 0) continue;

            const studentRow = studentRows[0];
            const studentName  = dec(studentRow.name);
            const parentPhone  = studentRow.parent_phone ? dec(studentRow.parent_phone) : null;

            // decrypt 는 실패 시 입력(암호문)을 그대로 반환(passthrough) → 정상 휴대폰만 발송.
            // 암호문/비정상 번호면 해당 학생 skip (암호문 발송·로그 적재 방지)
            const phoneDigits = parentPhone ? parentPhone.replace(/[^0-9]/g, '') : '';
            if (!/^01[0-9]{8,9}$/.test(phoneDigits)) continue;

            const attendanceStatusText = buildAttendanceStatus(attendance_status, notes);
            const content = buildContent(
                serviceType === 'solapi'
                    ? (setting.solapi_attendance_template_content || '')
                    : (setting.sens_attendance_template_content || ''),
                {
                    academyName,
                    name: studentName,
                    month,
                    day,
                    dayName,
                    attendanceStatus: attendanceStatusText
                }
            );

            let result;
            if (serviceType === 'solapi') {
                // 솔라피 — decryptApiKey 패턴 (auto.js L354)
                const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, process.env.ENCRYPTION_KEY);
                if (!decryptedSolapiSecret) {
                    logger.error('[AttendanceNotify] 솔라피 API Secret 복호화 실패, academyId=' + academyId);
                    continue;
                }

                const templateId = setting.solapi_attendance_template_id;
                if (!templateId) continue;

                let buttons = null;
                if (setting.solapi_attendance_buttons) {
                    try { buttons = JSON.parse(setting.solapi_attendance_buttons); } catch (e) { /* ignore */ }
                }
                const imageUrl = setting.solapi_attendance_image_url || null;

                const recipients = [{
                    phone: parentPhone,
                    content,
                    buttons,
                    imageUrl,
                    studentId: student_id,
                    studentName
                }];

                result = await sendAlimtalkSolapi(
                    {
                        solapi_api_key: setting.solapi_api_key,
                        solapi_api_secret: decryptedSolapiSecret,
                        solapi_pfid: setting.solapi_pfid,
                        solapi_sender_phone: setting.solapi_sender_phone
                    },
                    templateId,
                    recipients
                );

                // notification_logs INSERT (auto.js L486 패턴) — 발송은 이미 완료. 로그 실패가 발송 성공을 묻지 않게 분리
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
                            templateId,
                            content,
                            result.success ? 'sent' : 'failed',
                            result.groupId || null,
                            result.success ? null : (result.error || 'Unknown error')
                        ]
                    );
                } catch (logErr) {
                    logger.error(`[AttendanceNotify] 로그 적재 실패(발송은 완료) student_id=${student_id}:`, logErr);
                }

            } else {
                // SENS
                const templateCode = setting.sens_attendance_template_code;
                if (!templateCode) continue;

                const decryptedSensSecret = decryptApiKey(setting.naver_secret_key, process.env.ENCRYPTION_KEY);
                if (!decryptedSensSecret) {
                    logger.error('[AttendanceNotify] SENS Secret 복호화 실패, academyId=' + academyId);
                    continue;
                }

                let buttons = null;
                if (setting.sens_attendance_buttons) {
                    try { buttons = JSON.parse(setting.sens_attendance_buttons); } catch (e) { /* ignore */ }
                }

                const recipients = [{
                    phone: parentPhone,
                    content,
                    buttons,
                    studentId: student_id,
                    studentName
                }];

                result = await sendAlimtalk(
                    {
                        naver_access_key: setting.naver_access_key,
                        naver_secret_key: decryptedSensSecret,
                        naver_service_id: setting.naver_service_id,
                        kakao_channel_id: setting.kakao_channel_id
                    },
                    templateCode,
                    recipients
                );

                // notification_logs INSERT (auto.js L486 패턴) — 발송은 이미 완료. 로그 실패가 발송 성공을 묻지 않게 분리
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
                            templateCode,
                            content,
                            result.success ? 'sent' : 'failed',
                            result.requestId || null,
                            result.success ? null : (result.error || 'Unknown error')
                        ]
                    );
                } catch (logErr) {
                    logger.error(`[AttendanceNotify] 로그 적재 실패(발송은 완료) student_id=${student_id}:`, logErr);
                }
            }

        } catch (studentErr) {
            // 1명 실패가 나머지 차단 X (Design §1.1)
            logger.error(`[AttendanceNotify] student_id=${student_id} 발송 실패:`, studentErr);
        }
    }
}

module.exports = { notifyAttendance };
