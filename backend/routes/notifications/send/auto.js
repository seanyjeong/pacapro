/**
 * routes/notifications/send/auto.js
 *
 * n8n 매시간 호출 자동 발송 endpoint 2건 (verifyToken 만 적용, X-API-Key 미적용).
 *  - POST /send-unpaid-today-auto : 솔라피 채널 — 오늘 수업 있는 미납자 일괄 발송
 *  - POST /send-trial-today-auto  : 솔라피 채널 — 오늘 체험수업 있는 학생 일괄 발송
 *
 * 인증: `verifyToken`
 *  - n8n service account 토큰으로 호출. checkPermission 미적용 (자동발송 권한 = 토큰 보유).
 *
 * 리팩 노트 (Phase 3 #3, ADR-005 / ADR-003 / ADR-013 / ADR-016):
 *  - DB 호출 `db.query` (10건) → `pool.execute` 통일 (ADR-005).
 *  - **ADR-016 IN 절 자리표시자 명시 전개**: send-unpaid-today-auto 의 학생별 기존 알림
 *    조회 SELECT 의 `student_id IN (?)` 자동 펼침 의존을 명시 전개로 교체. 빈 배열일 땐
 *    SQL 자체를 호출하지 않도록 가드 (mysql2 prepared statement 는 빈 IN 절 허용 X).
 *  - 사용자 노출 메시지 한국어 (ADR-003). 단, 자동발송 응답의 `error` 필드는 운영자/cron 로그용
 *    이라 한국어 (`details: error.message` 5xx 1건은 cron 디버깅용 의도, 원본 보존).
 *  - 응답 표면 (ADR-013): `{message, current_hour, academies_processed, total_sent, total_failed,
 *    date, day_name, results: [{academy_id, academy_name, sent, failed, skipped, error, students?}]}`
 *    및 빈 학원일 때의 단순 응답 (`{message, current_hour, academies_processed:0}`) 1:1 보존.
 *  - 보안 헬퍼 (`decryptApiKey` / `sendAlimtalkSolapi`) 시그니처 100% 무변경 (ADR-007).
 */

const {
    pool,
    verifyToken,
    decryptApiKey,
    sendAlimtalkSolapi,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    decryptStudentArray,
    ENCRYPTION_KEY,
    logger,
} = require('./_utils');

module.exports = function(router) {

    /**
     * POST /paca/notifications/send-unpaid-today-auto
     * 솔라피 자동발송 — 현재 시간 + 오늘 수업 있는 미납자.
     * Access: n8n service account (verifyToken).
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
                    // 솔라피 Secret 복호화 (ADR-007 시그니처 보존)
                    const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                    if (!decryptedSolapiSecret) {
                        academyResult.skipped = true;
                        academyResult.error = '솔라피 API Secret 복호화 실패';
                        results.push(academyResult);
                        continue;
                    }

                    // 오늘 수업이 있는 미납자 조회
                    const [unpaidPaymentsRaw] = await pool.execute(
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
                    // ADR-016: pool.execute 의 IN 절은 자리표시자 N개로 명시 전개.
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

                    // 첫 수업일 (납부 안내) vs 두 번째 수업일 이후 (미납자) 분류
                    const firstTimeRecipients = validRecipients.filter(p => !studentsWithPriorNotification.has(p.student_id));
                    const repeatRecipients = validRecipients.filter(p => studentsWithPriorNotification.has(p.student_id));

                    // 납부 안내 템플릿 (첫 수업일)
                    const noticeTemplateContent = setting.solapi_template_content || setting.template_content;
                    const noticeTemplateCode = setting.solapi_template_id;

                    // 미납자 템플릿 (두 번째 수업일 이후)
                    const overdueTemplateContent = setting.solapi_overdue_template_content || noticeTemplateContent;
                    const overdueTemplateCode = setting.solapi_overdue_template_id || noticeTemplateCode;

                    // 발송 함수 (학원별 클로저 — decryptedSolapiSecret / setting / academyId / academyResult 캡처)
                    const sendAndLog = async (recipients, templateCode, templateContent /* eslint-disable-next-line no-unused-vars */, templateType) => {
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
            // 원본 보존: 자동발송 5xx 는 cron/n8n 디버깅용 details: error.message 포함 (ADR-013).
            res.status(500).json({
                error: 'Server Error',
                message: '자동발송 처리에 실패했습니다.',
                details: error.message
            });
        }
    });

    /**
     * POST /paca/notifications/send-trial-today-auto
     * 체험수업 자동발송 — 현재 시간 + 오늘 체험수업 학생.
     * Access: n8n service account (verifyToken).
     */
    router.post('/send-trial-today-auto', verifyToken, async (req, res) => {
        try {
            // 현재 시간 (한국 시간)
            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
            const currentHour = koreaTime.getHours();
            const todayStr = koreaTime.toISOString().split('T')[0];
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

            logger.info(`[체험수업 자동발송] ${todayStr} ${currentHour}시 시작`);

            // 현재 시간에 발송 설정된 학원들 조회
            const [academySettings] = await pool.execute(
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
                    const decryptedSolapiSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                    if (!decryptedSolapiSecret) {
                        academyResult.skipped = true;
                        academyResult.error = '솔라피 API Secret 복호화 실패';
                        results.push(academyResult);
                        continue;
                    }

                    if (!setting.solapi_trial_template_id) {
                        academyResult.skipped = true;
                        academyResult.error = '체험수업 템플릿 ID 미설정';
                        results.push(academyResult);
                        continue;
                    }

                    // 오늘 체험수업이 있는 체험생 조회
                    const [trialStudentsRaw] = await pool.execute(
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

                    const imageUrl = setting.solapi_trial_image_url || null;

                    const recipients = validRecipients.map(s => {
                        // 체험일정 문자열 생성
                        let scheduleText = '';
                        try {
                            let trialDates = s.trial_dates;
                            if (typeof trialDates === 'string') {
                                trialDates = JSON.parse(trialDates);
                            }
                            if (!Array.isArray(trialDates)) {
                                trialDates = [];
                            }

                            scheduleText = trialDates.map((item, idx) => {
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

                    // 솔라피 알림톡 발송 (학원별 API 키 사용, ADR-007 시그니처 보존)
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
                        await pool.execute(
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

};
