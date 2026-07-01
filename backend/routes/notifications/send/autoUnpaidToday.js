/**
 * 솔라피 오늘 수업 미납자 자동발송.
 */

const {
    pool,
    verifyNotificationAutomation,
    decryptApiKey,
    sendAlimtalkSolapi,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    decryptStudentArray,
    ENCRYPTION_KEY,
    logger,
} = require('./_utils');
const { remainingAmountSql, dueUnpaidSql } = require('../../../utils/paymentAmountSql');

module.exports = function(router) {
    router.post('/send-unpaid-today-auto', verifyNotificationAutomation, async (req, res) => {
        try {
            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const currentHour = koreaTime.getHours();
            const dayOfWeek = koreaTime.getDay();
            const year = koreaTime.getFullYear();
            const month = koreaTime.getMonth() + 1;
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const dayNames = ['일','월','화','수','목','금','토'];

            const [academySettings] = await pool.execute(
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
                    const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                    if (!decryptedSolapiSecret) {
                        academyResult.skipped = true;
                        academyResult.error = '솔라피 API Secret 복호화 실패';
                        results.push(academyResult);
                        continue;
                    }

                    const [unpaidPaymentsRaw] = await pool.execute(
                        `SELECT
                            p.id AS payment_id,
                            ${remainingAmountSql('p')} AS amount,
                            COALESCE(p.paid_amount, 0) AS paid_amount,
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
                        AND ${dueUnpaidSql('p')}
                        AND ${remainingAmountSql('p')} > 0
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

                    const unpaidPayments = decryptStudentArray(unpaidPaymentsRaw);

                    if (unpaidPayments.length === 0) {
                        academyResult.skipped = true;
                        academyResult.error = '오늘 수업 있는 미납자 없음';
                        results.push(academyResult);
                        continue;
                    }

                    const dueDayText = `${setting.tuition_due_day || 1}일`;
                    const validRecipients = unpaidPayments
                        .filter(p => {
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

                    logger.info(`[솔라피 자동발송] ${setting.academy_name}: 발송 대상 ${validRecipients.length}명 - ${validRecipients.map(p => `${p.student_id}(pid:${p.payment_id})`).join(', ')}`);

                    const studentIds = validRecipients.map(p => p.student_id);
                    const idPlaceholders = studentIds.map(() => '?').join(',');
                    const [existingLogs] = await pool.execute(
                        `SELECT DISTINCT student_id FROM notification_logs
                         WHERE academy_id = ? AND student_id IN (${idPlaceholders})
                         AND YEAR(sent_at) = ? AND MONTH(sent_at) = ?
                         AND status = 'sent'`,
                        [academyId, ...studentIds, year, month]
                    );
                    const studentsWithPriorNotification = new Set(existingLogs.map(l => l.student_id));

                    const firstTimeRecipients = validRecipients.filter(p => !studentsWithPriorNotification.has(p.student_id));
                    const repeatRecipients = validRecipients.filter(p => studentsWithPriorNotification.has(p.student_id));
                    const noticeTemplateContent = setting.solapi_template_content || setting.template_content;
                    const noticeTemplateCode = setting.solapi_template_id;
                    const overdueTemplateContent = setting.solapi_overdue_template_content || noticeTemplateContent;
                    const overdueTemplateCode = setting.solapi_overdue_template_id || noticeTemplateCode;

                    const sendAndLog = async (recipients, templateCode, templateContent) => {
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

                        for (const recipient of messages) {
                            await pool.execute(
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

                    if (firstTimeRecipients.length > 0 && noticeTemplateCode) {
                        await sendAndLog(firstTimeRecipients, noticeTemplateCode, noticeTemplateContent);
                    }

                    if (repeatRecipients.length > 0 && overdueTemplateCode && setting.solapi_overdue_auto_enabled) {
                        await sendAndLog(repeatRecipients, overdueTemplateCode, overdueTemplateContent);
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
};
