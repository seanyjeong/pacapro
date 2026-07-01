/**
 * SMS 발송 API 라우트
 * 공지, 안내 등 일반 문자 발송 기능
 */

const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, checkPermission } = require('../middleware/auth');
const {
    decryptApiKey,
    sendSMS,
    sendMMS,
    isValidPhoneNumber
} = require('../utils/naverSens');
const {
    sendSMSSolapi,
    sendMMSSolapi
} = require('../utils/solapi');
const { decryptArrayFields } = require('../utils/encryption');
const logger = require('../utils/logger');
const registerSmsAuxiliaryRoutes = require('./sms/auxiliary');

const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY;
if (!ENCRYPTION_KEY) {
    logger.warn('[sms] ENCRYPTION_KEY 환경변수가 설정되지 않았습니다.');
}

/**
 * POST /paca/sms/send
 * SMS/MMS 발송
 * body: {
 *   target: 'all' | 'students' | 'parents' | 'custom',
 *   content,
 *   customPhones?: [],
 *   images?: [{name, data}],
 *   statusFilter?: 'active' | 'pending',  // 상태 필터 (재원생/미등록관리)
 *   gradeFilter?: 'all' | 'junior' | 'senior'  // 학년 필터 (선행반/3학년)
 * }
 */
router.post('/send', verifyToken, checkPermission('sms', 'edit'), async (req, res) => {
    try {
        const { target, content, customPhones, images, statusFilter = 'active', gradeFilter = 'all', senderNumberId } = req.body;

        if (!content || content.trim().length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '문자 내용을 입력해주세요.'
            });
        }

        // 알림톡 설정에서 API 키 가져오기 (같은 SENS 서비스 사용)
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SMS 설정을 먼저 완료해주세요. (설정 > 알림톡 및 SMS 설정)'
            });
        }

        const setting = settings[0];
        const serviceType = setting.service_type || 'sens';

        // 서비스별 설정 검증
        let decryptedSecret = null;
        let fromPhone = null;

        if (serviceType === 'solapi') {
            // 솔라피 설정 검증
            if (!setting.solapi_api_key || !setting.solapi_api_secret) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '솔라피 API 설정이 완료되지 않았습니다. (설정 > 알림톡 및 SMS 설정)'
                });
            }
            decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
            if (!decryptedSecret) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '솔라피 API Secret이 올바르지 않습니다.'
                });
            }

            // 선택한 발신번호 또는 기본 발신번호 가져오기
            if (senderNumberId) {
                const [senderNum] = await db.query(
                    `SELECT phone FROM sender_numbers
                     WHERE id = ? AND academy_id = ? AND service_type = 'solapi'`,
                    [senderNumberId, req.user.academyId]
                );
                if (senderNum.length > 0) {
                    fromPhone = senderNum[0].phone;
                }
            }
            if (!fromPhone) {
                // 기본 발신번호 조회
                const [defaultSender] = await db.query(
                    `SELECT phone FROM sender_numbers
                     WHERE academy_id = ? AND service_type = 'solapi' AND is_default = 1`,
                    [req.user.academyId]
                );
                fromPhone = defaultSender[0]?.phone || setting.solapi_sender_phone;
            }
            if (!fromPhone) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '솔라피 발신번호가 설정되지 않았습니다. (설정 > 알림톡 및 SMS 설정)'
                });
            }
        } else {
            // SENS 설정 검증
            if (!setting.sms_service_id) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: 'SMS Service ID가 설정되지 않았습니다. (설정 > 알림톡 및 SMS 설정)'
                });
            }
            decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
            if (!decryptedSecret) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: 'API Secret Key가 올바르지 않습니다.'
                });
            }

            // 선택한 발신번호 또는 기본 발신번호 가져오기
            if (senderNumberId) {
                const [senderNum] = await db.query(
                    `SELECT phone FROM sender_numbers
                     WHERE id = ? AND academy_id = ? AND service_type = 'sens'`,
                    [senderNumberId, req.user.academyId]
                );
                if (senderNum.length > 0) {
                    fromPhone = senderNum[0].phone;
                }
            }
            if (!fromPhone) {
                // 기본 발신번호 조회
                const [defaultSender] = await db.query(
                    `SELECT phone FROM sender_numbers
                     WHERE academy_id = ? AND service_type = 'sens' AND is_default = 1`,
                    [req.user.academyId]
                );
                if (defaultSender.length > 0) {
                    fromPhone = defaultSender[0].phone;
                } else {
                    // 학원 정보에서 발신번호 가져오기 (기존 호환성)
                    const [academy] = await db.query(
                        'SELECT phone FROM academies WHERE id = ?',
                        [req.user.academyId]
                    );
                    fromPhone = academy[0]?.phone;
                }
            }
            if (!fromPhone) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '발신번호가 설정되지 않았습니다. 설정 > 학원 기본 정보에서 전화번호를 입력하거나 발신번호를 등록해주세요.'
                });
            }
        }

        // 수신자 목록 조회
        let recipients = [];

        if (target === 'custom' && customPhones && customPhones.length > 0) {
            // 직접 입력한 전화번호
            recipients = customPhones
                .filter(phone => isValidPhoneNumber(phone))
                .map(phone => ({ phone, name: '직접입력' }));
        } else {
            // 학생/학부모 전화번호 조회
            let query = `
                SELECT
                    s.id,
                    s.name,
                    s.phone AS student_phone,
                    s.parent_phone,
                    s.grade
                FROM students s
                WHERE s.academy_id = ?
                  AND s.status = ?
                  AND s.deleted_at IS NULL
            `;
            const queryParams = [req.user.academyId, statusFilter];

            // 학년 필터 적용
            if (gradeFilter === 'junior') {
                // 선행반: 중학생 + 고1 + 고2
                query += ` AND s.grade IN ('중1', '중2', '중3', '고1', '고2')`;
            } else if (gradeFilter === 'senior') {
                // 3학년반: 고3 + N수
                query += ` AND s.grade IN ('고3', 'N수')`;
            }

            let [students] = await db.query(query, queryParams);

            // 암호화된 필드 복호화 (phone, parent_phone)
            students = decryptArrayFields(students, ['student_phone', 'parent_phone', 'name']);

            if (target === 'all') {
                // 모두: 학부모 전화 우선, 없으면 학생 전화
                recipients = students
                    .map(s => {
                        const phone = isValidPhoneNumber(s.parent_phone) ? s.parent_phone :
                                     isValidPhoneNumber(s.student_phone) ? s.student_phone : null;
                        return phone ? { phone, name: s.name, studentId: s.id } : null;
                    })
                    .filter(Boolean);
            } else if (target === 'students') {
                // 학생에게만
                recipients = students
                    .filter(s => isValidPhoneNumber(s.student_phone))
                    .map(s => ({ phone: s.student_phone, name: s.name, studentId: s.id }));
            } else if (target === 'parents') {
                // 학부모에게만
                recipients = students
                    .filter(s => isValidPhoneNumber(s.parent_phone))
                    .map(s => ({ phone: s.parent_phone, name: s.name, studentId: s.id }));
            }
        }

        // 중복 제거
        const uniquePhones = new Map();
        recipients.forEach(r => {
            const normalizedPhone = r.phone.replace(/-/g, '');
            if (!uniquePhones.has(normalizedPhone)) {
                uniquePhones.set(normalizedPhone, r);
            }
        });
        recipients = Array.from(uniquePhones.values());

        if (recipients.length === 0) {
            return res.json({
                message: '발송할 수신자가 없습니다.',
                sent: 0,
                failed: 0
            });
        }

        // 이미지가 있으면 MMS, 없으면 SMS/LMS
        const isMMS = images && images.length > 0;

        // MMS 이미지 검증
        if (isMMS) {
            if (images.length > 3) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '이미지는 최대 3장까지 첨부 가능합니다.'
                });
            }
            // 이미지 형식 검증
            const allowedTypes = ['jpg', 'jpeg', 'png'];
            for (const img of images) {
                const ext = img.name.split('.').pop().toLowerCase();
                if (!allowedTypes.includes(ext)) {
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: '이미지는 JPG, PNG 형식만 가능합니다.'
                    });
                }
            }
        }

        // SMS/MMS 발송 (배치로 처리, 최대 100명씩)
        const batchSize = 100;
        let sentCount = 0;
        let failedCount = 0;
        let lastError = null;
        let messageType = isMMS ? 'mms' : 'sms';

        for (let i = 0; i < recipients.length; i += batchSize) {
            const batch = recipients.slice(i, i + batchSize);

            let result;

            if (serviceType === 'solapi') {
                // 솔라피 발송
                if (isMMS) {
                    result = await sendMMSSolapi(
                        {
                            solapi_api_key: setting.solapi_api_key,
                            solapi_api_secret: decryptedSecret,
                            solapi_sender_phone: fromPhone
                        },
                        batch,
                        content,
                        images
                    );
                } else {
                    result = await sendSMSSolapi(
                        {
                            solapi_api_key: setting.solapi_api_key,
                            solapi_api_secret: decryptedSecret,
                            solapi_sender_phone: fromPhone
                        },
                        batch,
                        content
                    );
                }
                if (result.messageType) {
                    messageType = result.messageType.toLowerCase();
                }
            } else {
                // SENS 발송
                if (isMMS) {
                    result = await sendMMS(
                        {
                            naver_access_key: setting.naver_access_key,
                            naver_secret_key: decryptedSecret,
                            naver_service_id: setting.sms_service_id
                        },
                        fromPhone,
                        batch,
                        content,
                        images
                    );
                } else {
                    result = await sendSMS(
                        {
                            naver_access_key: setting.naver_access_key,
                            naver_secret_key: decryptedSecret,
                            naver_service_id: setting.sms_service_id
                        },
                        fromPhone,
                        batch,
                        content
                    );
                    if (result.messageType) {
                        messageType = result.messageType.toLowerCase();  // sms or lms
                    }
                }
            }

            // 에러 메시지 저장 (마지막 에러)
            if (!result.success) {
                lastError = result.error;
            }

            // 로그 기록
            for (const recipient of batch) {
                await db.query(
                    `INSERT INTO notification_logs
                    (academy_id, student_id, recipient_name, recipient_phone,
                     message_type, message_content, status, request_id,
                     error_message, sent_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                    [
                        req.user.academyId,
                        recipient.studentId || null,
                        recipient.name,
                        recipient.phone,
                        messageType.toLowerCase(),  // sms, lms, mms
                        content,
                        result.success ? 'sent' : 'failed',
                        result.requestId || null,
                        result.success ? null : (result.error || 'Unknown error')
                    ]
                );

                if (result.success) {
                    sentCount++;
                } else {
                    failedCount++;
                }
            }
        }

        // 모든 발송이 실패한 경우 에러 메시지 표시
        if (sentCount === 0 && failedCount > 0 && lastError) {
            // SENS 에러 메시지를 사용자 친화적으로 변환
            let userMessage = lastError;

            if (lastError.includes("'from' is not an authenticated") || lastError.includes("not an authenticated tel")) {
                userMessage = '발신번호가 Naver Cloud SENS에 등록되어 있지 않습니다. SENS 콘솔 > SMS > 발신번호 관리에서 학원 전화번호를 먼저 등록해주세요.';
            } else if (lastError.includes('serviceId')) {
                userMessage = 'SMS Service ID가 올바르지 않습니다. 설정 > 알림톡 및 SMS 설정에서 확인해주세요.';
            }

            return res.status(400).json({
                error: 'SMS Error',
                message: userMessage
            });
        }

        res.json({
            message: `문자 발송 완료: ${sentCount}명 성공, ${failedCount}명 실패`,
            sent: sentCount,
            failed: failedCount,
            total: recipients.length
        });
    } catch (error) {
        logger.error('SMS 발송 오류:', error);

        // SENS 에러 메시지를 사용자 친화적으로 변환
        let userMessage = 'SMS 발송에 실패했습니다.';
        const errorMsg = error.message || '';

        if (errorMsg.includes("'from' is not an authenticated")) {
            userMessage = '발신번호가 Naver Cloud SENS에 등록되어 있지 않습니다. SENS 콘솔 > SMS > 발신번호 관리에서 학원 전화번호를 먼저 등록해주세요.';
        } else if (errorMsg.includes('serviceId')) {
            userMessage = 'SMS Service ID가 올바르지 않습니다. 설정 > 알림톡 및 SMS 설정에서 확인해주세요.';
        } else if (errorMsg.includes('access key') || errorMsg.includes('secret key')) {
            userMessage = 'API 인증에 실패했습니다. Access Key와 Secret Key를 확인해주세요.';
        }

        res.status(500).json({
            error: 'Server Error',
            message: userMessage
        });
    }
});

registerSmsAuxiliaryRoutes(router, db);

module.exports = router;
