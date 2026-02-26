const {
    db, verifyToken, checkPermission, decryptApiKey, sendAlimtalk, sendAlimtalkSolapi,
    createUnpaidNotificationMessage, isValidPhoneNumber, decrypt, logger,
    decryptStudentInfo, decryptStudentArray, ENCRYPTION_KEY
} = require('./_utils');

module.exports = function(router) {

/**
 * POST /paca/notifications/send-unpaid
 * 미납자 일괄 알림 발송
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
        const [settings] = await db.query(
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
        const [academy] = await db.query(
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
        const [unpaidPaymentsRaw] = await db.query(
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
                // 학부모 전화 우선, 없으면 학생 전화 사용
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
                    due_date: dueDayText  // 학원 설정의 납부일 사용
                },
                { name: p.student_name },
                { name: academy[0]?.name || '', phone: academy[0]?.phone || '' },
                templateContent
            );

            return {
                phone: p.effectivePhone,  // 학부모 또는 학생 전화
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
                // 솔라피 발송
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
                // SENS 발송
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
                await db.query(
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
 * 개별 학생 알림 발송
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
        const [settings] = await db.query(
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
        const [paymentsRaw] = await db.query(
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
        const [academy] = await db.query(
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
                due_date: dueDayText  // 학원 설정의 납부일 사용
            },
            { name: payment.student_name },
            { name: academy[0]?.name || '', phone: academy[0]?.phone || '' },
            templateContent
        );

        // 서비스 타입에 따라 발송
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
        await db.query(
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

/**
 * POST /paca/notifications/send-unpaid-today-auto
 * 솔라피 자동발송 - 현재 시간에 발송 설정된 모든 학원 처리 (n8n 매시간 호출)
 * Access: n8n service account (X-API-Key 인증)
 */
router.post('/send-unpaid-today-auto', verifyToken, async (req, res) => {
    try {
        // 현재 시간 (한국 시간)
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentHour = koreaTime.getHours();
        const dayOfWeek = koreaTime.getDay();
        const year = koreaTime.getFullYear();
        const month = koreaTime.getMonth() + 1;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const dayNames = ['일','월','화','수','목','금','토'];

        // 현재 시간에 발송 설정된 학원들 조회
        const [academySettings] = await db.query(
            `SELECT ns.*, a.name as academy_name, a.phone as academy_phone,
                    COALESCE(ast.tuition_due_day, 1) as tuition_due_day
             FROM notification_settings ns
             JOIN academies a ON ns.academy_id = a.id
             LEFT JOIN academy_settings ast ON ns.academy_id = ast.academy_id
             WHERE ns.service_type = 'solapi'
             AND ns.solapi_enabled = 1
             AND ns.solapi_auto_enabled = 1
             AND ns.solapi_auto_hour = ?`,
            [currentHour]
        );

        if (academySettings.length === 0) {
            return res.json({
                message: `${currentHour}시에 발송 설정된 학원이 없습니다.`,
                current_hour: currentHour,
                academies_processed: 0
            });
        }

        const results = [];

        // 각 학원별로 처리
        for (const setting of academySettings) {
            const academyId = setting.academy_id;
            const academyResult = {
                academy_id: academyId,
                academy_name: setting.academy_name,
                sent: 0,
                failed: 0,
                skipped: false,
                error: null
            };

            try {
                // 솔라피 Secret 복호화
                const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                if (!decryptedSolapiSecret) {
                    academyResult.skipped = true;
                    academyResult.error = '솔라피 API Secret 복호화 실패';
                    results.push(academyResult);
                    continue;
                }

                // 오늘 수업이 있는 미납자 조회
                const [unpaidPaymentsRaw] = await db.query(
                    `SELECT
                        p.id AS payment_id,
                        p.final_amount AS amount,
                        p.due_date,
                        p.year_month,
                        s.id AS student_id,
                        s.name AS student_name,
                        s.parent_phone,
                        s.phone AS student_phone,
                        s.class_days
                    FROM student_payments p
                    JOIN students s ON p.student_id = s.id
                    WHERE p.academy_id = ?
                    AND p.payment_status IN ('pending', 'partial')
                    AND p.final_amount > 0
                    AND p.year_month = ?
                    AND s.status = 'active'
                    AND s.deleted_at IS NULL
                    AND (
                        JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                        OR JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                    )
                    AND (s.parent_phone IS NOT NULL OR s.phone IS NOT NULL)
                    ORDER BY s.name ASC`,
                    [academyId, yearMonth, JSON.stringify(dayOfWeek), JSON.stringify({day: dayOfWeek})]
                );

                // 복호화
                const unpaidPayments = decryptStudentArray(unpaidPaymentsRaw);

                if (unpaidPayments.length === 0) {
                    academyResult.skipped = true;
                    academyResult.error = '오늘 수업 있는 미납자 없음';
                    results.push(academyResult);
                    continue;
                }

                const dueDay = setting.tuition_due_day || 1;
                const dueDayText = `${dueDay}일`;

                // 유효한 전화번호 필터링 + 방어적 체크 (payment_id 필수)
                const validRecipients = unpaidPayments
                    .filter(p => {
                        // 방어적 체크: payment_id가 없으면 제외
                        if (!p.payment_id) {
                            logger.warn(`[솔라피 자동발송] 학생 ${p.student_id} 제외: payment_id 없음`);
                            return false;
                        }
                        return true;
                    })
                    .map(p => {
                        const phone = isValidPhoneNumber(p.parent_phone) ? p.parent_phone : p.student_phone;
                        return { ...p, effectivePhone: phone };
                    })
                    .filter(p => isValidPhoneNumber(p.effectivePhone));

                if (validRecipients.length === 0) {
                    academyResult.skipped = true;
                    academyResult.error = '유효한 전화번호 없음';
                    results.push(academyResult);
                    continue;
                }

                // 디버깅: 최종 발송 대상 로깅
                logger.info(`[솔라피 자동발송] ${setting.academy_name}: 발송 대상 ${validRecipients.length}명 - ${validRecipients.map(p => `${p.student_id}(pid:${p.payment_id})`).join(', ')}`);


                // 이번 달에 이미 알림을 받은 학생 조회 (첫 수업일 vs 두 번째 수업일 구분)
                const studentIds = validRecipients.map(p => p.student_id);
                const [existingLogs] = await db.query(
                    `SELECT DISTINCT student_id FROM notification_logs
                     WHERE academy_id = ? AND student_id IN (?)
                     AND YEAR(sent_at) = ? AND MONTH(sent_at) = ?
                     AND status = 'sent'`,
                    [academyId, studentIds, year, month]
                );
                const studentsWithPriorNotification = new Set(existingLogs.map(l => l.student_id));

                // 첫 수업일 (납부 안내) vs 두 번째 수업일 이후 (미납자) 분류
                const firstTimeRecipients = validRecipients.filter(p => !studentsWithPriorNotification.has(p.student_id));
                const repeatRecipients = validRecipients.filter(p => studentsWithPriorNotification.has(p.student_id));

                // 납부 안내 템플릿 (첫 수업일)
                const noticeTemplateContent = setting.solapi_template_content || setting.template_content;
                const noticeTemplateCode = setting.solapi_template_id;

                // 미납자 템플릿 (두 번째 수업일 이후)
                const overdueTemplateContent = setting.solapi_overdue_template_content || noticeTemplateContent;
                const overdueTemplateCode = setting.solapi_overdue_template_id || noticeTemplateCode;

                // 발송 함수
                const sendAndLog = async (recipients, templateCode, templateContent, templateType) => {
                    if (recipients.length === 0) return;

                    const messages = recipients.map(p => {
                        const monthFromYearMonth = p.year_month ? p.year_month.split('-')[1] : month.toString();
                        const msg = createUnpaidNotificationMessage(
                            {
                                month: monthFromYearMonth,
                                amount: p.amount,
                                due_date: dueDayText
                            },
                            { name: p.student_name },
                            { name: setting.academy_name || '', phone: setting.academy_phone || '' },
                            templateContent
                        );

                        return {
                            phone: p.effectivePhone,
                            content: msg.content,
                            studentId: p.student_id,
                            paymentId: p.payment_id,
                            studentName: p.student_name
                        };
                    });

                    const result = await sendAlimtalkSolapi(
                        {
                            solapi_api_key: setting.solapi_api_key,
                            solapi_api_secret: decryptedSolapiSecret,
                            solapi_pfid: setting.solapi_pfid,
                            solapi_sender_phone: setting.solapi_sender_phone
                        },
                        templateCode,
                        messages
                    );

                    // 로그 기록
                    for (const recipient of messages) {
                        await db.query(
                            `INSERT INTO notification_logs
                            (academy_id, student_id, payment_id, recipient_name, recipient_phone,
                             message_type, template_code, message_content, status, request_id,
                             error_message, sent_at)
                            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                            [
                                academyId,
                                recipient.studentId,
                                recipient.paymentId,
                                recipient.studentName,
                                recipient.phone,
                                'alimtalk',
                                templateCode,
                                recipient.content,
                                result.success ? 'sent' : 'failed',
                                result.groupId || null,
                                result.success ? null : (result.error || 'Unknown error')
                            ]
                        );

                        if (result.success) {
                            academyResult.sent++;
                        } else {
                            academyResult.failed++;
                        }
                    }
                };

                // 납부 안내 알림톡 발송 (첫 수업일)
                if (firstTimeRecipients.length > 0 && noticeTemplateCode) {
                    await sendAndLog(firstTimeRecipients, noticeTemplateCode, noticeTemplateContent, '납부안내');
                }

                // 미납자 알림톡 발송 (두 번째 수업일 이후) - solapi_overdue_auto_enabled 체크
                if (repeatRecipients.length > 0 && overdueTemplateCode && setting.solapi_overdue_auto_enabled) {
                    await sendAndLog(repeatRecipients, overdueTemplateCode, overdueTemplateContent, '미납자');
                }

            } catch (academyError) {
                academyResult.error = academyError.message;
                academyResult.failed = 1;
            }

            results.push(academyResult);
        }

        const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

        res.json({
            message: `${currentHour}시 솔라피 자동발송 완료 (${dayNames[dayOfWeek]}요일)`,
            date: koreaTime.toISOString().split('T')[0],
            current_hour: currentHour,
            day_name: dayNames[dayOfWeek],
            academies_processed: academySettings.length,
            total_sent: totalSent,
            total_failed: totalFailed,
            results: results
        });
    } catch (error) {
        logger.error('솔라피 자동발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '자동발송 처리에 실패했습니다.',
            details: error.message
        });
    }
});

/**
 * POST /paca/notifications/send-trial-today-auto
 * 체험수업 자동발송 - 현재 시간에 발송 설정된 모든 학원 처리 (n8n 매시간 호출)
 * Access: n8n service account (X-API-Key 인증)
 */
router.post('/send-trial-today-auto', verifyToken, async (req, res) => {
    try {
        // 현재 시간 (한국 시간)
        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentHour = koreaTime.getHours();
        const todayStr = koreaTime.toISOString().split('T')[0]; // YYYY-MM-DD
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        logger.info(`[체험수업 자동발송] ${todayStr} ${currentHour}시 시작`);

        // 현재 시간에 발송 설정된 학원들 조회
        const [academySettings] = await db.query(
            `SELECT ns.*, a.name as academy_name, a.phone as academy_phone
             FROM notification_settings ns
             JOIN academies a ON ns.academy_id = a.id
             WHERE ns.service_type = 'solapi'
             AND ns.solapi_enabled = 1
             AND ns.solapi_trial_auto_enabled = 1
             AND ns.solapi_trial_auto_hour = ?`,
            [currentHour]
        );

        if (academySettings.length === 0) {
            return res.json({
                message: `${currentHour}시에 체험수업 발송 설정된 학원이 없습니다.`,
                current_hour: currentHour,
                academies_processed: 0
            });
        }

        const results = [];

        // 각 학원별로 처리
        for (const setting of academySettings) {
            const academyId = setting.academy_id;
            const academyResult = {
                academy_id: academyId,
                academy_name: setting.academy_name,
                sent: 0,
                failed: 0,
                skipped: false,
                error: null,
                students: []
            };

            try {
                // 솔라피 Secret 복호화
                const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                if (!decryptedSolapiSecret) {
                    academyResult.skipped = true;
                    academyResult.error = '솔라피 API Secret 복호화 실패';
                    results.push(academyResult);
                    continue;
                }

                // 템플릿 확인
                if (!setting.solapi_trial_template_id) {
                    academyResult.skipped = true;
                    academyResult.error = '체험수업 템플릿 ID 미설정';
                    results.push(academyResult);
                    continue;
                }

                // 오늘 체험수업이 있는 체험생 조회
                // trial_dates는 JSON 객체 배열 (예: [{date: "2025-12-17", time_slot: "evening", attended: true}])
                const [trialStudentsRaw] = await db.query(
                    `SELECT
                        s.id AS student_id,
                        s.name,
                        s.phone,
                        s.parent_phone,
                        s.trial_dates,
                        s.trial_remaining
                    FROM students s
                    WHERE s.academy_id = ?
                    AND s.status = 'trial'
                    AND s.deleted_at IS NULL
                    AND JSON_SEARCH(COALESCE(s.trial_dates, '[]'), 'one', ?, NULL, '$[*].date') IS NOT NULL
                    AND (s.parent_phone IS NOT NULL OR s.phone IS NOT NULL)`,
                    [academyId, todayStr]
                );

                // 복호화
                const trialStudents = decryptStudentArray(trialStudentsRaw);

                if (trialStudents.length === 0) {
                    academyResult.skipped = true;
                    academyResult.error = '오늘 체험수업 있는 학생 없음';
                    results.push(academyResult);
                    continue;
                }

                // 유효한 전화번호 필터링
                const validRecipients = trialStudents
                    .map(s => {
                        const phone = isValidPhoneNumber(s.parent_phone) ? s.parent_phone : s.phone;
                        return { ...s, effectivePhone: phone };
                    })
                    .filter(s => isValidPhoneNumber(s.effectivePhone));

                if (validRecipients.length === 0) {
                    academyResult.skipped = true;
                    academyResult.error = '유효한 전화번호 없음';
                    results.push(academyResult);
                    continue;
                }

                // 메시지 준비 (학원별 템플릿 사용)
                const templateContent = setting.solapi_trial_template_content || '';
                const templateCode = setting.solapi_trial_template_id;

                // 버튼 설정 파싱
                let buttons = null;
                if (setting.solapi_trial_buttons) {
                    try {
                        buttons = JSON.parse(setting.solapi_trial_buttons);
                    } catch (e) {
                        logger.error('버튼 설정 파싱 오류:', e);
                    }
                }

                // 이미지 URL
                const imageUrl = setting.solapi_trial_image_url || null;

                const recipients = validRecipients.map(s => {
                    // 체험일정 문자열 생성
                    let scheduleText = '';
                    try {
                        // trial_dates가 이미 객체(배열)인 경우와 문자열인 경우 모두 처리
                        let trialDates = s.trial_dates;
                        if (typeof trialDates === 'string') {
                            trialDates = JSON.parse(trialDates);
                        }
                        if (!Array.isArray(trialDates)) {
                            trialDates = [];
                        }

                        scheduleText = trialDates.map((item, idx) => {
                            // 객체 형태: {date: "2026-01-07", time_slot: "evening", attended: true}
                            const dateStr = typeof item === 'object' ? item.date : item;
                            const isCompleted = typeof item === 'object' ? item.attended : false;
                            const d = new Date(dateStr);
                            const m = d.getMonth() + 1;
                            const day = d.getDate();
                            const dayName = dayNames[d.getDay()];
                            const prefix = isCompleted ? '✓ ' : '';
                            return `${prefix}${idx + 1}회차: ${m}/${day}(${dayName})`;
                        }).join('\n');
                    } catch (e) {
                        logger.error('[체험수업 자동발송] trial_dates 파싱 오류:', e.message, s.trial_dates);
                        scheduleText = '체험일정 정보 없음';
                    }

                    // 템플릿 변수 치환
                    let content = templateContent;
                    content = content
                        .replace(/#{이름}/g, s.name)
                        .replace(/#{학원명}/g, setting.academy_name || '학원')
                        .replace(/#{체험일정}/g, scheduleText);

                    return {
                        phone: s.effectivePhone,
                        content,
                        buttons,
                        imageUrl,
                        studentId: s.student_id,
                        studentName: s.name
                    };
                });

                // 솔라피 알림톡 발송 (학원별 API 키 사용)
                const result = await sendAlimtalkSolapi(
                    {
                        solapi_api_key: setting.solapi_api_key,
                        solapi_api_secret: decryptedSolapiSecret,
                        solapi_pfid: setting.solapi_pfid,
                        solapi_sender_phone: setting.solapi_sender_phone
                    },
                    templateCode,
                    recipients
                );

                // 로그 기록
                for (const recipient of recipients) {
                    await db.query(
                        `INSERT INTO notification_logs
                        (academy_id, student_id, recipient_name, recipient_phone,
                         message_type, template_code, message_content, status, request_id,
                         error_message, sent_at)
                        VALUES (?, ?, ?, ?, 'alimtalk', ?, ?, ?, ?, ?, NOW())`,
                        [
                            academyId,
                            recipient.studentId,
                            recipient.studentName,
                            recipient.phone,
                            templateCode,
                            recipient.content,
                            result.success ? 'sent' : 'failed',
                            result.groupId || null,
                            result.success ? null : (result.error || 'Unknown error')
                        ]
                    );

                    academyResult.students.push(recipient.studentName);

                    if (result.success) {
                        academyResult.sent++;
                    } else {
                        academyResult.failed++;
                    }
                }

                if (!result.success) {
                    academyResult.error = result.error;
                }

            } catch (academyError) {
                academyResult.error = academyError.message;
                academyResult.failed = 1;
            }

            results.push(academyResult);
        }

        const totalSent = results.reduce((sum, r) => sum + r.sent, 0);
        const totalFailed = results.reduce((sum, r) => sum + r.failed, 0);

        logger.info(`[체험수업 자동발송] 완료 - ${totalSent}명 성공, ${totalFailed}명 실패`);

        res.json({
            message: `${currentHour}시 체험수업 자동발송 완료`,
            date: todayStr,
            current_hour: currentHour,
            academies_processed: academySettings.length,
            total_sent: totalSent,
            total_failed: totalFailed,
            results: results
        });
    } catch (error) {
        logger.error('체험수업 자동발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '자동발송 처리에 실패했습니다.',
            details: error.message
        });
    }
});

// =====================================================
// SENS 자동발송 API (n8n 워크플로우에서 호출)
// =====================================================

/**
 * POST /paca/notifications/send-unpaid-today-auto-sens
 * SENS 납부안내/미납자 자동발송 (수업 있는 날 기준)
 * n8n 워크플로우에서 매시간 호출
 */
router.post('/send-unpaid-today-auto-sens', async (req, res) => {
    try {
        // API Key 검증
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== 'paca-n8n-api-key-2024') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
        const currentHour = koreaTime.getHours();
        const dayOfWeek = koreaTime.getDay(); // 0=일, 1=월, ...
        const year = koreaTime.getFullYear();
        const month = koreaTime.getMonth() + 1;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

        logger.info(`[SENS 자동발송] 시작 - ${koreaTime.toISOString()}, 현재 시간: ${currentHour}시, 오늘: ${dayNames[dayOfWeek]}요일`);

        // 현재 시간에 발송 설정된 학원들 조회
        const [academySettings] = await db.query(
            `SELECT ns.*, a.name as academy_name, a.phone as academy_phone
             FROM notification_settings ns
             JOIN academies a ON ns.academy_id = a.id
             WHERE ns.service_type = 'sens'
             AND ns.is_enabled = 1
             AND ns.sens_auto_enabled = 1
             AND ns.sens_auto_hour = ?`,
            [currentHour]
        );

        logger.info(`[SENS 자동발송] 발송 대상 학원 수: ${academySettings.length}`);

        const results = [];

        for (const setting of academySettings) {
            try {
                // SENS 설정 확인
                if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                    logger.info(`[SENS 자동발송] ${setting.academy_name}: SENS 설정 미완료`);
                    continue;
                }

                // Secret 복호화
                const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                if (!decryptedSecret) {
                    logger.info(`[SENS 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                    continue;
                }

                // 오늘 수업이 있는 미납 학생 조회
                const [unpaidStudentsRaw] = await db.query(
                    `SELECT DISTINCT s.id, s.name, s.phone, s.parent_phone, s.class_days,
                            p.id as payment_id, p.final_amount as amount, p.year_month,
                            (SELECT COUNT(*) FROM notification_logs nl
                             WHERE nl.payment_id = p.id AND nl.status = 'sent') as sent_count
                     FROM students s
                     JOIN student_payments p ON s.id = p.student_id
                     WHERE s.academy_id = ?
                       AND s.status = 'active'
                       AND s.deleted_at IS NULL
                       AND p.payment_status IN ('pending', 'partial')
                       AND p.final_amount > 0
                       AND p.year_month = ?
                       AND (
                           JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                           OR JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                       )
                       AND (s.parent_phone IS NOT NULL OR s.phone IS NOT NULL)
                     ORDER BY s.name`,
                    [setting.academy_id, yearMonth, JSON.stringify(dayOfWeek), JSON.stringify({day: dayOfWeek})]
                );

                // 복호화 + 방어적 필터링 (payment_id 필수)
                const unpaidStudents = decryptStudentArray(unpaidStudentsRaw)
                    .filter(student => {
                        if (!student.payment_id) {
                            logger.warn(`[SENS 자동발송] 학생 ${student.id} 제외: payment_id 없음`);
                            return false;
                        }
                        return true;
                    });

                logger.info(`[SENS 자동발송] ${setting.academy_name}: 오늘 수업 있는 미납자 ${unpaidStudents.length}명 - ${unpaidStudents.map(s => `${s.id}(pid:${s.payment_id})`).join(', ')}`);

                let sentCount = 0;
                let failCount = 0;

                for (const student of unpaidStudents) {
                    // 이미 decryptStudentArray로 복호화됨
                    const studentName = student.name || '';
                    const studentPhone = student.phone || '';
                    const parentPhone = student.parent_phone || '';

                    // 전화번호 우선순위: 학부모 > 학생
                    const recipientPhone = isValidPhoneNumber(parentPhone) ? parentPhone : studentPhone;
                    if (!recipientPhone || !isValidPhoneNumber(recipientPhone)) {
                        logger.info(`[SENS 자동발송] ${studentName}: 유효한 전화번호 없음`);
                        continue;
                    }

                    // 첫 발송인지 재발송인지 판단
                    const isFirstSend = student.sent_count === 0;

                    // 템플릿 선택
                    let templateCode, templateContent, templateButtons;
                    if (isFirstSend) {
                        // 첫 발송: 납부 안내 템플릿
                        templateCode = setting.template_code;
                        templateContent = setting.template_content;
                        templateButtons = setting.sens_buttons;
                    } else {
                        // 재발송: 미납자 템플릿 (활성화된 경우에만)
                        if (!setting.sens_overdue_auto_enabled) {
                            continue;
                        }
                        templateCode = setting.sens_overdue_template_code;
                        templateContent = setting.sens_overdue_template_content;
                        templateButtons = setting.sens_overdue_buttons;
                    }

                    if (!templateCode) {
                        continue;
                    }

                    // 변수 치환
                    const monthFromYearMonth = student.year_month ? student.year_month.split('-')[1].replace(/^0/, '') : String(month);
                    const dateStr = `${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;
                    let content = templateContent || '';
                    content = content
                        .replace(/#{이름}/g, studentName)
                        .replace(/#{월}/g, monthFromYearMonth)
                        .replace(/#{교육비}/g, Math.floor(Number(student.amount)).toLocaleString())
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{학원명}/g, setting.academy_name)
                        .replace(/#{학원전화}/g, setting.academy_phone || '');

                    // 버튼 파싱
                    let buttons = null;
                    if (templateButtons) {
                        try {
                            buttons = typeof templateButtons === 'string'
                                ? JSON.parse(templateButtons)
                                : templateButtons;
                        } catch (e) {}
                    }

                    // SENS 알림톡 발송
                    const result = await sendAlimtalk(
                        {
                            naver_access_key: setting.naver_access_key,
                            naver_secret_key: decryptedSecret,
                            naver_service_id: setting.naver_service_id,
                            kakao_channel_id: setting.kakao_channel_id
                        },
                        templateCode,
                        [{ phone: recipientPhone, content, buttons }]
                    );

                    if (result.success) {
                        sentCount++;
                        // 로그 기록
                        await db.query(
                            `INSERT INTO notification_logs
                             (academy_id, student_id, payment_id, recipient_name, recipient_phone,
                              message_type, template_code, message_content, status, request_id, sent_at)
                             VALUES (?, ?, ?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                            [setting.academy_id, student.id, student.payment_id,
                             studentName, recipientPhone, templateCode, content, result.requestId]
                        );
                    } else {
                        failCount++;
                    }
                }

                results.push({
                    academy: setting.academy_name,
                    sent: sentCount,
                    failed: failCount
                });

            } catch (academyError) {
                logger.error(`[SENS 자동발송] ${setting.academy_name} 오류:`, academyError);
            }
        }

        res.json({
            message: 'SENS 자동발송 완료',
            results
        });

    } catch (error) {
        logger.error('[SENS 자동발송] 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'SENS 자동발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/send-trial-today-auto-sens
 * SENS 체험수업 자동발송 (수업 있는 날 기준)
 * n8n 워크플로우에서 매시간 호출
 */
router.post('/send-trial-today-auto-sens', async (req, res) => {
    try {
        // API Key 검증
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== 'paca-n8n-api-key-2024') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const now = new Date();
        const currentHour = now.getHours();
        const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

        logger.info(`[SENS 체험수업 자동발송] 시작 - ${now.toISOString()}, 현재 시간: ${currentHour}시`);

        // 현재 시간에 발송 설정된 학원들 조회
        const [academySettings] = await db.query(
            `SELECT ns.*, a.name as academy_name
             FROM notification_settings ns
             JOIN academies a ON ns.academy_id = a.id
             WHERE ns.service_type = 'sens'
             AND ns.is_enabled = 1
             AND ns.sens_trial_auto_enabled = 1
             AND ns.sens_trial_auto_hour = ?`,
            [currentHour]
        );

        logger.info(`[SENS 체험수업 자동발송] 발송 대상 학원 수: ${academySettings.length}`);

        const results = [];

        for (const setting of academySettings) {
            try {
                // SENS 설정 확인
                if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                    continue;
                }

                if (!setting.sens_trial_template_code) {
                    continue;
                }

                // Secret 복호화
                const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                if (!decryptedSecret) continue;

                // 오늘 체험수업이 있는 학생 조회
                const [trialStudents] = await db.query(
                    `SELECT s.id, s.name, s.phone, s.parent_phone, s.trial_dates
                     FROM students s
                     WHERE s.academy_id = ?
                       AND s.status = 'trial'
                       AND s.trial_dates IS NOT NULL
                       AND JSON_SEARCH(s.trial_dates, 'one', ?, NULL, '$[*].date') IS NOT NULL`,
                    [setting.academy_id, todayStr]
                );

                logger.info(`[SENS 체험수업 자동발송] ${setting.academy_name}: 오늘 체험 ${trialStudents.length}명`);

                let sentCount = 0;
                let failCount = 0;

                for (const student of trialStudents) {
                    // 복호화
                    const studentName = student.name ? decryptField(student.name, ENCRYPTION_KEY) : '';
                    const parentPhone = student.parent_phone ? decryptField(student.parent_phone, ENCRYPTION_KEY) : '';
                    const studentPhone = student.phone ? decryptField(student.phone, ENCRYPTION_KEY) : '';

                    const recipientPhone = parentPhone || studentPhone;
                    if (!recipientPhone || !isValidPhoneNumber(recipientPhone)) continue;

                    // 체험일정 문자열 생성
                    let trialSchedule = '';
                    if (student.trial_dates) {
                        try {
                            const dates = JSON.parse(student.trial_dates);
                            trialSchedule = dates.map((date, idx) => {
                                const d = new Date(date);
                                const dayStr = ['일', '월', '화', '수', '목', '금', '토'][d.getDay()];
                                const isToday = date === todayStr;
                                return `${isToday ? '✓ ' : ''}${idx + 1}회차: ${d.getMonth() + 1}/${d.getDate()}(${dayStr})`;
                            }).join('\n');
                        } catch (e) {}
                    }

                    // 변수 치환
                    let content = setting.sens_trial_template_content || '';
                    content = content
                        .replace(/#{이름}/g, studentName)
                        .replace(/#{학원명}/g, setting.academy_name)
                        .replace(/#{체험일정}/g, trialSchedule);

                    // 버튼 파싱
                    let buttons = null;
                    if (setting.sens_trial_buttons) {
                        try {
                            buttons = typeof setting.sens_trial_buttons === 'string'
                                ? JSON.parse(setting.sens_trial_buttons)
                                : setting.sens_trial_buttons;
                        } catch (e) {}
                    }

                    // SENS 알림톡 발송
                    const result = await sendAlimtalk(
                        {
                            naver_access_key: setting.naver_access_key,
                            naver_secret_key: decryptedSecret,
                            naver_service_id: setting.naver_service_id,
                            kakao_channel_id: setting.kakao_channel_id
                        },
                        setting.sens_trial_template_code,
                        [{ phone: recipientPhone, content, buttons }]
                    );

                    if (result.success) {
                        sentCount++;
                        // 로그 기록
                        await db.query(
                            `INSERT INTO notification_logs
                             (academy_id, student_id, recipient_name, recipient_phone,
                              message_type, template_code, message_content, status, request_id, sent_at)
                             VALUES (?, ?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                            [setting.academy_id, student.id, studentName, recipientPhone,
                             setting.sens_trial_template_code, content, result.requestId]
                        );
                    } else {
                        failCount++;
                    }
                }

                results.push({
                    academy: setting.academy_name,
                    sent: sentCount,
                    failed: failCount
                });

            } catch (academyError) {
                logger.error(`[SENS 체험수업 자동발송] ${setting.academy_name} 오류:`, academyError);
            }
        }

        res.json({
            message: 'SENS 체험수업 자동발송 완료',
            results
        });

    } catch (error) {
        logger.error('[SENS 체험수업 자동발송] 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'SENS 체험수업 자동발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/send-reminder-auto
 * 솔라피 상담 리마인드 자동발송 (n8n용)
 */
router.post('/send-reminder-auto', async (req, res) => {
    try {
        // API Key 검증
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== 'paca-n8n-api-key-2024') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

        logger.info(`[Solapi 리마인드 자동발송] 시작 - ${koreaTime.toISOString()}`);

        // 리마인드 자동발송이 활성화된 학원들 조회
        const [academySettings] = await db.query(
            `SELECT ns.*, a.name as academy_name, a.phone as academy_phone
             FROM notification_settings ns
             JOIN academies a ON ns.academy_id = a.id
             WHERE ns.service_type = 'solapi'
             AND ns.solapi_enabled = 1
             AND ns.solapi_reminder_auto_enabled = 1`
        );

        logger.info(`[Solapi 리마인드 자동발송] 발송 대상 학원 수: ${academySettings.length}`);

        const results = [];

        for (const setting of academySettings) {
            try {
                // 솔라피 설정 확인
                if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
                    logger.info(`[Solapi 리마인드 자동발송] ${setting.academy_name}: 솔라피 설정 미완료`);
                    continue;
                }

                if (!setting.solapi_reminder_template_id) {
                    logger.info(`[Solapi 리마인드 자동발송] ${setting.academy_name}: 리마인드 템플릿 미설정`);
                    continue;
                }

                // Secret 복호화
                const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                if (!decryptedSecret) {
                    logger.info(`[Solapi 리마인드 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                    continue;
                }

                const reminderHours = setting.solapi_reminder_hours || 1;

                // 현재 시간 + reminderHours 시간대의 상담 조회
                // 예: 1시간 전 발송이면, 지금이 13시면 14시 상담 대상
                const targetTime = new Date(koreaTime.getTime() + reminderHours * 60 * 60 * 1000);
                const targetDateStr = targetTime.toISOString().split('T')[0]; // YYYY-MM-DD
                const targetHour = targetTime.getHours();

                // 해당 시간대 상담 조회 (confirmed 상태, 아직 리마인드 안 보낸 건)
                const [consultationsRaw] = await db.query(
                    `SELECT c.*, c.id as consultation_id
                     FROM consultations c
                     WHERE c.academy_id = ?
                       AND c.status = 'confirmed'
                       AND DATE(c.preferred_date) = ?
                       AND HOUR(c.preferred_time) = ?
                       AND c.reminder_alimtalk_sent_at IS NULL
                       AND c.parent_phone IS NOT NULL`,
                    [setting.academy_id, targetDateStr, targetHour]
                );

                // 복호화
                const consultations = consultationsRaw.map(c => ({
                    ...c,
                    student_name: decrypt(c.student_name),
                    parent_name: decrypt(c.parent_name),
                    parent_phone: decrypt(c.parent_phone)
                }));

                logger.info(`[Solapi 리마인드 자동발송] ${setting.academy_name}: ${targetDateStr} ${targetHour}시 상담 ${consultations.length}건`);

                let sentCount = 0;
                let failCount = 0;

                const remainingTimeText = reminderHours >= 24
                    ? `${Math.floor(reminderHours / 24)}일`
                    : `${reminderHours}시간`;

                for (const consultation of consultations) {
                    const recipientPhone = consultation.parent_phone;
                    const recipientName = consultation.parent_name || consultation.student_name || '고객';

                    if (!recipientPhone) continue;

                    // 날짜/시간 포맷
                    const schedDate = new Date(consultation.preferred_date);
                    const dateStr = `${schedDate.getMonth() + 1}월 ${schedDate.getDate()}일`;
                    const timeStr = consultation.preferred_time ? consultation.preferred_time.slice(0, 5) : '';

                    // 템플릿 변수 치환
                    let content = setting.solapi_reminder_template_content || '';
                    content = content
                        .replace(/#{이름}/g, recipientName)
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{남은시간}/g, remainingTimeText)
                        .replace(/#{예약번호}/g, consultation.reservation_number || '')
                        .replace(/#{학원명}/g, setting.academy_name || '')
                        .replace(/#{학원전화}/g, setting.academy_phone || '');

                    // 버튼 파싱
                    let buttons = null;
                    if (setting.solapi_reminder_buttons) {
                        try {
                            buttons = JSON.parse(setting.solapi_reminder_buttons);
                        } catch (e) {}
                    }

                    const imageUrl = setting.solapi_reminder_image_url || null;

                    // 발송
                    const result = await sendAlimtalkSolapi(
                        {
                            solapi_api_key: setting.solapi_api_key,
                            solapi_api_secret: decryptedSecret,
                            solapi_pfid: setting.solapi_pfid,
                            solapi_sender_phone: setting.solapi_sender_phone
                        },
                        setting.solapi_reminder_template_id,
                        [{ phone: recipientPhone, content, buttons, imageUrl }]
                    );

                    if (result.success) {
                        sentCount++;
                        // 발송 시간 기록
                        await db.query(
                            `UPDATE consultations SET reminder_alimtalk_sent_at = NOW() WHERE id = ?`,
                            [consultation.consultation_id]
                        );
                    } else {
                        failCount++;
                        logger.info(`[Solapi 리마인드 자동발송] 발송 실패: ${recipientPhone}`, result.message);
                    }
                }

                results.push({
                    academy: setting.academy_name,
                    targetTime: `${targetDateStr} ${targetHour}:00`,
                    total: consultations.length,
                    sent: sentCount,
                    failed: failCount
                });

            } catch (academyError) {
                logger.error(`[Solapi 리마인드 자동발송] ${setting.academy_name} 처리 오류:`, academyError);
                results.push({
                    academy: setting.academy_name,
                    error: academyError.message
                });
            }
        }

        logger.info(`[Solapi 리마인드 자동발송] 완료`, results);

        res.json({
            message: 'Solapi 상담 리마인드 자동발송 완료',
            results
        });

    } catch (error) {
        logger.error('[Solapi 리마인드 자동발송] 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '리마인드 자동발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/send-reminder-auto-sens
 * SENS 상담 리마인드 자동발송 (n8n용)
 */
router.post('/send-reminder-auto-sens', async (req, res) => {
    try {
        // API Key 검증
        const apiKey = req.headers['x-api-key'];
        if (apiKey !== 'paca-n8n-api-key-2024') {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        const now = new Date();
        const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

        logger.info(`[SENS 리마인드 자동발송] 시작 - ${koreaTime.toISOString()}`);

        // 리마인드 자동발송이 활성화된 학원들 조회
        const [academySettings] = await db.query(
            `SELECT ns.*, a.name as academy_name, a.phone as academy_phone
             FROM notification_settings ns
             JOIN academies a ON ns.academy_id = a.id
             WHERE ns.service_type = 'sens'
             AND ns.is_enabled = 1
             AND ns.sens_reminder_auto_enabled = 1`
        );

        logger.info(`[SENS 리마인드 자동발송] 발송 대상 학원 수: ${academySettings.length}`);

        const results = [];

        for (const setting of academySettings) {
            try {
                // SENS 설정 확인
                if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                    logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: SENS 설정 미완료`);
                    continue;
                }

                if (!setting.sens_reminder_template_code) {
                    logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: 리마인드 템플릿 미설정`);
                    continue;
                }

                // Secret 복호화
                const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                if (!decryptedSecret) {
                    logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                    continue;
                }

                const reminderHours = setting.sens_reminder_hours || 1;

                // 현재 시간 + reminderHours 시간대의 상담 조회
                const targetTime = new Date(koreaTime.getTime() + reminderHours * 60 * 60 * 1000);
                const targetDateStr = targetTime.toISOString().split('T')[0];
                const targetHour = targetTime.getHours();

                // 해당 시간대 상담 조회
                const [consultationsRaw] = await db.query(
                    `SELECT c.*, c.id as consultation_id
                     FROM consultations c
                     WHERE c.academy_id = ?
                       AND c.status = 'confirmed'
                       AND DATE(c.preferred_date) = ?
                       AND HOUR(c.preferred_time) = ?
                       AND c.reminder_alimtalk_sent_at IS NULL
                       AND c.parent_phone IS NOT NULL`,
                    [setting.academy_id, targetDateStr, targetHour]
                );

                // 복호화
                const consultations = consultationsRaw.map(c => ({
                    ...c,
                    student_name: decrypt(c.student_name),
                    parent_name: decrypt(c.parent_name),
                    parent_phone: decrypt(c.parent_phone)
                }));

                logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: ${targetDateStr} ${targetHour}시 상담 ${consultations.length}건`);

                let sentCount = 0;
                let failCount = 0;

                const remainingTimeText = reminderHours >= 24
                    ? `${Math.floor(reminderHours / 24)}일`
                    : `${reminderHours}시간`;

                for (const consultation of consultations) {
                    const recipientPhone = consultation.parent_phone;
                    const recipientName = consultation.parent_name || consultation.student_name || '고객';

                    if (!recipientPhone) continue;

                    // 날짜/시간 포맷
                    const schedDate = new Date(consultation.preferred_date);
                    const dateStr = `${schedDate.getMonth() + 1}월 ${schedDate.getDate()}일`;
                    const timeStr = consultation.preferred_time ? consultation.preferred_time.slice(0, 5) : '';

                    // 템플릿 변수 치환
                    let content = setting.sens_reminder_template_content || '';
                    content = content
                        .replace(/#{이름}/g, recipientName)
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{남은시간}/g, remainingTimeText)
                        .replace(/#{예약번호}/g, consultation.reservation_number || '')
                        .replace(/#{학원명}/g, setting.academy_name || '')
                        .replace(/#{학원전화}/g, setting.academy_phone || '');

                    // 버튼 파싱
                    let buttons = null;
                    if (setting.sens_reminder_buttons) {
                        try {
                            buttons = JSON.parse(setting.sens_reminder_buttons);
                        } catch (e) {}
                    }

                    const imageUrl = setting.sens_reminder_image_url || null;

                    // 발송
                    const result = await sendAlimtalk(
                        {
                            naver_access_key: setting.naver_access_key,
                            naver_secret_key: decryptedSecret,
                            naver_service_id: setting.naver_service_id,
                            kakao_channel_id: setting.kakao_channel_id
                        },
                        setting.sens_reminder_template_code,
                        [{ phone: recipientPhone, content, buttons, imageUrl }]
                    );

                    if (result.success) {
                        sentCount++;
                        // 발송 시간 기록
                        await db.query(
                            `UPDATE consultations SET reminder_alimtalk_sent_at = NOW() WHERE id = ?`,
                            [consultation.consultation_id]
                        );
                    } else {
                        failCount++;
                        logger.info(`[SENS 리마인드 자동발송] 발송 실패: ${recipientPhone}`, result.message);
                    }
                }

                results.push({
                    academy: setting.academy_name,
                    targetTime: `${targetDateStr} ${targetHour}:00`,
                    total: consultations.length,
                    sent: sentCount,
                    failed: failCount
                });

            } catch (academyError) {
                logger.error(`[SENS 리마인드 자동발송] ${setting.academy_name} 처리 오류:`, academyError);
                results.push({
                    academy: setting.academy_name,
                    error: academyError.message
                });
            }
        }

        logger.info(`[SENS 리마인드 자동발송] 완료`, results);

        res.json({
            message: 'SENS 상담 리마인드 자동발송 완료',
            results
        });

    } catch (error) {
        logger.error('[SENS 리마인드 자동발송] 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'SENS 리마인드 자동발송에 실패했습니다.'
        });
    }
});

};
