/**
 * SENS 상담 리마인드 자동발송 webhook.
 */

const {
    pool,
    decryptApiKey,
    sendAlimtalk,
    decrypt,
    ENCRYPTION_KEY,
    assertWebhookApiKey,
    logger,
} = require('./_utils');

module.exports = function(router) {
    router.post('/send-reminder-auto-sens', async (req, res) => {
        try {
            if (!assertWebhookApiKey(req, res)) return;

            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

            logger.info(`[SENS 리마인드 자동발송] 시작 - ${koreaTime.toISOString()}`);

            const [academySettings] = await pool.execute(
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
                    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                        logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: SENS 설정 미완료`);
                        continue;
                    }

                    if (!setting.sens_reminder_template_code) {
                        logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: 리마인드 템플릿 미설정`);
                        continue;
                    }

                    const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                    if (!decryptedSecret) {
                        logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                        continue;
                    }

                    const reminderHours = setting.sens_reminder_hours || 1;
                    const targetTime = new Date(koreaTime.getTime() + reminderHours * 60 * 60 * 1000);
                    const targetDateStr = targetTime.toISOString().split('T')[0];
                    const targetHour = targetTime.getHours();

                    const [consultationsRaw] = await pool.execute(
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

                        const schedDate = new Date(consultation.preferred_date);
                        const dateStr = `${schedDate.getMonth() + 1}월 ${schedDate.getDate()}일`;
                        const timeStr = consultation.preferred_time ? consultation.preferred_time.slice(0, 5) : '';
                        let content = setting.sens_reminder_template_content || '';
                        content = content
                            .replace(/#{이름}/g, recipientName)
                            .replace(/#{날짜}/g, dateStr)
                            .replace(/#{시간}/g, timeStr)
                            .replace(/#{남은시간}/g, remainingTimeText)
                            .replace(/#{예약번호}/g, consultation.reservation_number || '')
                            .replace(/#{학원명}/g, setting.academy_name || '')
                            .replace(/#{학원전화}/g, setting.academy_phone || '');

                        let buttons = null;
                        if (setting.sens_reminder_buttons) {
                            try {
                                buttons = JSON.parse(setting.sens_reminder_buttons);
                            } catch {}
                        }

                        const result = await sendAlimtalk(
                            {
                                naver_access_key: setting.naver_access_key,
                                naver_secret_key: decryptedSecret,
                                naver_service_id: setting.naver_service_id,
                                kakao_channel_id: setting.kakao_channel_id
                            },
                            setting.sens_reminder_template_code,
                            [{ phone: recipientPhone, content, buttons, imageUrl: setting.sens_reminder_image_url || null }]
                        );

                        if (result.success) {
                            sentCount++;
                            await pool.execute(
                                `UPDATE consultations SET reminder_alimtalk_sent_at = NOW() WHERE id = ? AND academy_id = ?`,
                                [consultation.consultation_id, setting.academy_id]
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
