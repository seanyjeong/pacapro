const {
    db, verifyToken, checkPermission, decryptApiKey, sendAlimtalk, sendAlimtalkSolapi,
    createUnpaidNotificationMessage, isValidPhoneNumber, logger, ENCRYPTION_KEY
} = require('./_utils');

module.exports = function(router) {

/**
 * POST /paca/notifications/test
 * 테스트 메시지 발송
 */
router.post('/test', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        // 설정 조회
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];
        const serviceType = setting.service_type || 'sens';

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

        let result;
        let templateCode;
        let messageContent;

        if (serviceType === 'solapi') {
            // 솔라피 발송
            const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
            if (!decryptedSolapiSecret) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: '솔라피 API Secret이 올바르지 않습니다.'
                });
            }

            // 테스트 메시지 생성 (솔라피 템플릿 사용)
            const testMessage = createUnpaidNotificationMessage(
                { month: '12', amount: 300000, due_date: dueDayText },
                { name: '테스트학생' },
                { name: academy[0]?.name || '테스트학원', phone: academy[0]?.phone || '02-1234-5678' },
                setting.solapi_template_content || setting.template_content
            );

            templateCode = setting.solapi_template_id;
            messageContent = testMessage.content;

            result = await sendAlimtalkSolapi(
                {
                    solapi_api_key: setting.solapi_api_key,
                    solapi_api_secret: decryptedSolapiSecret,
                    solapi_pfid: setting.solapi_pfid,
                    solapi_sender_phone: setting.solapi_sender_phone
                },
                setting.solapi_template_id,
                [{ phone, content: testMessage.content }]
            );
        } else {
            // SENS 발송 (기존 로직)
            const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
            if (!decryptedSecret) {
                return res.status(400).json({
                    error: 'Configuration Error',
                    message: 'API Secret Key가 올바르지 않습니다.'
                });
            }

            // 테스트 메시지 발송
            const testMessage = createUnpaidNotificationMessage(
                { month: '12', amount: 300000, due_date: dueDayText },
                { name: '테스트학생' },
                { name: academy[0]?.name || '테스트학원', phone: academy[0]?.phone || '02-1234-5678' },
                setting.template_content
            );

            templateCode = setting.template_code;
            messageContent = testMessage.content;

            result = await sendAlimtalk(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id
                },
                setting.template_code,
                [{ phone, content: testMessage.content, variables: testMessage.variables }]
            );
        }

        if (result.success) {
            // 로그 기록
            await db.query(
                `INSERT INTO notification_logs
                (academy_id, recipient_name, recipient_phone, message_type, template_code,
                 message_content, status, request_id, sent_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, NOW())`,
                [
                    req.user.academyId,
                    '테스트',
                    phone,
                    'alimtalk',
                    templateCode,
                    messageContent,
                    'sent',
                    result.requestId || result.groupId
                ]
            );

            res.json({
                message: `테스트 메시지가 발송되었습니다. (${serviceType === 'solapi' ? '솔라피' : 'SENS'})`,
                success: true,
                requestId: result.requestId || result.groupId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: '메시지 발송에 실패했습니다: ' + (result.error || '알 수 없는 오류'),
                details: result
            });
        }
    } catch (error) {
        logger.error('테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-consultation
 * 상담확정 알림톡 테스트 발송
 */
router.post('/test-consultation', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        // 설정 조회
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // 솔라피 설정 확인
        if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.solapi_consultation_template_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '상담확정 템플릿 ID를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API Secret이 올바르지 않습니다.'
            });
        }

        // 테스트 데이터로 메시지 생성
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + 3); // 3일 후
        const dateStr = `${testDate.getMonth() + 1}월 ${testDate.getDate()}일`;
        const timeStr = '14:00';
        const testReservationNumber = 'TEST001';

        // 템플릿 변수 치환
        let content = setting.solapi_consultation_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{날짜}/g, dateStr)
            .replace(/#{시간}/g, timeStr)
            .replace(/#{예약번호}/g, testReservationNumber);

        // 버튼 설정 파싱 및 변수 치환
        let buttons = null;
        if (setting.solapi_consultation_buttons) {
            try {
                buttons = JSON.parse(setting.solapi_consultation_buttons);
                // 버튼 링크의 변수 치환
                buttons = buttons.map(btn => ({
                    ...btn,
                    linkMo: btn.linkMo?.replace(/#{이름}/g, '테스트학생')
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{예약번호}/g, testReservationNumber),
                    linkPc: btn.linkPc?.replace(/#{이름}/g, '테스트학생')
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{예약번호}/g, testReservationNumber),
                }));
            } catch (e) {
                logger.error('버튼 설정 파싱 오류:', e);
            }
        }

        // 이미지 URL
        const imageUrl = setting.solapi_consultation_image_url || null;

        // 솔라피 알림톡 발송 (버튼/이미지 포함)
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
            // 로그 기록
            await db.query(
                `INSERT INTO notification_logs
                (academy_id, recipient_name, recipient_phone, message_type, template_code,
                 message_content, status, request_id, sent_at)
                VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                [
                    req.user.academyId,
                    '테스트(상담확정)',
                    phone,
                    setting.solapi_consultation_template_id,
                    content,
                    result.groupId || null
                ]
            );

            res.json({
                message: '상담확정 테스트 메시지가 발송되었습니다.',
                success: true,
                groupId: result.groupId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: '메시지 발송에 실패했습니다: ' + (result.error || '알 수 없는 오류'),
                details: result
            });
        }
    } catch (error) {
        logger.error('상담확정 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-trial
 * 체험수업 알림톡 테스트 발송
 */
router.post('/test-trial', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        // 설정 조회
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // 솔라피 설정 확인
        if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.solapi_trial_template_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '체험수업 템플릿 ID를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API Secret이 올바르지 않습니다.'
            });
        }

        // 학원명 조회
        const [academy] = await db.query(
            'SELECT name FROM academies WHERE id = ?',
            [req.user.academyId]
        );
        const academyName = academy[0]?.name || '학원';

        // 테스트 체험일정 생성 (오늘 + 2일, 오늘 + 4일)
        const today = new Date();
        const date1 = new Date(today);
        date1.setDate(date1.getDate() + 2);
        const date2 = new Date(today);
        date2.setDate(date2.getDate() + 4);

        const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
        const formatDate = (d) => {
            const m = d.getMonth() + 1;
            const day = d.getDate();
            const dayName = dayNames[d.getDay()];
            return `${m}/${day}(${dayName})`;
        };

        // 체험일정 문자열 (1회차 완료 표시)
        const scheduleText = `✓ 1회차: ${formatDate(date1)} 18:30\n2회차: ${formatDate(date2)} 18:30`;

        // 템플릿 변수 치환
        let content = setting.solapi_trial_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{학원명}/g, academyName)
            .replace(/#{체험일정}/g, scheduleText);

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

        // 솔라피 알림톡 발송
        const result = await sendAlimtalkSolapi(
            {
                solapi_api_key: setting.solapi_api_key,
                solapi_api_secret: decryptedSecret,
                solapi_pfid: setting.solapi_pfid,
                solapi_sender_phone: setting.solapi_sender_phone
            },
            setting.solapi_trial_template_id,
            [{ phone, content, buttons, imageUrl }]
        );

        if (result.success) {
            // 로그 기록
            await db.query(
                `INSERT INTO notification_logs
                (academy_id, recipient_name, recipient_phone, message_type, template_code,
                 message_content, status, request_id, sent_at)
                VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                [
                    req.user.academyId,
                    '테스트(체험수업)',
                    phone,
                    setting.solapi_trial_template_id,
                    content,
                    result.groupId || null
                ]
            );

            res.json({
                message: '체험수업 테스트 메시지가 발송되었습니다.',
                success: true,
                groupId: result.groupId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: '메시지 발송에 실패했습니다: ' + (result.error || '알 수 없는 오류'),
                details: result
            });
        }
    } catch (error) {
        logger.error('체험수업 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-overdue
 * 미납자 알림톡 테스트 발송
 */
router.post('/test-overdue', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        // 설정 조회
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // 솔라피 설정 확인
        if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.solapi_overdue_template_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '미납자 템플릿 ID를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API Secret이 올바르지 않습니다.'
            });
        }

        // 학원 정보 조회
        const [academy] = await db.query(
            'SELECT name, phone FROM academies WHERE id = ?',
            [req.user.academyId]
        );
        const academyName = academy[0]?.name || '학원';
        const academyPhone = academy[0]?.phone || '';

        // 테스트 데이터
        const now = new Date();
        const testMonth = now.getMonth() + 1;

        // 템플릿 변수 치환
        let content = setting.solapi_overdue_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{월}/g, String(testMonth))
            .replace(/#{교육비}/g, '300,000')
            .replace(/#{날짜}/g, '10일')
            .replace(/#{학원명}/g, academyName)
            .replace(/#{학원전화}/g, academyPhone);

        // 버튼 설정 파싱
        let buttons = null;
        if (setting.solapi_overdue_buttons) {
            try {
                buttons = JSON.parse(setting.solapi_overdue_buttons);
            } catch (e) {
                logger.error('버튼 설정 파싱 오류:', e);
            }
        }

        // 이미지 URL
        const imageUrl = setting.solapi_overdue_image_url || null;

        // 솔라피 알림톡 발송
        const result = await sendAlimtalkSolapi(
            {
                solapi_api_key: setting.solapi_api_key,
                solapi_api_secret: decryptedSecret,
                solapi_pfid: setting.solapi_pfid,
                solapi_sender_phone: setting.solapi_sender_phone
            },
            setting.solapi_overdue_template_id,
            [{ phone, content, buttons, imageUrl }]
        );

        if (result.success) {
            // 로그 기록
            await db.query(
                `INSERT INTO notification_logs
                (academy_id, recipient_name, recipient_phone, message_type, template_code,
                 message_content, status, request_id, sent_at)
                VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
                [
                    req.user.academyId,
                    '테스트(미납자)',
                    phone,
                    setting.solapi_overdue_template_id,
                    content,
                    result.groupId || null
                ]
            );

            res.json({
                message: '미납자 테스트 메시지가 발송되었습니다.',
                success: true,
                groupId: result.groupId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: '메시지 발송에 실패했습니다: ' + (result.error || '알 수 없는 오류'),
                details: result
            });
        }
    } catch (error) {
        logger.error('미납자 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '테스트 발송에 실패했습니다.'
        });
    }
});

// =====================================================
// SENS 테스트 API (솔라피와 동일한 구조)
// =====================================================

/**
 * POST /paca/notifications/test-sens-consultation
 * SENS 상담확정 알림톡 테스트 발송
 */
router.post('/test-sens-consultation', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // SENS 설정 확인
        if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.sens_consultation_template_code) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '상담확정 템플릿 코드를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API Secret이 올바르지 않습니다.'
            });
        }

        // 테스트 데이터로 메시지 생성
        const testDate = new Date();
        testDate.setDate(testDate.getDate() + 3);
        const dateStr = `${testDate.getMonth() + 1}월 ${testDate.getDate()}일`;
        const timeStr = '14:00';
        const testReservationNumber = 'TEST001';

        // 템플릿 변수 치환
        let content = setting.sens_consultation_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{날짜}/g, dateStr)
            .replace(/#{시간}/g, timeStr)
            .replace(/#{예약번호}/g, testReservationNumber);

        // 버튼 설정 파싱 및 변수 치환
        let buttons = null;
        if (setting.sens_consultation_buttons) {
            try {
                buttons = JSON.parse(setting.sens_consultation_buttons);
                buttons = buttons.map(btn => ({
                    ...btn,
                    linkMo: btn.linkMo?.replace(/#{이름}/g, '테스트학생')
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{예약번호}/g, testReservationNumber),
                    linkPc: btn.linkPc?.replace(/#{이름}/g, '테스트학생')
                        .replace(/#{날짜}/g, dateStr)
                        .replace(/#{시간}/g, timeStr)
                        .replace(/#{예약번호}/g, testReservationNumber)
                }));
            } catch (e) {
                logger.error('버튼 파싱 오류:', e);
            }
        }

        // SENS 알림톡 발송
        const result = await sendAlimtalk(
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
            res.json({
                message: 'SENS 상담확정 테스트 발송 성공',
                success: true,
                requestId: result.requestId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: result.error || '발송에 실패했습니다.'
            });
        }
    } catch (error) {
        logger.error('SENS 상담확정 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'SENS 상담확정 테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-sens-trial
 * SENS 체험수업 알림톡 테스트 발송
 */
router.post('/test-sens-trial', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // SENS 설정 확인
        if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.sens_trial_template_code) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '체험수업 템플릿 코드를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API Secret이 올바르지 않습니다.'
            });
        }

        // 학원 정보 조회
        const [academies] = await db.query(
            'SELECT name, phone FROM academies WHERE id = ?',
            [req.user.academyId]
        );
        const academyName = academies.length > 0 ? academies[0].name : '테스트학원';

        // 테스트 체험일정 생성
        const today = new Date();
        const trialSchedule = `✓ 1회차: ${today.getMonth() + 1}/${today.getDate()}(${['일', '월', '화', '수', '목', '금', '토'][today.getDay()]})\n2회차: ${today.getMonth() + 1}/${today.getDate() + 2}(${['일', '월', '화', '수', '목', '금', '토'][(today.getDay() + 2) % 7]})`;

        // 템플릿 변수 치환
        let content = setting.sens_trial_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{학원명}/g, academyName)
            .replace(/#{체험일정}/g, trialSchedule);

        // 버튼 설정 파싱
        let buttons = null;
        if (setting.sens_trial_buttons) {
            try {
                buttons = JSON.parse(setting.sens_trial_buttons);
            } catch (e) {
                logger.error('버튼 파싱 오류:', e);
            }
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
            [{ phone, content, buttons }]
        );

        if (result.success) {
            res.json({
                message: 'SENS 체험수업 테스트 발송 성공',
                success: true,
                requestId: result.requestId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: result.error || '발송에 실패했습니다.'
            });
        }
    } catch (error) {
        logger.error('SENS 체험수업 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'SENS 체험수업 테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-sens-overdue
 * SENS 미납자 알림톡 테스트 발송
 */
router.post('/test-sens-overdue', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // SENS 설정 확인
        if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.sens_overdue_template_code) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '미납자 템플릿 코드를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API Secret이 올바르지 않습니다.'
            });
        }

        // 학원 정보 조회
        const [academies] = await db.query(
            'SELECT name, phone FROM academies WHERE id = ?',
            [req.user.academyId]
        );
        const academyName = academies.length > 0 ? academies[0].name : '테스트학원';
        const academyPhone = academies.length > 0 ? academies[0].phone : '02-1234-5678';

        // 테스트 데이터
        const today = new Date();
        const monthStr = `${today.getMonth() + 1}`;
        const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;

        // 템플릿 변수 치환
        let content = setting.sens_overdue_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{월}/g, monthStr)
            .replace(/#{교육비}/g, '500,000')
            .replace(/#{날짜}/g, dateStr)
            .replace(/#{학원명}/g, academyName)
            .replace(/#{학원전화}/g, academyPhone);

        // 버튼 설정 파싱
        let buttons = null;
        if (setting.sens_overdue_buttons) {
            try {
                buttons = JSON.parse(setting.sens_overdue_buttons);
            } catch (e) {
                logger.error('버튼 파싱 오류:', e);
            }
        }

        // SENS 알림톡 발송
        const result = await sendAlimtalk(
            {
                naver_access_key: setting.naver_access_key,
                naver_secret_key: decryptedSecret,
                naver_service_id: setting.naver_service_id,
                kakao_channel_id: setting.kakao_channel_id
            },
            setting.sens_overdue_template_code,
            [{ phone, content, buttons }]
        );

        if (result.success) {
            res.json({
                message: 'SENS 미납자 테스트 발송 성공',
                success: true,
                requestId: result.requestId
            });
        } else {
            res.status(400).json({
                error: 'Send Failed',
                message: result.error || '발송에 실패했습니다.'
            });
        }
    } catch (error) {
        logger.error('SENS 미납자 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'SENS 미납자 테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-reminder
 * 솔라피 상담 리마인드 알림톡 테스트 발송
 */
router.post('/test-reminder', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        // 설정 조회
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // 솔라피 설정 확인
        if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.solapi_reminder_template_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '리마인드 템플릿 ID를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '솔라피 API Secret이 올바르지 않습니다.'
            });
        }

        // 학원 정보 조회
        const [academy] = await db.query(
            'SELECT name, phone FROM academies WHERE id = ?',
            [req.user.academyId]
        );
        const academyName = academy[0]?.name || '학원';
        const academyPhone = academy[0]?.phone || '';

        // 테스트 데이터
        const now = new Date();
        const testDate = `${now.getMonth() + 1}월 ${now.getDate()}일`;
        const testTime = '14:00';
        const reminderHours = setting.solapi_reminder_hours || 1;
        const remainingTimeText = reminderHours >= 24
            ? `${Math.floor(reminderHours / 24)}일`
            : `${reminderHours}시간`;

        // 템플릿 변수 치환
        let content = setting.solapi_reminder_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{날짜}/g, testDate)
            .replace(/#{시간}/g, testTime)
            .replace(/#{남은시간}/g, remainingTimeText)
            .replace(/#{예약번호}/g, 'TEST-001')
            .replace(/#{학원명}/g, academyName)
            .replace(/#{학원전화}/g, academyPhone);

        // 버튼 설정 파싱
        let buttons = null;
        if (setting.solapi_reminder_buttons) {
            try {
                buttons = JSON.parse(setting.solapi_reminder_buttons);
            } catch (e) {
                logger.error('버튼 설정 파싱 오류:', e);
            }
        }

        // 이미지 URL
        const imageUrl = setting.solapi_reminder_image_url || null;

        // 솔라피 알림톡 발송
        const result = await sendAlimtalkSolapi(
            {
                solapi_api_key: setting.solapi_api_key,
                solapi_api_secret: decryptedSecret,
                solapi_pfid: setting.solapi_pfid,
                solapi_sender_phone: setting.solapi_sender_phone
            },
            setting.solapi_reminder_template_id,
            [{ phone, content, buttons, imageUrl }]
        );

        if (result.success) {
            res.json({
                success: true,
                message: '리마인드 테스트 알림톡이 발송되었습니다.'
            });
        } else {
            res.status(400).json({
                error: 'Send Error',
                message: result.message || '알림톡 발송에 실패했습니다.',
                details: result.details
            });
        }

    } catch (error) {
        logger.error('리마인드 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '테스트 발송에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/notifications/test-sens-reminder
 * SENS 상담 리마인드 알림톡 테스트 발송
 */
router.post('/test-sens-reminder', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const { phone } = req.body;

        if (!phone || !isValidPhoneNumber(phone)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '유효한 전화번호를 입력해주세요.'
            });
        }

        // 설정 조회
        const [settings] = await db.query(
            'SELECT * FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '알림 설정을 먼저 완료해주세요.'
            });
        }

        const setting = settings[0];

        // SENS 설정 확인
        if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API 설정을 먼저 완료해주세요.'
            });
        }

        if (!setting.sens_reminder_template_code) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: '리마인드 템플릿 코드를 먼저 설정해주세요.'
            });
        }

        // Secret 복호화
        const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
        if (!decryptedSecret) {
            return res.status(400).json({
                error: 'Configuration Error',
                message: 'SENS API Secret이 올바르지 않습니다.'
            });
        }

        // 학원 정보 조회
        const [academy] = await db.query(
            'SELECT name, phone FROM academies WHERE id = ?',
            [req.user.academyId]
        );
        const academyName = academy[0]?.name || '학원';
        const academyPhone = academy[0]?.phone || '';

        // 테스트 데이터
        const now = new Date();
        const testDate = `${now.getMonth() + 1}월 ${now.getDate()}일`;
        const testTime = '14:00';
        const reminderHours = setting.sens_reminder_hours || 1;
        const remainingTimeText = reminderHours >= 24
            ? `${Math.floor(reminderHours / 24)}일`
            : `${reminderHours}시간`;

        // 템플릿 변수 치환
        let content = setting.sens_reminder_template_content || '';
        content = content
            .replace(/#{이름}/g, '테스트학생')
            .replace(/#{날짜}/g, testDate)
            .replace(/#{시간}/g, testTime)
            .replace(/#{남은시간}/g, remainingTimeText)
            .replace(/#{예약번호}/g, 'TEST-001')
            .replace(/#{학원명}/g, academyName)
            .replace(/#{학원전화}/g, academyPhone);

        // 버튼 설정 파싱
        let buttons = null;
        if (setting.sens_reminder_buttons) {
            try {
                buttons = JSON.parse(setting.sens_reminder_buttons);
            } catch (e) {
                logger.error('버튼 설정 파싱 오류:', e);
            }
        }

        // 이미지 URL
        const imageUrl = setting.sens_reminder_image_url || null;

        // SENS 알림톡 발송
        const result = await sendAlimtalk(
            {
                naver_access_key: setting.naver_access_key,
                naver_secret_key: decryptedSecret,
                naver_service_id: setting.naver_service_id,
                kakao_channel_id: setting.kakao_channel_id
            },
            setting.sens_reminder_template_code,
            [{
                phone,
                content,
                buttons,
                imageUrl
            }]
        );

        if (result.success) {
            res.json({
                success: true,
                message: 'SENS 리마인드 테스트 알림톡이 발송되었습니다.'
            });
        } else {
            res.status(400).json({
                error: 'Send Error',
                message: result.message || '알림톡 발송에 실패했습니다.',
                details: result.details
            });
        }

    } catch (error) {
        logger.error('SENS 리마인드 테스트 발송 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '테스트 발송에 실패했습니다.'
        });
    }
});

};
