/**
 * SENS 체험수업 자동발송 webhook.
 */

const {
    pool,
    decryptApiKey,
    sendAlimtalk,
    isValidPhoneNumber,
    decryptStudentArray,
    ENCRYPTION_KEY,
    assertWebhookApiKey,
    logger,
} = require('./_utils');

module.exports = function(router) {
    router.post('/send-trial-today-auto-sens', async (req, res) => {
        try {
            if (!assertWebhookApiKey(req, res)) return;

            const now = new Date();
            const currentHour = now.getHours();
            const todayStr = now.toISOString().split('T')[0];

            logger.info(`[SENS 체험수업 자동발송] 시작 - ${now.toISOString()}, 현재 시간: ${currentHour}시`);

            const [academySettings] = await pool.execute(
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
                    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) continue;
                    if (!setting.sens_trial_template_code) continue;

                    const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                    if (!decryptedSecret) continue;

                    const [trialStudentsRaw] = await pool.execute(
                        `SELECT s.id, s.name, s.phone, s.parent_phone, s.trial_dates
                         FROM students s
                         WHERE s.academy_id = ?
                           AND s.status = 'trial'
                           AND s.trial_dates IS NOT NULL
                           AND JSON_SEARCH(s.trial_dates, 'one', ?, NULL, '$[*].date') IS NOT NULL`,
                        [setting.academy_id, todayStr]
                    );
                    const trialStudents = decryptStudentArray(trialStudentsRaw);

                    logger.info(`[SENS 체험수업 자동발송] ${setting.academy_name}: 오늘 체험 ${trialStudents.length}명`);

                    let sentCount = 0;
                    let failCount = 0;

                    for (const student of trialStudents) {
                        const studentName = student.name || '';
                        const parentPhone = student.parent_phone || '';
                        const studentPhone = student.phone || '';

                        const recipientPhone = parentPhone || studentPhone;
                        if (!recipientPhone || !isValidPhoneNumber(recipientPhone)) continue;

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
                            } catch {}
                        }

                        let content = setting.sens_trial_template_content || '';
                        content = content
                            .replace(/#{이름}/g, studentName)
                            .replace(/#{학원명}/g, setting.academy_name)
                            .replace(/#{체험일정}/g, trialSchedule);

                        let buttons = null;
                        if (setting.sens_trial_buttons) {
                            try {
                                buttons = typeof setting.sens_trial_buttons === 'string'
                                    ? JSON.parse(setting.sens_trial_buttons)
                                    : setting.sens_trial_buttons;
                            } catch {}
                        }

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
                            await pool.execute(
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
};
