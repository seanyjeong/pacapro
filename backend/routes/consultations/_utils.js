/**
 * routes/consultations/_utils.js
 *
 * 상담 도메인 sub-라우터 공용 헬퍼 (Phase 3 #2).
 *  - 7개 sub-라우터 (list-detail / write / conversion / settings / calendar / learning) 가
 *    공유하는 의존성 (db / pool / 인증 미들웨어 / 암호화 / 외부 발송 채널 / 로거) 과
 *    상담 도메인 전용 헬퍼 (이름/전화 복호화, 예약번호 발급, 상담확정 알림톡 발송) 를
 *    한 곳에 모아 ADR-005 (pool.execute 통일) 와 sub-라우터 간 일관성을 보장한다.
 *
 * 설계 원칙 (RULES.md / ADR 준수):
 *  - DB 호출은 ADR-005 표준 (`pool.execute`) 만 사용. `db` alias 는 `pool` 과 동일 인스턴스.
 *  - 사용자 노출 메시지는 ADR-003 한국어 친화 + 시스템 정보 누출 0.
 *  - 응답 표면은 ADR-013 보존: 프론트 `src/lib/api/consultations.ts` + 학생 페이지가
 *    `consultations` / `consultation` / `pagination` / `stats` / `events` / `bookedTimes` /
 *    `linkedStudent` / `studentId` / `trialDates` / `consultationId` /
 *    `studentConsultationId` / `reservationNumber` / `alimtalkSent` 등 root 키를 직접 소비.
 *    body 의 root 키 셋을 변경하지 않는다.
 *  - 보안 헬퍼 (`encrypt`, `decrypt`, `decryptApiKey`) 시그니처 무변경 (ADR-007).
 *  - 외부 발송 채널 (`sendAlimtalkSolapi`, `sendAlimtalkSens`) 호출 셰이프 무변경 (ADR-007).
 */

const db = require('../../config/database');
const pool = db; // ADR-005 alias (ADR-011 신규 alias 추가 패턴)
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { decrypt, encrypt } = require('../../utils/encryption');
const { sendAlimtalkSolapi } = require('../../utils/solapi');
const { decryptApiKey, sendAlimtalk: sendAlimtalkSens } = require('../../utils/naverSens');
const logger = require('../../utils/logger');

// 암호화 키 (환경변수에서 가져옴). naverSens decryptApiKey 가 인자로 받음.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;

/**
 * 이름/전화 필드 복호화 헬퍼 (in-place mutation).
 * - 원본 객체에 다음 키가 있으면 복호화 후 같은 키로 덮어쓴다.
 * - 키 부재 시 null/undefined 보존 (skip).
 * - 호출자는 복사본을 넘기는 것이 안전 (`{...row}`).
 */
function decryptConsultationNames(obj) {
    if (!obj) return obj;
    if (obj.student_name) obj.student_name = decrypt(obj.student_name);
    if (obj.parent_name) obj.parent_name = decrypt(obj.parent_name);
    if (obj.parent_phone) obj.parent_phone = decrypt(obj.parent_phone);
    if (obj.student_phone) obj.student_phone = decrypt(obj.student_phone);
    if (obj.linked_student_name) obj.linked_student_name = decrypt(obj.linked_student_name);
    if (obj.name) obj.name = decrypt(obj.name);
    return obj;
}

/**
 * 배열 복호화 헬퍼 — 각 row 의 복사본에 decryptConsultationNames 적용.
 */
function decryptConsultationArray(arr) {
    return arr.map((item) => decryptConsultationNames({ ...item }));
}

/**
 * 학생 row (students 테이블) 의 이름/전화 복호화 (in-place mutation).
 */
function decryptStudentInfo(student) {
    if (!student) return student;
    if (student.name) student.name = decrypt(student.name);
    if (student.phone) student.phone = decrypt(student.phone);
    if (student.parent_phone) student.parent_phone = decrypt(student.parent_phone);
    return student;
}

/**
 * 예약번호 생성 (C + YYYYMMDD + 3자리 일련번호)
 *   예: C20251215001
 *
 * - 오늘자 마지막 reservation_number 를 조회해 다음 번호 발급.
 * - 동시성 보장은 호출 측 트랜잭션/UPDATE 흐름에 위임 (현재는 PUT /:id 에서 단일 발급).
 */
async function generateReservationNumber() {
    const today = new Date();
    const dateStr = today.toISOString().split('T')[0].replace(/-/g, '');
    const prefix = `C${dateStr}`;

    const [rows] = await pool.execute(
        `SELECT reservation_number FROM consultations
         WHERE reservation_number LIKE ?
         ORDER BY reservation_number DESC LIMIT 1`,
        [`${prefix}%`]
    );

    let seq = 1;
    if (rows.length > 0 && rows[0].reservation_number) {
        const lastSeq = parseInt(rows[0].reservation_number.slice(-3));
        seq = lastSeq + 1;
    }

    return `${prefix}${seq.toString().padStart(3, '0')}`;
}

/**
 * 상담 → 미등록관리(pending) 학생 생성 + 상담 연결 공용 헬퍼.
 *
 *  - conversion.js (수동 convert-to-pending) 와 write.js (상담완료 시 자동 전환),
 *    scripts/backfill-pending-from-consultations.js (소급 스크립트) 가 공유한다.
 *  - INSERT 컬럼/값 셰이프는 기존 convert-to-pending 원본 보존.
 *  - 호출 측이 linked_student_id 부재를 먼저 확인해야 한다 (중복 생성 가드는 호출자 책임).
 *
 * @param {Object} consultation - consultations row (id, academy_id, student_name, ... 포함)
 * @param {Object} [opts]
 * @param {string} [opts.studentPhone] - 학생 본인 전화번호 (없으면 parent_phone 사용)
 * @param {string} [opts.memo] - 미등록관리 메모 (없으면 inquiry_content)
 * @returns {Promise<number>} 생성된 studentId
 */
async function createPendingStudentFromConsultation(consultation, { studentPhone, memo } = {}) {
    // 학부모 연락처는 정식 등록 시 입력
    const phone = studentPhone || consultation.parent_phone;

    // [중복 방지] 이미 같은 학생(이름+전번+성별)이 존재하면 새 pending 을 만들지 않고 기존 학생에 연결한다.
    // (2026-06-23: 상담완료 자동전환이 재원생을 복제 pending 으로 양산하던 버그 차단)
    const _norm = (v) => (v || '').toString().replace(/[^0-9]/g, '');
    const _trim = (v) => (v || '').toString().trim();
    const _rawName = consultation.student_name;
    const _targetName = _trim(typeof _rawName === 'string' && _rawName.startsWith('ENC:') ? decrypt(_rawName) : _rawName);
    const _targetPhone = _norm(typeof phone === 'string' && phone.startsWith('ENC:') ? decrypt(phone) : phone);
    const _targetGender = _trim(consultation.gender);
    if (_targetName) {
        const [_existing] = await pool.execute(
            `SELECT id, name, phone, gender FROM students WHERE academy_id = ? AND deleted_at IS NULL`,
            [consultation.academy_id]
        );
        const _match = _existing.find((row) => {
            const rName = _trim((() => { try { return decrypt(row.name); } catch (e) { return ''; } })());
            if (rName !== _targetName) return false;
            const rPhone = _norm((() => { try { return decrypt(row.phone); } catch (e) { return ''; } })());
            if (_targetPhone && rPhone) return rPhone === _targetPhone;        // 전번 둘 다 있으면 전번까지 일치해야 동일인
            const rGender = _trim(row.gender);
            return rGender && _targetGender ? rGender === _targetGender : false; // 전번 없으면 성별로 보조 (전번 한쪽만 있으면 동일인 아님)
        });
        if (_match) {
            await pool.execute(
                `UPDATE consultations SET status = 'completed', linked_student_id = ? WHERE id = ?`,
                [_match.id, consultation.id]
            );
            logger.info(`[중복방지] 기존 학생 #${_match.id} 에 상담 #${consultation.id} 연결 (신규 pending 미생성)`);
            return _match.id;
        }
    }

    // 민감 정보 암호화 (이미 암호화된 값이면 그대로 사용)
    const isAlreadyEncrypted = (val) => val && typeof val === 'string' && val.startsWith('ENC:');
    const encryptedName = isAlreadyEncrypted(consultation.student_name)
        ? consultation.student_name
        : encrypt(consultation.student_name);
    const encryptedPhone = phone
        ? (isAlreadyEncrypted(phone) ? phone : encrypt(phone))
        : null;

    const [studentResult] = await pool.execute(
        `INSERT INTO students (
            academy_id, name, grade, school, gender, phone, parent_phone, status,
            is_trial, memo, class_days, monthly_tuition, consultation_date, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, NULL, 'pending', 0, ?, '[]', 0, ?, NOW())`,
        [
            consultation.academy_id,
            encryptedName,
            consultation.student_grade,
            consultation.student_school,
            consultation.gender || null,
            encryptedPhone,
            memo || consultation.inquiry_content || null,
            consultation.preferred_date
        ]
    );

    const studentId = studentResult.insertId;

    // 상담 상태 업데이트 (completed + 학생 연결)
    await pool.execute(
        `UPDATE consultations SET status = 'completed', linked_student_id = ? WHERE id = ?`,
        [studentId, consultation.id]
    );

    return studentId;
}

/**
 * 상담확정 알림톡 발송 (service_type 에 따라 솔라피/SENS 채널 분기).
 *
 *  - notification_settings 의 service_type 컬럼으로 채널 결정 (기본 'solapi').
 *  - 설정/템플릿/Secret 미비 시 false 반환 (호출 측 응답에는 영향 X).
 *  - 발송 성공 시 notification_logs 에 'sent' 로그 기록.
 *  - 외부 호출 셰이프 (sendAlimtalkSolapi / sendAlimtalkSens 의 첫 인자 객체) 는 ADR-007 무변경.
 *
 * @param {Object} consultation - { student_name, parent_phone, preferred_date, preferred_time, reservation_number }
 * @param {number} academyId
 * @returns {Promise<boolean>} 발송 성공 여부
 */
async function sendConfirmationAlimtalk(consultation, academyId) {
    try {
        const { student_name, parent_phone, preferred_date, preferred_time, reservation_number } = consultation;

        // 알림 설정 조회 (service_type 포함)
        const [settings] = await pool.execute(
            `SELECT service_type,
                    solapi_api_key, solapi_api_secret, solapi_pfid, solapi_sender_phone,
                    solapi_consultation_template_id, solapi_consultation_template_content,
                    solapi_consultation_buttons, solapi_consultation_image_url,
                    naver_access_key, naver_secret_key, naver_service_id, kakao_channel_id,
                    sens_consultation_template_code, sens_consultation_template_content,
                    sens_consultation_buttons, sens_consultation_image_url
             FROM notification_settings WHERE academy_id = ?`,
            [academyId]
        );

        if (settings.length === 0) {
            logger.info('[ConsultationAlimtalk] 알림 설정 없음');
            return false;
        }

        const setting = settings[0];
        const serviceType = setting.service_type || 'solapi';

        // 복호화
        const name = decrypt(student_name) || student_name;
        const phone = decrypt(parent_phone) || parent_phone;

        // 날짜 포맷 (2025년 12월 15일)
        const date = new Date(preferred_date);
        const dateStr = `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;

        // 시간 포맷 (14:00)
        const timeStr = preferred_time.substring(0, 5);

        // service_type에 따라 분기
        if (serviceType === 'sens') {
            // === SENS 발송 ===
            if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                logger.info('[ConsultationAlimtalk] SENS 설정 미완료');
                return false;
            }

            if (!setting.sens_consultation_template_code) {
                logger.info('[ConsultationAlimtalk] SENS 상담확정 템플릿 코드 미설정');
                return false;
            }

            const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
            if (!decryptedSecret) {
                logger.info('[ConsultationAlimtalk] SENS Secret 복호화 실패');
                return false;
            }

            // 템플릿 변수 치환
            let content = setting.sens_consultation_template_content || '';
            content = content
                .replace(/#{이름}/g, name)
                .replace(/#{날짜}/g, dateStr)
                .replace(/#{시간}/g, timeStr)
                .replace(/#{예약번호}/g, reservation_number);

            // 버튼 파싱
            let buttons = null;
            if (setting.sens_consultation_buttons) {
                try {
                    buttons = typeof setting.sens_consultation_buttons === 'string'
                        ? JSON.parse(setting.sens_consultation_buttons)
                        : setting.sens_consultation_buttons;
                } catch (e) {
                    logger.error('[ConsultationAlimtalk] SENS 버튼 파싱 오류:', e);
                }
            }

            logger.info('[ConsultationAlimtalk] SENS 발송:', { name, phone, dateStr, timeStr, reservation_number });

            const result = await sendAlimtalkSens(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id
                },
                setting.sens_consultation_template_code,
                [{ phone, content, buttons }]
            );

            if (result.success) {
                logger.info('[ConsultationAlimtalk] SENS 발송 성공:', reservation_number);
                await pool.execute(
                    `INSERT INTO notification_logs
                    (academy_id, recipient_name, recipient_phone, message_type, template_code,
                     message_content, status, request_id, sent_at)
                    VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                    [academyId, name, phone, setting.sens_consultation_template_code, content, result.requestId || null]
                );
                return true;
            }

            logger.error('[ConsultationAlimtalk] SENS 발송 실패:', result.error);
            return false;
        }

        // === 솔라피 발송 ===
        if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
            logger.info('[ConsultationAlimtalk] 솔라피 설정 미완료');
            return false;
        }

        if (!setting.solapi_consultation_template_id) {
            logger.info('[ConsultationAlimtalk] 상담확정 템플릿 ID 미설정');
            return false;
        }

        const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            logger.info('[ConsultationAlimtalk] 솔라피 Secret 복호화 실패');
            return false;
        }

        // 템플릿 변수 치환
        let content = setting.solapi_consultation_template_content || '';
        content = content
            .replace(/#{이름}/g, name)
            .replace(/#{날짜}/g, dateStr)
            .replace(/#{시간}/g, timeStr)
            .replace(/#{예약번호}/g, reservation_number);

        // 버튼 설정 파싱 및 변수 치환
        let buttons = null;
        if (setting.solapi_consultation_buttons) {
            try {
                buttons = JSON.parse(setting.solapi_consultation_buttons);
                buttons = buttons.map((btn) => ({
                    ...btn,
                    linkMo: btn.linkMo
                        ?.replace(/#{이름}/g, name)
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{예약번호}/g, reservation_number),
                    linkPc: btn.linkPc
                        ?.replace(/#{이름}/g, name)
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{예약번호}/g, reservation_number),
                }));
            } catch (e) {
                logger.error('[ConsultationAlimtalk] 솔라피 버튼 파싱 오류:', e);
            }
        }

        const imageUrl = setting.solapi_consultation_image_url || null;

        logger.info('[ConsultationAlimtalk] 솔라피 발송:', { name, phone, dateStr, timeStr, reservation_number, hasButtons: !!buttons, hasImage: !!imageUrl });

        const result = await sendAlimtalkSolapi(
            {
                solapi_api_key: setting.solapi_api_key,
                solapi_api_secret: decryptedSecret,
                solapi_pfid: setting.solapi_pfid,
                solapi_sender_phone: setting.solapi_sender_phone
            },
            setting.solapi_consultation_template_id,
            [{ phone, content, buttons, imageUrl }]
        );

        if (result.success) {
            logger.info('[ConsultationAlimtalk] 솔라피 발송 성공:', reservation_number);
            await pool.execute(
                `INSERT INTO notification_logs
                (academy_id, recipient_name, recipient_phone, message_type, template_code,
                 message_content, status, request_id, sent_at)
                VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                [academyId, name, phone, setting.solapi_consultation_template_id, content, result.groupId || null]
            );
            return true;
        }

        logger.error('[ConsultationAlimtalk] 솔라피 발송 실패:', result.error);
        return false;
    } catch (error) {
        logger.error('[ConsultationAlimtalk] 오류:', error.message);
        return false;
    }
}

module.exports = {
    db,
    pool,
    verifyToken,
    checkPermission,
    decrypt,
    encrypt,
    decryptApiKey,
    sendAlimtalkSolapi,
    sendAlimtalkSens,
    logger,
    ENCRYPTION_KEY,
    decryptConsultationNames,
    decryptConsultationArray,
    decryptStudentInfo,
    generateReservationNumber,
    createPendingStudentFromConsultation,
    sendConfirmationAlimtalk,
};
