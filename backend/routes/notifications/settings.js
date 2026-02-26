const {
    db, verifyToken, checkPermission, encryptApiKey, decryptApiKey,
    logger, ENCRYPTION_KEY, getBalanceSolapi
} = require('./_utils');

module.exports = function(router) {

/**
 * GET /paca/notifications/settings
 * 알림 설정 조회
 */
router.get('/settings', verifyToken, checkPermission('notifications', 'view'), async (req, res) => {
    try {
        const [settings] = await db.query(
            `SELECT * FROM notification_settings WHERE academy_id = ?`,
            [req.user.academyId]
        );

        if (settings.length === 0) {
            return res.json({
                message: '알림 설정이 없습니다.',
                settings: {
                    service_type: 'sens',
                    naver_access_key: '',
                    naver_secret_key: '',
                    naver_service_id: '',
                    sms_service_id: '',
                    kakao_channel_id: '',
                    // 솔라피 설정
                    solapi_api_key: '',
                    solapi_api_secret: '',
                    solapi_pfid: '',
                    solapi_sender_phone: '',
                    // 공통 설정
                    template_code: '',
                    template_content: '',
                    is_enabled: false,
                    solapi_enabled: false,
                    // SENS 수업일 기반 자동발송
                    sens_auto_enabled: false,
                    sens_auto_hour: 10,
                    // SENS 납부안내 버튼/이미지
                    sens_buttons: [],
                    sens_image_url: '',
                    // SENS 상담확정
                    sens_consultation_template_code: '',
                    sens_consultation_template_content: '',
                    sens_consultation_buttons: [],
                    sens_consultation_image_url: '',
                    // SENS 체험수업
                    sens_trial_template_code: '',
                    sens_trial_template_content: '',
                    sens_trial_buttons: [],
                    sens_trial_image_url: '',
                    sens_trial_auto_enabled: false,
                    sens_trial_auto_hour: 9,
                    // SENS 미납자
                    sens_overdue_template_code: '',
                    sens_overdue_template_content: '',
                    sens_overdue_buttons: [],
                    sens_overdue_image_url: '',
                    sens_overdue_auto_enabled: false,
                    sens_overdue_auto_hour: 9
                }
            });
        }

        // Secret Key 마스킹 (앞 4자리만 표시)
        const setting = settings[0];

        // SENS Secret Key 마스킹
        const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
        const maskedSecret = decryptedSecret
            ? decryptedSecret.substring(0, 4) + '****'
            : '';

        // 솔라피 API Secret 마스킹
        const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
        const maskedSolapiSecret = decryptedSolapiSecret
            ? decryptedSolapiSecret.substring(0, 4) + '****'
            : '';

        res.json({
            message: '알림 설정 조회 성공',
            settings: {
                ...setting,
                naver_secret_key: maskedSecret,
                has_secret_key: !!setting.naver_secret_key,
                solapi_api_secret: maskedSolapiSecret,
                has_solapi_secret: !!setting.solapi_api_secret,
                // 납부 안내 알림톡 버튼/이미지
                solapi_buttons: setting.solapi_buttons ? JSON.parse(setting.solapi_buttons) : [],
                solapi_image_url: setting.solapi_image_url || '',
                // 상담확정 알림톡 설정
                solapi_consultation_template_id: setting.solapi_consultation_template_id || '',
                solapi_consultation_template_content: setting.solapi_consultation_template_content || '',
                solapi_consultation_buttons: setting.solapi_consultation_buttons ? JSON.parse(setting.solapi_consultation_buttons) : [],
                solapi_consultation_image_url: setting.solapi_consultation_image_url || '',
                // 체험수업 알림톡 설정
                solapi_trial_template_id: setting.solapi_trial_template_id || '',
                solapi_trial_template_content: setting.solapi_trial_template_content || '',
                solapi_trial_buttons: setting.solapi_trial_buttons ? JSON.parse(setting.solapi_trial_buttons) : [],
                solapi_trial_image_url: setting.solapi_trial_image_url || '',
                solapi_trial_auto_enabled: setting.solapi_trial_auto_enabled || false,
                solapi_trial_auto_hour: setting.solapi_trial_auto_hour ?? 9,
                // 미납자 알림톡 설정
                solapi_overdue_template_id: setting.solapi_overdue_template_id || '',
                solapi_overdue_template_content: setting.solapi_overdue_template_content || '',
                solapi_overdue_buttons: setting.solapi_overdue_buttons ? JSON.parse(setting.solapi_overdue_buttons) : [],
                solapi_overdue_image_url: setting.solapi_overdue_image_url || '',
                solapi_overdue_auto_enabled: setting.solapi_overdue_auto_enabled || false,
                solapi_overdue_auto_hour: setting.solapi_overdue_auto_hour ?? 9,
                // SENS 수업일 기반 자동발송
                sens_auto_enabled: setting.sens_auto_enabled || false,
                sens_auto_hour: setting.sens_auto_hour ?? 10,
                // SENS 납부안내 버튼/이미지
                sens_buttons: setting.sens_buttons ? JSON.parse(setting.sens_buttons) : [],
                sens_image_url: setting.sens_image_url || '',
                // SENS 상담확정 알림톡 설정
                sens_consultation_template_code: setting.sens_consultation_template_code || '',
                sens_consultation_template_content: setting.sens_consultation_template_content || '',
                sens_consultation_buttons: setting.sens_consultation_buttons ? JSON.parse(setting.sens_consultation_buttons) : [],
                sens_consultation_image_url: setting.sens_consultation_image_url || '',
                // SENS 체험수업 알림톡 설정
                sens_trial_template_code: setting.sens_trial_template_code || '',
                sens_trial_template_content: setting.sens_trial_template_content || '',
                sens_trial_buttons: setting.sens_trial_buttons ? JSON.parse(setting.sens_trial_buttons) : [],
                sens_trial_image_url: setting.sens_trial_image_url || '',
                sens_trial_auto_enabled: setting.sens_trial_auto_enabled || false,
                sens_trial_auto_hour: setting.sens_trial_auto_hour ?? 9,
                // SENS 미납자 알림톡 설정
                sens_overdue_template_code: setting.sens_overdue_template_code || '',
                sens_overdue_template_content: setting.sens_overdue_template_content || '',
                sens_overdue_buttons: setting.sens_overdue_buttons ? JSON.parse(setting.sens_overdue_buttons) : [],
                sens_overdue_image_url: setting.sens_overdue_image_url || '',
                sens_overdue_auto_enabled: setting.sens_overdue_auto_enabled || false,
                sens_overdue_auto_hour: setting.sens_overdue_auto_hour ?? 9,
                // 솔라피 상담 리마인드 알림톡 설정
                solapi_reminder_template_id: setting.solapi_reminder_template_id || '',
                solapi_reminder_template_content: setting.solapi_reminder_template_content || '',
                solapi_reminder_buttons: setting.solapi_reminder_buttons ? JSON.parse(setting.solapi_reminder_buttons) : [],
                solapi_reminder_image_url: setting.solapi_reminder_image_url || '',
                solapi_reminder_auto_enabled: setting.solapi_reminder_auto_enabled || false,
                solapi_reminder_hours: setting.solapi_reminder_hours ?? 1,
                // SENS 상담 리마인드 알림톡 설정
                sens_reminder_template_code: setting.sens_reminder_template_code || '',
                sens_reminder_template_content: setting.sens_reminder_template_content || '',
                sens_reminder_buttons: setting.sens_reminder_buttons ? JSON.parse(setting.sens_reminder_buttons) : [],
                sens_reminder_image_url: setting.sens_reminder_image_url || '',
                sens_reminder_auto_enabled: setting.sens_reminder_auto_enabled || false,
                sens_reminder_hours: setting.sens_reminder_hours ?? 1
            }
        });
    } catch (error) {
        logger.error('알림 설정 조회 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '알림 설정 조회에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/notifications/settings
 * 알림 설정 저장
 */
router.put('/settings', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
    try {
        const {
            service_type,
            // SENS 설정
            naver_access_key,
            naver_secret_key,
            naver_service_id,
            sms_service_id,
            kakao_channel_id,
            template_code,
            template_content,
            // 솔라피 설정
            solapi_api_key,
            solapi_api_secret,
            solapi_pfid,
            solapi_sender_phone,
            solapi_template_id,
            solapi_template_content,
            solapi_buttons,
            solapi_image_url,
            // 상담확정 알림톡 설정
            solapi_consultation_template_id,
            solapi_consultation_template_content,
            solapi_consultation_buttons,
            solapi_consultation_image_url,
            // 체험수업 알림톡 설정
            solapi_trial_template_id,
            solapi_trial_template_content,
            solapi_trial_buttons,
            solapi_trial_image_url,
            solapi_trial_auto_enabled,
            solapi_trial_auto_hour,
            // 미납자 알림톡 설정
            solapi_overdue_template_id,
            solapi_overdue_template_content,
            solapi_overdue_buttons,
            solapi_overdue_image_url,
            solapi_overdue_auto_enabled,
            solapi_overdue_auto_hour,
            // 공통 설정
            is_enabled,
            solapi_enabled,
            solapi_auto_enabled,
            solapi_auto_hour,
            // SENS 수업일 기반 자동발송
            sens_auto_enabled,
            sens_auto_hour,
            // SENS 납부안내 버튼/이미지
            sens_buttons,
            sens_image_url,
            // SENS 상담확정
            sens_consultation_template_code,
            sens_consultation_template_content,
            sens_consultation_buttons,
            sens_consultation_image_url,
            // SENS 체험수업
            sens_trial_template_code,
            sens_trial_template_content,
            sens_trial_buttons,
            sens_trial_image_url,
            sens_trial_auto_enabled,
            sens_trial_auto_hour,
            // SENS 미납자
            sens_overdue_template_code,
            sens_overdue_template_content,
            sens_overdue_buttons,
            sens_overdue_image_url,
            sens_overdue_auto_enabled,
            sens_overdue_auto_hour,
            // 솔라피 상담 리마인드
            solapi_reminder_template_id,
            solapi_reminder_template_content,
            solapi_reminder_buttons,
            solapi_reminder_image_url,
            solapi_reminder_auto_enabled,
            solapi_reminder_hours,
            // SENS 상담 리마인드
            sens_reminder_template_code,
            sens_reminder_template_content,
            sens_reminder_buttons,
            sens_reminder_image_url,
            sens_reminder_auto_enabled,
            sens_reminder_hours
        } = req.body;

        // 기존 설정 확인
        const [existing] = await db.query(
            'SELECT id, naver_secret_key, solapi_api_secret FROM notification_settings WHERE academy_id = ?',
            [req.user.academyId]
        );

        // SENS Secret Key 처리 (새로 입력된 경우에만 암호화)
        let encryptedSecret = null;
        if (naver_secret_key && !naver_secret_key.includes('****')) {
            encryptedSecret = encryptApiKey(naver_secret_key, ENCRYPTION_KEY);
        } else if (existing.length > 0) {
            encryptedSecret = existing[0].naver_secret_key;
        }

        // 솔라피 API Secret 처리 (새로 입력된 경우에만 암호화)
        let encryptedSolapiSecret = null;
        if (solapi_api_secret && !solapi_api_secret.includes('****')) {
            encryptedSolapiSecret = encryptApiKey(solapi_api_secret, ENCRYPTION_KEY);
        } else if (existing.length > 0) {
            encryptedSolapiSecret = existing[0].solapi_api_secret;
        }

        if (existing.length === 0) {
            // 신규 생성
            await db.query(
                `INSERT INTO notification_settings
                (academy_id, service_type,
                 naver_access_key, naver_secret_key, naver_service_id, sms_service_id, kakao_channel_id,
                 solapi_api_key, solapi_api_secret, solapi_pfid, solapi_sender_phone, solapi_template_id, solapi_template_content,
                 solapi_buttons, solapi_image_url,
                 solapi_consultation_template_id, solapi_consultation_template_content, solapi_consultation_buttons, solapi_consultation_image_url,
                 solapi_trial_template_id, solapi_trial_template_content, solapi_trial_buttons, solapi_trial_image_url,
                 solapi_trial_auto_enabled, solapi_trial_auto_hour,
                 solapi_overdue_template_id, solapi_overdue_template_content, solapi_overdue_buttons, solapi_overdue_image_url,
                 solapi_overdue_auto_enabled, solapi_overdue_auto_hour,
                 template_code, template_content, is_enabled, solapi_enabled, solapi_auto_enabled, solapi_auto_hour,
                 sens_auto_enabled, sens_auto_hour, sens_buttons, sens_image_url,
                 sens_consultation_template_code, sens_consultation_template_content, sens_consultation_buttons, sens_consultation_image_url,
                 sens_trial_template_code, sens_trial_template_content, sens_trial_buttons, sens_trial_image_url,
                 sens_trial_auto_enabled, sens_trial_auto_hour,
                 sens_overdue_template_code, sens_overdue_template_content, sens_overdue_buttons, sens_overdue_image_url,
                 sens_overdue_auto_enabled, sens_overdue_auto_hour,
                 solapi_reminder_template_id, solapi_reminder_template_content, solapi_reminder_buttons, solapi_reminder_image_url,
                 solapi_reminder_auto_enabled, solapi_reminder_hours,
                 sens_reminder_template_code, sens_reminder_template_content, sens_reminder_buttons, sens_reminder_image_url,
                 sens_reminder_auto_enabled, sens_reminder_hours)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.academyId,
                    service_type || 'sens',
                    naver_access_key || null,
                    encryptedSecret,
                    naver_service_id || null,
                    sms_service_id || null,
                    kakao_channel_id || null,
                    solapi_api_key || null,
                    encryptedSolapiSecret,
                    solapi_pfid || null,
                    solapi_sender_phone || null,
                    solapi_template_id || null,
                    solapi_template_content || null,
                    solapi_buttons ? JSON.stringify(solapi_buttons) : null,
                    solapi_image_url || null,
                    solapi_consultation_template_id || null,
                    solapi_consultation_template_content || null,
                    solapi_consultation_buttons ? JSON.stringify(solapi_consultation_buttons) : null,
                    solapi_consultation_image_url || null,
                    solapi_trial_template_id || null,
                    solapi_trial_template_content || null,
                    solapi_trial_buttons ? JSON.stringify(solapi_trial_buttons) : null,
                    solapi_trial_image_url || null,
                    solapi_trial_auto_enabled || false,
                    solapi_trial_auto_hour ?? 9,
                    solapi_overdue_template_id || null,
                    solapi_overdue_template_content || null,
                    solapi_overdue_buttons ? JSON.stringify(solapi_overdue_buttons) : null,
                    solapi_overdue_image_url || null,
                    solapi_overdue_auto_enabled || false,
                    solapi_overdue_auto_hour ?? 9,
                    template_code || null,
                    template_content || null,
                    is_enabled || false,
                    solapi_enabled || false,
                    solapi_auto_enabled || false,
                    solapi_auto_hour ?? 10,
                    // SENS 새 필드
                    sens_auto_enabled || false,
                    sens_auto_hour ?? 10,
                    sens_buttons ? JSON.stringify(sens_buttons) : null,
                    sens_image_url || null,
                    sens_consultation_template_code || null,
                    sens_consultation_template_content || null,
                    sens_consultation_buttons ? JSON.stringify(sens_consultation_buttons) : null,
                    sens_consultation_image_url || null,
                    sens_trial_template_code || null,
                    sens_trial_template_content || null,
                    sens_trial_buttons ? JSON.stringify(sens_trial_buttons) : null,
                    sens_trial_image_url || null,
                    sens_trial_auto_enabled || false,
                    sens_trial_auto_hour ?? 9,
                    sens_overdue_template_code || null,
                    sens_overdue_template_content || null,
                    sens_overdue_buttons ? JSON.stringify(sens_overdue_buttons) : null,
                    sens_overdue_image_url || null,
                    sens_overdue_auto_enabled || false,
                    sens_overdue_auto_hour ?? 9,
                    // Reminder 필드
                    solapi_reminder_template_id || null,
                    solapi_reminder_template_content || null,
                    solapi_reminder_buttons ? JSON.stringify(solapi_reminder_buttons) : null,
                    solapi_reminder_image_url || null,
                    solapi_reminder_auto_enabled || false,
                    solapi_reminder_hours ?? 1,
                    sens_reminder_template_code || null,
                    sens_reminder_template_content || null,
                    sens_reminder_buttons ? JSON.stringify(sens_reminder_buttons) : null,
                    sens_reminder_image_url || null,
                    sens_reminder_auto_enabled || false,
                    sens_reminder_hours ?? 1
                ]
            );
        } else {
            // 업데이트
            await db.query(
                `UPDATE notification_settings SET
                    service_type = ?,
                    naver_access_key = ?,
                    naver_secret_key = ?,
                    naver_service_id = ?,
                    sms_service_id = ?,
                    kakao_channel_id = ?,
                    solapi_api_key = ?,
                    solapi_api_secret = ?,
                    solapi_pfid = ?,
                    solapi_sender_phone = ?,
                    solapi_template_id = ?,
                    solapi_template_content = ?,
                    solapi_buttons = ?,
                    solapi_image_url = ?,
                    solapi_consultation_template_id = ?,
                    solapi_consultation_template_content = ?,
                    solapi_consultation_buttons = ?,
                    solapi_consultation_image_url = ?,
                    solapi_trial_template_id = ?,
                    solapi_trial_template_content = ?,
                    solapi_trial_buttons = ?,
                    solapi_trial_image_url = ?,
                    solapi_trial_auto_enabled = ?,
                    solapi_trial_auto_hour = ?,
                    solapi_overdue_template_id = ?,
                    solapi_overdue_template_content = ?,
                    solapi_overdue_buttons = ?,
                    solapi_overdue_image_url = ?,
                    solapi_overdue_auto_enabled = ?,
                    solapi_overdue_auto_hour = ?,
                    template_code = ?,
                    template_content = ?,
                    is_enabled = ?,
                    solapi_enabled = ?,
                    solapi_auto_enabled = ?,
                    solapi_auto_hour = ?,
                    sens_auto_enabled = ?,
                    sens_auto_hour = ?,
                    sens_buttons = ?,
                    sens_image_url = ?,
                    sens_consultation_template_code = ?,
                    sens_consultation_template_content = ?,
                    sens_consultation_buttons = ?,
                    sens_consultation_image_url = ?,
                    sens_trial_template_code = ?,
                    sens_trial_template_content = ?,
                    sens_trial_buttons = ?,
                    sens_trial_image_url = ?,
                    sens_trial_auto_enabled = ?,
                    sens_trial_auto_hour = ?,
                    sens_overdue_template_code = ?,
                    sens_overdue_template_content = ?,
                    sens_overdue_buttons = ?,
                    sens_overdue_image_url = ?,
                    sens_overdue_auto_enabled = ?,
                    sens_overdue_auto_hour = ?,
                    solapi_reminder_template_id = ?,
                    solapi_reminder_template_content = ?,
                    solapi_reminder_buttons = ?,
                    solapi_reminder_image_url = ?,
                    solapi_reminder_auto_enabled = ?,
                    solapi_reminder_hours = ?,
                    sens_reminder_template_code = ?,
                    sens_reminder_template_content = ?,
                    sens_reminder_buttons = ?,
                    sens_reminder_image_url = ?,
                    sens_reminder_auto_enabled = ?,
                    sens_reminder_hours = ?
                WHERE academy_id = ?`,
                [
                    service_type || 'sens',
                    naver_access_key || null,
                    encryptedSecret,
                    naver_service_id || null,
                    sms_service_id || null,
                    kakao_channel_id || null,
                    solapi_api_key || null,
                    encryptedSolapiSecret,
                    solapi_pfid || null,
                    solapi_sender_phone || null,
                    solapi_template_id || null,
                    solapi_template_content || null,
                    solapi_buttons ? JSON.stringify(solapi_buttons) : null,
                    solapi_image_url || null,
                    solapi_consultation_template_id || null,
                    solapi_consultation_template_content || null,
                    solapi_consultation_buttons ? JSON.stringify(solapi_consultation_buttons) : null,
                    solapi_consultation_image_url || null,
                    solapi_trial_template_id || null,
                    solapi_trial_template_content || null,
                    solapi_trial_buttons ? JSON.stringify(solapi_trial_buttons) : null,
                    solapi_trial_image_url || null,
                    solapi_trial_auto_enabled || false,
                    solapi_trial_auto_hour ?? 9,
                    solapi_overdue_template_id || null,
                    solapi_overdue_template_content || null,
                    solapi_overdue_buttons ? JSON.stringify(solapi_overdue_buttons) : null,
                    solapi_overdue_image_url || null,
                    solapi_overdue_auto_enabled || false,
                    solapi_overdue_auto_hour ?? 9,
                    template_code || null,
                    template_content || null,
                    is_enabled || false,
                    solapi_enabled || false,
                    solapi_auto_enabled || false,
                    solapi_auto_hour ?? 10,
                    // SENS 새 필드
                    sens_auto_enabled || false,
                    sens_auto_hour ?? 10,
                    sens_buttons ? JSON.stringify(sens_buttons) : null,
                    sens_image_url || null,
                    sens_consultation_template_code || null,
                    sens_consultation_template_content || null,
                    sens_consultation_buttons ? JSON.stringify(sens_consultation_buttons) : null,
                    sens_consultation_image_url || null,
                    sens_trial_template_code || null,
                    sens_trial_template_content || null,
                    sens_trial_buttons ? JSON.stringify(sens_trial_buttons) : null,
                    sens_trial_image_url || null,
                    sens_trial_auto_enabled || false,
                    sens_trial_auto_hour ?? 9,
                    sens_overdue_template_code || null,
                    sens_overdue_template_content || null,
                    sens_overdue_buttons ? JSON.stringify(sens_overdue_buttons) : null,
                    sens_overdue_image_url || null,
                    sens_overdue_auto_enabled || false,
                    sens_overdue_auto_hour ?? 9,
                    // Reminder 필드
                    solapi_reminder_template_id || null,
                    solapi_reminder_template_content || null,
                    solapi_reminder_buttons ? JSON.stringify(solapi_reminder_buttons) : null,
                    solapi_reminder_image_url || null,
                    solapi_reminder_auto_enabled || false,
                    solapi_reminder_hours ?? 1,
                    sens_reminder_template_code || null,
                    sens_reminder_template_content || null,
                    sens_reminder_buttons ? JSON.stringify(sens_reminder_buttons) : null,
                    sens_reminder_image_url || null,
                    sens_reminder_auto_enabled || false,
                    sens_reminder_hours ?? 1,
                    req.user.academyId
                ]
            );
        }

        res.json({
            message: '알림 설정이 저장되었습니다.',
            success: true
        });
    } catch (error) {
        logger.error('알림 설정 저장 오류:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '알림 설정 저장에 실패했습니다.'
        });
    }
});

};
