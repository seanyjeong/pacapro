/**
 * routes/notifications/send/webhooks.js
 *
 * ⚠️ verifyToken 무적용 webhook endpoint 4건 (X-API-Key 헤더 자체 검증).
 *
 * - POST /send-unpaid-today-auto-sens : SENS 채널 — 오늘 수업 있는 미납자 자동발송
 * - POST /send-trial-today-auto-sens  : SENS 채널 — 오늘 체험수업 학생 자동발송
 * - POST /send-reminder-auto          : 솔라피 채널 — 상담 리마인드 자동발송
 * - POST /send-reminder-auto-sens     : SENS 채널 — 상담 리마인드 자동발송
 *
 * 인증: 본 모듈 endpoint 4건은 모두 **`verifyToken` 미적용 + `assertWebhookApiKey`
 *  헬퍼로 X-API-Key 검증** 패턴이다.
 *  - 외부 시스템 (Solapi webhook, n8n, cron) 이 service account 토큰 없이 호출하므로
 *    JWT 토큰 검증을 우회한다.
 *  - 부모 진입점 (`notifications/index.js`, `notifications/send/index.js`) 에
 *    `router.use(verifyToken)` 같은 광역 미들웨어를 추가하면 4건 모두 401 break →
 *    자동발송 중단 (학원 미납자/체험수업/상담 리마인드 모두 끊김).
 *  - ADR-014 mount-only 진입점 정책 + ADR-007 보안 영역 미수정 정책에 따라
 *    인증 모델 변경은 사장님 별도 컨펌 필수.
 *
 * 리팩 노트 (Phase 3 #3, ADR-005 / ADR-003 / ADR-013 / ADR-007):
 *  - DB 호출 `db.query` (8건) → `pool.execute` 통일 (ADR-005). IN 절 없음 (ADR-016 무관).
 *  - 응답 표면 (ADR-013): `{message, results}` (4건 공통) + endpoint 별 results 항목 셰이프
 *    (`{academy, sent, failed}` / `{academy, targetTime, total, sent, failed}` /
 *    `{academy, error}`) 1:1 보존.
 *  - 보안 헬퍼 (`decryptApiKey` / `sendAlimtalk` / `sendAlimtalkSolapi`) 시그니처 100% 무변경 (ADR-007).
 *  - **원본 동작 보존 (ADR-013)**: send-trial-today-auto-sens 의 1213-1215 라인은 원본 코드에
 *    정의되지 않은 `decryptField` 함수를 호출하여 try-catch 의 catch 블록으로 떨어진다 (잠재 ReferenceError).
 *    원본 동작 100% 보존 정책에 따라 본 분리에서도 `decryptField` 호출을 그대로 유지한다.
 *    버그 수정은 별도 트랙 (응답 표면 표준화 트랙 또는 학생명 복호화 일관화 트랙) 에서 진행.
 */

const {
    pool,
    decryptApiKey,
    sendAlimtalk,
    sendAlimtalkSolapi,
    isValidPhoneNumber,
    decrypt,
    decryptStudentArray,
    ENCRYPTION_KEY,
    assertWebhookApiKey,
    logger,
} = require('./_utils');

module.exports = function(router) {

    /**
     * POST /paca/notifications/send-unpaid-today-auto-sens
     * SENS 납부안내/미납자 자동발송 (수업 있는 날 기준).
     * Access: n8n (X-API-Key 헤더 검증). verifyToken 미적용.
     */
    router.post('/send-unpaid-today-auto-sens', async (req, res) => {
        try {
            // X-API-Key 검증 (verifyToken 무적용 webhook endpoint)
            if (!assertWebhookApiKey(req, res)) return;

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
                    // SENS 설정 확인
                    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                        logger.info(`[SENS 자동발송] ${setting.academy_name}: SENS 설정 미완료`);
                        continue;
                    }

                    // Secret 복호화 (ADR-007 시그니처 보존)
                    const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                    if (!decryptedSecret) {
                        logger.info(`[SENS 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                        continue;
                    }

                    // 오늘 수업이 있는 미납 학생 조회
                    const [unpaidStudentsRaw] = await pool.execute(
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
                        // 이미 decryptStudentArray 로 복호화됨
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

                        // SENS 알림톡 발송 (ADR-007 시그니처 보존)
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

    /**
     * POST /paca/notifications/send-trial-today-auto-sens
     * SENS 체험수업 자동발송 (수업 있는 날 기준).
     * Access: n8n (X-API-Key 헤더 검증). verifyToken 미적용.
     *
     * ⚠️ 원본 코드 보존 (ADR-013): 학생명/전화번호 복호화에 미정의 함수 `decryptField` 를
     *  호출하여 학생당 try-catch 의 catch 블록으로 떨어진다. 본 분리에서는 원본 동작을
     *  100% 보존하므로 호출도 그대로 유지한다. 버그 수정은 별도 트랙에서.
     */
    router.post('/send-trial-today-auto-sens', async (req, res) => {
        try {
            // X-API-Key 검증 (verifyToken 무적용 webhook endpoint)
            if (!assertWebhookApiKey(req, res)) return;

            const now = new Date();
            const currentHour = now.getHours();
            const todayStr = now.toISOString().split('T')[0]; // YYYY-MM-DD

            logger.info(`[SENS 체험수업 자동발송] 시작 - ${now.toISOString()}, 현재 시간: ${currentHour}시`);

            // 현재 시간에 발송 설정된 학원들 조회
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
                    // SENS 설정 확인
                    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                        continue;
                    }

                    if (!setting.sens_trial_template_code) {
                        continue;
                    }

                    // Secret 복호화 (ADR-007 시그니처 보존)
                    const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
                    if (!decryptedSecret) continue;

                    // 오늘 체험수업이 있는 학생 조회
                    const [trialStudents] = await pool.execute(
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
                        // ⚠️ 원본 코드 보존 (ADR-013): `decryptField` 는 본 모듈 / `_utils` 어디에도
                        //   정의되어 있지 않다. 학생당 호출 시 ReferenceError → catch 블록으로 떨어져
                        //   해당 학생만 skip 되고 다음 학생으로 진행된다. 원본 동작 100% 보존.
                        let studentName, parentPhone, studentPhone;
                        try {
                            studentName = student.name ? decryptField(student.name, ENCRYPTION_KEY) : '';
                            parentPhone = student.parent_phone ? decryptField(student.parent_phone, ENCRYPTION_KEY) : '';
                            studentPhone = student.phone ? decryptField(student.phone, ENCRYPTION_KEY) : '';
                        } catch (decryptErr) {
                            // 원본 코드는 학생 단위 try-catch 가 없어 학원 단위 catch 로 떨어졌으나,
                            // 동일 동작을 위해 본 분리에서도 학생 처리는 학원 catch 로 위임 → 재 throw.
                            throw decryptErr;
                        }

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

                        // SENS 알림톡 발송 (ADR-007 시그니처 보존)
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

    /**
     * POST /paca/notifications/send-reminder-auto
     * 솔라피 상담 리마인드 자동발송 (n8n 용).
     * Access: n8n (X-API-Key 헤더 검증). verifyToken 미적용.
     */
    router.post('/send-reminder-auto', async (req, res) => {
        try {
            // X-API-Key 검증 (verifyToken 무적용 webhook endpoint)
            if (!assertWebhookApiKey(req, res)) return;

            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

            logger.info(`[Solapi 리마인드 자동발송] 시작 - ${koreaTime.toISOString()}`);

            // 리마인드 자동발송이 활성화된 학원들 조회
            const [academySettings] = await pool.execute(
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

                    // Secret 복호화 (ADR-007 시그니처 보존)
                    const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
                    if (!decryptedSecret) {
                        logger.info(`[Solapi 리마인드 자동발송] ${setting.academy_name}: Secret 복호화 실패`);
                        continue;
                    }

                    const reminderHours = setting.solapi_reminder_hours || 1;

                    // 현재 시간 + reminderHours 시간대의 상담 조회
                    const targetTime = new Date(koreaTime.getTime() + reminderHours * 60 * 60 * 1000);
                    const targetDateStr = targetTime.toISOString().split('T')[0]; // YYYY-MM-DD
                    const targetHour = targetTime.getHours();

                    // 해당 시간대 상담 조회 (confirmed 상태, 아직 리마인드 안 보낸 건)
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

                    // 복호화 (ADR-007 시그니처 보존)
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

                        // 발송 (ADR-007 시그니처 보존)
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
                            await pool.execute(
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
     * SENS 상담 리마인드 자동발송 (n8n 용).
     * Access: n8n (X-API-Key 헤더 검증). verifyToken 미적용.
     */
    router.post('/send-reminder-auto-sens', async (req, res) => {
        try {
            // X-API-Key 검증 (verifyToken 무적용 webhook endpoint)
            if (!assertWebhookApiKey(req, res)) return;

            const now = new Date();
            const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

            logger.info(`[SENS 리마인드 자동발송] 시작 - ${koreaTime.toISOString()}`);

            // 리마인드 자동발송이 활성화된 학원들 조회
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
                    // SENS 설정 확인
                    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
                        logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: SENS 설정 미완료`);
                        continue;
                    }

                    if (!setting.sens_reminder_template_code) {
                        logger.info(`[SENS 리마인드 자동발송] ${setting.academy_name}: 리마인드 템플릿 미설정`);
                        continue;
                    }

                    // Secret 복호화 (ADR-007 시그니처 보존)
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

                    // 복호화 (ADR-007 시그니처 보존)
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

                        // 발송 (ADR-007 시그니처 보존)
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
                            await pool.execute(
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
