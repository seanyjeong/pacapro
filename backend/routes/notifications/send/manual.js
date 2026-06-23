/**
 * routes/notifications/send/manual.js
 *
 * 학원 관리자가 UI 에서 직접 발송하는 endpoint 2건.
 *  - POST /send-unpaid     : 미납자 일괄 발송 (특정 년/월)
 *  - POST /send-individual : 단일 학원비에 대한 개별 발송
 *
 * 인증: `verifyToken + checkPermission('notifications', 'edit')`
 *  - 학원 관리자 ID 토큰 + notifications.edit 권한 보유자만 호출 가능.
 *  - 프론트 `src/lib/api/notifications.ts` (사장님 / 학원장 대시보드) 가 직접 소비.
 *
 * 리팩 노트 (Phase 3 #3, ADR-005 / ADR-003 / ADR-013 / ADR-007):
 *  - DB 호출 `db.query` (4건) → `pool.execute` 통일 (ADR-005). IN 절 없음 (ADR-016 무관).
 *  - 사용자 노출 메시지 한국어 (ADR-003), `e.message` / 시스템 정보 누출 0건.
 *  - 응답 표면 (ADR-013): `{message, sent, failed}` (일괄) / `{message, success, requestId}` (개별 성공)
 *    / `{error:'Validation Error', message}` 등 root 키 1:1 보존. 프론트 `SendResponse` 타입 호환.
 *  - 보안 헬퍼 (`decryptApiKey` / `sendAlimtalk` / `sendAlimtalkSolapi`) 시그니처 100% 무변경 (ADR-007).
 */

const {
    pool,
    verifyToken,
    checkPermission,
    decryptApiKey,
    sendAlimtalk,
    sendAlimtalkSolapi,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    decryptStudentArray,
    ENCRYPTION_KEY,
    logger,
} = require('./_utils');

module.exports = function(router) {

    /**
     * POST /paca/notifications/send-unpaid
     * 미납자 일괄 알림 발송 (특정 년/월).
     *
     * 응답 표면 (ADR-013 보존):
     *  - 200 정상            : {message, sent, failed}
     *  - 200 미납자 0명      : {message:'발송할 미납자가 없습니다.', sent:0, failed:0}
     *  - 200 유효 전화 0명   : {message:'유효한 전화번호가 있는 미납자가 없습니다.', sent:0, failed:N}
     *  - 400 검증 실패       : {error:'Validation Error'/'Configuration Error', message}
     *  - 500 서버 에러       : {error:'Server Error', message}
     */
    router.post('/send-unpaid', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const { year, month } = req.body;

            if (!year || !month) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '년도와 월을 지정해주세요.'
                });
            }

            // 설정 조회
            const [settings] = await pool.execute(
                'SELECT * FROM notification_settings WHERE academy_id = ?',
                [req.user.academyId]
            );

            if (settings.length === 0 || !settings[0].is_enabled) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '알림 설정을 먼저 완료하고 활성화해주세요.'
                });
            }

            const setting = settings[0];
            const serviceType = setting.service_type || 'sens';

            // 서비스 타입에 따라 Secret Key 복호화
            let decryptedSecret = null;
            let decryptedSolapiSecret = null;

            if (serviceType === 'solapi') {
                decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                if (!decryptedSolapiSecret) {
                    return res.status(400).json({
                        error: 'Configuration Error',
                        message: '솔라피 API Secret이 올바르지 않습니다.'
                    });
                }
            } else {
                decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                if (!decryptedSecret) {
                    return res.status(400).json({
                        error: 'Configuration Error',
                        message: 'API Secret Key가 올바르지 않습니다.'
                    });
                }
            }

            // 학원 정보 + 설정 조회 (납부일 포함)
            const [academy] = await pool.execute(
                `SELECT a.name, a.phone, COALESCE(s.tuition_due_day, 1) as tuition_due_day
                 FROM academies a
                 LEFT JOIN academy_settings s ON a.id = s.academy_id
                 WHERE a.id = ?`,
                [req.user.academyId]
            );

            // 납부일 문자열 생성
            const dueDay = academy[0]?.tuition_due_day || 1;
            const dueDayText = `${dueDay}일`;

            // 미납자 조회 (학부모 전화 또는 학생 전화가 있는 경우)
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const [unpaidPaymentsRaw] = await pool.execute(
                `SELECT
                    p.id AS payment_id,
                    p.final_amount AS amount,
                    p.due_date,
                    s.id AS student_id,
                    s.name AS student_name,
                    s.parent_phone,
                    s.phone AS student_phone
                FROM student_payments p
                JOIN students s ON p.student_id = s.id
                WHERE p.academy_id = ?
                    AND p.year_month = ?
                    AND p.payment_status IN ('pending', 'partial')
                    AND NOT (p.payment_type = 'season' AND p.due_date > CURDATE())
                    AND p.final_amount > 0
                    AND s.status = 'active'
                    AND (s.parent_phone IS NOT NULL OR s.phone IS NOT NULL)
                    AND s.deleted_at IS NULL`,
                [req.user.academyId, yearMonth]
            );

            // 복호화
            const unpaidPayments = decryptStudentArray(unpaidPaymentsRaw);

            if (unpaidPayments.length === 0) {
                return res.json({
                    message: '발송할 미납자가 없습니다.',
                    sent: 0,
                    failed: 0
                });
            }

            // 유효한 전화번호 필터링 (학부모 전화 우선, 없으면 학생 전화)
            const validRecipients = unpaidPayments
                .map(p => {
                    const phone = isValidPhoneNumber(p.parent_phone) ? p.parent_phone : p.student_phone;
                    return { ...p, effectivePhone: phone };
                })
                .filter(p => isValidPhoneNumber(p.effectivePhone));

            if (validRecipients.length === 0) {
                return res.json({
                    message: '유효한 전화번호가 있는 미납자가 없습니다.',
                    sent: 0,
                    failed: unpaidPayments.length
                });
            }

            // 서비스 타입에 따라 템플릿 선택
            const templateContent = serviceType === 'solapi'
                ? (setting.solapi_template_content || setting.template_content)
                : setting.template_content;
            const templateCode = serviceType === 'solapi'
                ? setting.solapi_template_id
                : setting.template_code;

            // 메시지 준비
            const recipients = validRecipients.map(p => {
                const msg = createUnpaidNotificationMessage(
                    {
                        month: month.toString(),
                        amount: p.amount,
                        due_date: dueDayText
                    },
                    { name: p.student_name },
                    { name: academy[0]?.name || '', phone: academy[0]?.phone || '' },
                    templateContent
                );

                return {
                    phone: p.effectivePhone,
                    content: msg.content,
                    variables: msg.variables,
                    studentId: p.student_id,
                    paymentId: p.payment_id,
                    studentName: p.student_name
                };
            });

            // 알림톡 발송 (배치로 처리, 최대 100명씩)
            const batchSize = 100;
            let sentCount = 0;
            let failedCount = 0;

            for (let i = 0; i < recipients.length; i += batchSize) {
                const batch = recipients.slice(i, i + batchSize);

                let result;
                if (serviceType === 'solapi') {
                    // 솔라피 발송 (보안 헬퍼 시그니처 보존, ADR-007)
                    result = await sendAlimtalkSolapi(
                        {
                            solapi_api_key: setting.solapi_api_key,
                            solapi_api_secret: decryptedSolapiSecret,
                            solapi_pfid: setting.solapi_pfid,
                            solapi_sender_phone: setting.solapi_sender_phone
                        },
                        templateCode,
                        batch
                    );
                } else {
                    // SENS 발송 (보안 헬퍼 시그니처 보존, ADR-007)
                    result = await sendAlimtalk(
                        {
                            naver_access_key: setting.naver_access_key,
                            naver_secret_key: decryptedSecret,
                            naver_service_id: setting.naver_service_id,
                            kakao_channel_id: setting.kakao_channel_id
                        },
                        templateCode,
                        batch
                    );
                }

                // 로그 기록
                for (const recipient of batch) {
                    await pool.execute(
                        `INSERT INTO notification_logs
                        (academy_id, student_id, payment_id, recipient_name, recipient_phone,
                         message_type, template_code, message_content, status, request_id,
                         error_message, sent_at)
                        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                        [
                            req.user.academyId,
                            recipient.studentId,
                            recipient.paymentId,
                            recipient.studentName,
                            recipient.phone,
                            'alimtalk',
                            templateCode,
                            recipient.content,
                            result.success ? 'sent' : 'failed',
                            result.requestId || result.groupId || null,
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

            res.json({
                message: `알림 발송 완료 (${serviceType === 'solapi' ? '솔라피' : 'SENS'}): ${sentCount}명 성공, ${failedCount}명 실패`,
                sent: sentCount,
                failed: failedCount
            });
        } catch (error) {
            logger.error('일괄 발송 오류:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '알림 발송에 실패했습니다.'
            });
        }
    });

    /**
     * POST /paca/notifications/send-individual
     * 단일 학원비 ID 에 대한 개별 발송.
     *
     * 응답 표면 (ADR-013 보존):
     *  - 200 정상            : {message, success:true, requestId}
     *  - 400 발송 실패       : {error:'Send Failed', message}
     *  - 400 검증/설정 실패  : {error:'Validation Error'/'Configuration Error', message}
     *  - 404 학원비 없음     : {error:'Not Found', message}
     *  - 500 서버 에러       : {error:'Server Error', message}
     */
    router.post('/send-individual', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const { payment_id } = req.body;

            if (!payment_id) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'payment_id가 필요합니다.'
                });
            }

            // 설정 조회
            const [settings] = await pool.execute(
                'SELECT * FROM notification_settings WHERE academy_id = ?',
                [req.user.academyId]
            );

            if (settings.length === 0 || !settings[0].is_enabled) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '알림 설정을 먼저 완료하고 활성화해주세요.'
                });
            }

            const setting = settings[0];
            const serviceType = setting.service_type || 'sens';

            // 학원비 및 학생 정보 조회
            const [paymentsRaw] = await pool.execute(
                `SELECT
                    p.id AS payment_id,
                    p.final_amount AS amount,
                    p.year_month,
                    p.due_date,
                    s.id AS student_id,
                    s.name AS student_name,
                    s.parent_phone,
                    s.phone AS student_phone
                FROM student_payments p
                JOIN students s ON p.student_id = s.id
                WHERE p.id = ? AND p.academy_id = ?`,
                [payment_id, req.user.academyId]
            );

            // 복호화
            const payments = decryptStudentArray(paymentsRaw);

            if (payments.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '해당 학원비 정보를 찾을 수 없습니다.'
                });
            }

            const payment = payments[0];

            // 학부모 전화 우선, 없으면 학생 전화 사용
            const effectivePhone = isValidPhoneNumber(payment.parent_phone)
                ? payment.parent_phone
                : payment.student_phone;

            if (!isValidPhoneNumber(effectivePhone)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '학부모 또는 학생의 유효한 전화번호가 없습니다.'
                });
            }

            // 학원 정보 + 설정 조회 (납부일 포함)
            const [academy] = await pool.execute(
                `SELECT a.name, a.phone, COALESCE(s.tuition_due_day, 1) as tuition_due_day
                 FROM academies a
                 LEFT JOIN academy_settings s ON a.id = s.academy_id
                 WHERE a.id = ?`,
                [req.user.academyId]
            );

            // 납부일 문자열 생성
            const dueDay = academy[0]?.tuition_due_day || 1;
            const dueDayText = `${dueDay}일`;

            // 서비스 타입에 따라 템플릿 선택
            const templateContent = serviceType === 'solapi'
                ? (setting.solapi_template_content || setting.template_content)
                : setting.template_content;
            const templateCode = serviceType === 'solapi'
                ? setting.solapi_template_id
                : setting.template_code;

            // 메시지 생성 (year_month에서 월 추출: "2025-12" -> "12")
            const monthFromYearMonth = payment.year_month ? payment.year_month.split('-')[1] : '';
            const msg = createUnpaidNotificationMessage(
                {
                    month: monthFromYearMonth,
                    amount: payment.amount,
                    due_date: dueDayText
                },
                { name: payment.student_name },
                { name: academy[0]?.name || '', phone: academy[0]?.phone || '' },
                templateContent
            );

            // 서비스 타입에 따라 발송 (보안 헬퍼 시그니처 보존, ADR-007)
            let result;
            if (serviceType === 'solapi') {
                const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                result = await sendAlimtalkSolapi(
                    {
                        solapi_api_key: setting.solapi_api_key,
                        solapi_api_secret: decryptedSolapiSecret,
                        solapi_pfid: setting.solapi_pfid,
                        solapi_sender_phone: setting.solapi_sender_phone
                    },
                    templateCode,
                    [{ phone: effectivePhone, content: msg.content }]
                );
            } else {
                const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                result = await sendAlimtalk(
                    {
                        naver_access_key: setting.naver_access_key,
                        naver_secret_key: decryptedSecret,
                        naver_service_id: setting.naver_service_id,
                        kakao_channel_id: setting.kakao_channel_id
                    },
                    templateCode,
                    [{
                        phone: effectivePhone,
                        content: msg.content,
                        variables: msg.variables
                    }]
                );
            }

            // 로그 기록
            await pool.execute(
                `INSERT INTO notification_logs
                (academy_id, student_id, payment_id, recipient_name, recipient_phone,
                 message_type, template_code, message_content, status, request_id,
                 error_message, sent_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    req.user.academyId,
                    payment.student_id,
                    payment.payment_id,
                    payment.student_name,
                    effectivePhone,
                    'alimtalk',
                    templateCode,
                    msg.content,
                    result.success ? 'sent' : 'failed',
                    result.requestId || result.groupId || null,
                    result.success ? null : (result.error || 'Unknown error')
                ]
            );

            if (result.success) {
                res.json({
                    message: `${payment.student_name} 학생에게 알림이 발송되었습니다.`,
                    success: true,
                    requestId: result.requestId
                });
            } else {
                res.status(400).json({
                    error: 'Send Failed',
                    message: '알림 발송에 실패했습니다: ' + (result.error || '알 수 없는 오류')
                });
            }
        } catch (error) {
            logger.error('개별 발송 오류:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '알림 발송에 실패했습니다.'
            });
        }
    });

};
