/**
 * SENS 오늘 수업 미납자 자동발송 webhook.
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
const { remainingAmountSql, dueUnpaidSql } = require('../../../utils/paymentAmountSql');

module.exports = function(router) {
    router.post('/send-unpaid-today-auto-sens', async (req, res) => {
        try {
            if (!assertWebhookApiKey(req, res)) return;

            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const currentHour = koreaTime.getHours();
            const dayOfWeek = koreaTime.getDay();
            const yearMonth = `${koreaTime.getFullYear()}-${String(koreaTime.getMonth() + 1).padStart(2, '0')}`;
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

            logger.info(`[SENS 자동발송] 시작 - ${koreaTime.toISOString()}, 현재 시간: ${currentHour}시, 오늘: ${dayNames[dayOfWeek]}요일`);

            const [academySettings] = await pool.execute(
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
                    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                        logger.info(`[SENS 자동발송] ${setting.academy_name}: SENS 설정 미완료`);
                        continue;
                    }

                    const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                    if (!decryptedSecret) {
                        logger.info(`[SENS 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                        continue;
                    }

                    const [unpaidStudentsRaw] = await pool.execute(
                        `SELECT DISTINCT s.id, s.name, s.phone, s.parent_phone, s.class_days,
                                p.id as payment_id,
                                ${remainingAmountSql('p')} as amount,
                                COALESCE(p.paid_amount, 0) as paid_amount,
                                p.year_month,
                                (SELECT COUNT(*) FROM notification_logs nl
                                 WHERE nl.academy_id = s.academy_id
                                   AND nl.payment_id = p.id
                                   AND nl.status = 'sent') as sent_count
                         FROM students s
                         JOIN student_payments p ON s.id = p.student_id
                         WHERE s.academy_id = ?
                           AND s.status = 'active'
                           AND s.deleted_at IS NULL
                           AND p.payment_status IN ('pending', 'partial')
                           AND ${dueUnpaidSql('p')}
                           AND ${remainingAmountSql('p')} > 0
                           AND p.year_month = ?
                           AND (
                               JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                               OR JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                           )
                           AND (s.parent_phone IS NOT NULL OR s.phone IS NOT NULL)
                         ORDER BY s.name`,
                        [setting.academy_id, yearMonth, JSON.stringify(dayOfWeek), JSON.stringify({day: dayOfWeek})]
                    );

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
                        const studentName = student.name || '';
                        const studentPhone = student.phone || '';
                        const parentPhone = student.parent_phone || '';
                        const recipientPhone = isValidPhoneNumber(parentPhone) ? parentPhone : studentPhone;

                        if (!recipientPhone || !isValidPhoneNumber(recipientPhone)) {
                            logger.info(`[SENS 자동발송] ${studentName}: 유효한 전화번호 없음`);
                            continue;
                        }

                        const isFirstSend = student.sent_count === 0;
                        let templateCode, templateContent, templateButtons;

                        if (isFirstSend) {
                            templateCode = setting.template_code;
                            templateContent = setting.template_content;
                            templateButtons = setting.sens_buttons;
                        } else {
                            if (!setting.sens_overdue_auto_enabled) continue;
                            templateCode = setting.sens_overdue_template_code;
                            templateContent = setting.sens_overdue_template_content;
                            templateButtons = setting.sens_overdue_buttons;
                        }

                        if (!templateCode) continue;

                        const monthFromYearMonth = student.year_month ? student.year_month.split('-')[1].replace(/^0/, '') : String(koreaTime.getMonth() + 1);
                        const dateStr = `${koreaTime.getMonth() + 1}월 ${koreaTime.getDate()}일`;
                        let content = templateContent || '';
                        content = content
                            .replace(/#{이름}/g, studentName)
                            .replace(/#{월}/g, monthFromYearMonth)
                            .replace(/#{교육비}/g, Math.floor(Number(student.amount)).toLocaleString())
                            .replace(/#{날짜}/g, dateStr)
                            .replace(/#{학원명}/g, setting.academy_name)
                            .replace(/#{학원전화}/g, setting.academy_phone || '');

                        let buttons = null;
                        if (templateButtons) {
                            try {
                                buttons = typeof templateButtons === 'string' ? JSON.parse(templateButtons) : templateButtons;
                            } catch {}
                        }

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
                            await pool.execute(
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
};
