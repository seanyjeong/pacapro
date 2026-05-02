/**
 * routes/notifications/test/solapi.js
 *
 * 솔라피 (Solapi) 채널 테스트 발송 sub-라우터 (Phase 3 #1).
 *  - 4 endpoint: 상담확정 / 체험수업 / 미납자 / 리마인드.
 *  - 모두 솔라피 단일 채널 (sendAlimtalkSolapi).
 *  - 상담확정 / 체험수업 / 미납자: 발송 성공 시 notification_logs 'sent' 1건 INSERT.
 *  - 리마인드: 로그 INSERT 없음 (원본 동작 보존).
 *
 * 응답 표면 (ADR-013 보존):
 *  - 성공 (4건 모두): `{ message: string, success: true, groupId?: string|null }`
 *    * 리마인드만 success/message 순서가 반대 (원본 보존: `{ success: true, message: ... }`)
 *      → JSON 객체 키 순서는 클라이언트 소비에 영향 없음.
 *  - 발송 실패 (400):
 *    * 상담확정 / 체험수업 / 미납자: `{ error: 'Send Failed', message, details }` (details = result)
 *    * 리마인드: `{ error: 'Send Error', message, details }` (원본 보존)
 *  - 5xx: `{ error: 'Server Error', message }`
 *
 * 보안 영역 (ADR-007):
 *  - decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY) 시그니처 무변경.
 *  - sendAlimtalkSolapi 첫 인자 객체 셰이프 (api_key/api_secret/pfid/sender_phone) 무변경.
 */

const {
    verifyToken,
    checkPermission,
    sendAlimtalkSolapi,
    logger,
} = require('../_utils');

const {
    requirePhone,
    loadSettings,
    ensureSolapiConfigured,
    ensureTemplateId,
    decryptSolapiSecretOrFail,
    fetchAcademy,
    replaceTemplateVars,
    parseButtons,
    logSent,
    respondSendFailed,
    respondServerError,
} = require('./_utils');

module.exports = function (router) {
    /**
     * POST /paca/notifications/test-consultation
     * 솔라피 — 상담확정 알림톡 테스트 발송 (3일 후 14:00 가짜 예약 데이터).
     *  - 버튼 링크에도 #{이름}/#{날짜}/#{시간}/#{예약번호} 변수 치환 적용.
     */
    router.post('/test-consultation', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSolapiConfigured(setting, res)) return;
            if (!ensureTemplateId(setting.solapi_consultation_template_id, res, '상담확정 템플릿 ID')) return;

            const decryptedSecret = decryptSolapiSecretOrFail(setting, res);
            if (!decryptedSecret) return;

            // 테스트 데이터로 메시지 생성 (3일 후 14:00, 가짜 예약번호)
            const testDate = new Date();
            testDate.setDate(testDate.getDate() + 3);
            const dateStr = `${testDate.getMonth() + 1}월 ${testDate.getDate()}일`;
            const timeStr = '14:00';
            const testReservationNumber = 'TEST001';

            const vars = {
                '이름': '테스트학생',
                '날짜': dateStr,
                '시간': timeStr,
                '예약번호': testReservationNumber,
            };
            const content = replaceTemplateVars(setting.solapi_consultation_template_content || '', vars);
            const buttons = parseButtons(setting.solapi_consultation_buttons, vars);
            const imageUrl = setting.solapi_consultation_image_url || null;

            const result = await sendAlimtalkSolapi(
                {
                    solapi_api_key: setting.solapi_api_key,
                    solapi_api_secret: decryptedSecret,
                    solapi_pfid: setting.solapi_pfid,
                    solapi_sender_phone: setting.solapi_sender_phone,
                },
                setting.solapi_consultation_template_id,
                [{ phone, content, buttons, imageUrl }]
            );

            if (result.success) {
                await logSent({
                    academyId: req.user.academyId,
                    recipientName: '테스트(상담확정)',
                    recipientPhone: phone,
                    templateCode: setting.solapi_consultation_template_id,
                    messageContent: content,
                    requestId: result.groupId || null,
                });

                res.json({
                    message: '상담확정 테스트 메시지가 발송되었습니다.',
                    success: true,
                    groupId: result.groupId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: true });
            }
        } catch (error) {
            logger.error('상담확정 테스트 발송 오류:', error);
            respondServerError(res, '테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-trial
     * 솔라피 — 체험수업 알림톡 테스트 발송 (오늘+2일/오늘+4일 가짜 일정).
     *  - 1회차 완료 표시 (`✓ 1회차: ...`) 포함 텍스트.
     */
    router.post('/test-trial', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSolapiConfigured(setting, res)) return;
            if (!ensureTemplateId(setting.solapi_trial_template_id, res, '체험수업 템플릿 ID')) return;

            const decryptedSecret = decryptSolapiSecretOrFail(setting, res);
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '학원';

            // 테스트 체험일정 (오늘+2일, 오늘+4일)
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
            const scheduleText = `✓ 1회차: ${formatDate(date1)} 18:30\n2회차: ${formatDate(date2)} 18:30`;

            const vars = {
                '이름': '테스트학생',
                '학원명': academyName,
                '체험일정': scheduleText,
            };
            const content = replaceTemplateVars(setting.solapi_trial_template_content || '', vars);
            const buttons = parseButtons(setting.solapi_trial_buttons);
            const imageUrl = setting.solapi_trial_image_url || null;

            const result = await sendAlimtalkSolapi(
                {
                    solapi_api_key: setting.solapi_api_key,
                    solapi_api_secret: decryptedSecret,
                    solapi_pfid: setting.solapi_pfid,
                    solapi_sender_phone: setting.solapi_sender_phone,
                },
                setting.solapi_trial_template_id,
                [{ phone, content, buttons, imageUrl }]
            );

            if (result.success) {
                await logSent({
                    academyId: req.user.academyId,
                    recipientName: '테스트(체험수업)',
                    recipientPhone: phone,
                    templateCode: setting.solapi_trial_template_id,
                    messageContent: content,
                    requestId: result.groupId || null,
                });

                res.json({
                    message: '체험수업 테스트 메시지가 발송되었습니다.',
                    success: true,
                    groupId: result.groupId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: true });
            }
        } catch (error) {
            logger.error('체험수업 테스트 발송 오류:', error);
            respondServerError(res, '테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-overdue
     * 솔라피 — 미납자 알림톡 테스트 발송 (당월 / 가짜 금액 300,000 / 10일 납부일).
     */
    router.post('/test-overdue', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSolapiConfigured(setting, res)) return;
            if (!ensureTemplateId(setting.solapi_overdue_template_id, res, '미납자 템플릿 ID')) return;

            const decryptedSecret = decryptSolapiSecretOrFail(setting, res);
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '학원';
            const academyPhone = academy.phone || '';

            const now = new Date();
            const testMonth = now.getMonth() + 1;

            const vars = {
                '이름': '테스트학생',
                '월': String(testMonth),
                '교육비': '300,000',
                '날짜': '10일',
                '학원명': academyName,
                '학원전화': academyPhone,
            };
            const content = replaceTemplateVars(setting.solapi_overdue_template_content || '', vars);
            const buttons = parseButtons(setting.solapi_overdue_buttons);
            const imageUrl = setting.solapi_overdue_image_url || null;

            const result = await sendAlimtalkSolapi(
                {
                    solapi_api_key: setting.solapi_api_key,
                    solapi_api_secret: decryptedSecret,
                    solapi_pfid: setting.solapi_pfid,
                    solapi_sender_phone: setting.solapi_sender_phone,
                },
                setting.solapi_overdue_template_id,
                [{ phone, content, buttons, imageUrl }]
            );

            if (result.success) {
                await logSent({
                    academyId: req.user.academyId,
                    recipientName: '테스트(미납자)',
                    recipientPhone: phone,
                    templateCode: setting.solapi_overdue_template_id,
                    messageContent: content,
                    requestId: result.groupId || null,
                });

                res.json({
                    message: '미납자 테스트 메시지가 발송되었습니다.',
                    success: true,
                    groupId: result.groupId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: true });
            }
        } catch (error) {
            logger.error('미납자 테스트 발송 오류:', error);
            respondServerError(res, '테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-reminder
     * 솔라피 — 상담 리마인드 알림톡 테스트 발송.
     *  - reminderHours (>=24 → "N일", <24 → "N시간") 표기.
     *  - 원본 동작 보존: 리마인드는 notification_logs 기록 X.
     *  - 응답 표면도 원본 보존: `{ success, message }` 순 + 실패 시 `error: 'Send Error'`.
     */
    router.post('/test-reminder', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSolapiConfigured(setting, res)) return;
            if (!ensureTemplateId(setting.solapi_reminder_template_id, res, '리마인드 템플릿 ID')) return;

            const decryptedSecret = decryptSolapiSecretOrFail(setting, res);
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '학원';
            const academyPhone = academy.phone || '';

            const now = new Date();
            const testDate = `${now.getMonth() + 1}월 ${now.getDate()}일`;
            const testTime = '14:00';
            const reminderHours = setting.solapi_reminder_hours || 1;
            const remainingTimeText = reminderHours >= 24
                ? `${Math.floor(reminderHours / 24)}일`
                : `${reminderHours}시간`;

            const vars = {
                '이름': '테스트학생',
                '날짜': testDate,
                '시간': testTime,
                '남은시간': remainingTimeText,
                '예약번호': 'TEST-001',
                '학원명': academyName,
                '학원전화': academyPhone,
            };
            const content = replaceTemplateVars(setting.solapi_reminder_template_content || '', vars);
            const buttons = parseButtons(setting.solapi_reminder_buttons);
            const imageUrl = setting.solapi_reminder_image_url || null;

            const result = await sendAlimtalkSolapi(
                {
                    solapi_api_key: setting.solapi_api_key,
                    solapi_api_secret: decryptedSecret,
                    solapi_pfid: setting.solapi_pfid,
                    solapi_sender_phone: setting.solapi_sender_phone,
                },
                setting.solapi_reminder_template_id,
                [{ phone, content, buttons, imageUrl }]
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: '리마인드 테스트 알림톡이 발송되었습니다.',
                });
            } else {
                res.status(400).json({
                    error: 'Send Error',
                    message: result.message || '알림톡 발송에 실패했습니다.',
                    details: result.details,
                });
            }
        } catch (error) {
            logger.error('리마인드 테스트 발송 오류:', error);
            respondServerError(res, '테스트 발송에 실패했습니다.');
        }
    });
};
