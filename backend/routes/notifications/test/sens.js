/**
 * routes/notifications/test/sens.js
 *
 * 네이버 SENS 채널 테스트 발송 sub-라우터 (Phase 3 #1).
 *  - 4 endpoint: 상담확정 / 체험수업 / 미납자 / 리마인드 (모두 SENS).
 *  - 모두 sendAlimtalk (네이버 SENS) 단일 채널.
 *  - 원본 동작 보존: SENS 테스트 endpoint 4건 모두 notification_logs 기록 X.
 *  - 응답 표면 보존: 4건 모두 `{ message, success: true, requestId }` (성공) /
 *    `{ error: 'Send Failed', message }` (실패, details 없음).
 *  - 리마인드만 응답 표면이 다름:
 *    * 성공: `{ success, message }` (리마인드 솔라피 sub와 동일 패턴)
 *    * 실패: `{ error: 'Send Error', message, details }`
 *
 * 보안 영역 (ADR-007):
 *  - decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY) 시그니처 무변경.
 *  - sendAlimtalk 첫 인자 객체 셰이프 (access_key/secret_key/service_id/kakao_channel_id) 무변경.
 */

const {
    verifyToken,
    checkPermission,
    sendAlimtalk,
    logger,
} = require('../_utils');

const {
    requirePhone,
    loadSettings,
    ensureSensConfigured,
    ensureTemplateCode,
    decryptSensSecretOrFail,
    fetchAcademy,
    replaceTemplateVars,
    parseButtons,
    respondSendFailed,
    respondServerError,
} = require('./_utils');

module.exports = function (router) {
    /**
     * POST /paca/notifications/test-sens-consultation
     * SENS — 상담확정 알림톡 테스트 발송 (3일 후 14:00 가짜 예약 데이터).
     *  - 버튼 링크에도 #{이름}/#{날짜}/#{시간}/#{예약번호} 변수 치환 적용 (솔라피 분기와 동일).
     */
    router.post('/test-sens-consultation', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSensConfigured(setting, res)) return;
            if (!ensureTemplateCode(setting.sens_consultation_template_code, res, '상담확정 템플릿 코드')) return;

            const decryptedSecret = decryptSensSecretOrFail(setting, res, { sensLabel: true });
            if (!decryptedSecret) return;

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
            const content = replaceTemplateVars(setting.sens_consultation_template_content || '', vars);
            const buttons = parseButtons(setting.sens_consultation_buttons, vars);

            const result = await sendAlimtalk(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id,
                },
                setting.sens_consultation_template_code,
                [{ phone, content, buttons }]
            );

            if (result.success) {
                res.json({
                    message: 'SENS 상담확정 테스트 발송 성공',
                    success: true,
                    requestId: result.requestId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: false });
            }
        } catch (error) {
            logger.error('SENS 상담확정 테스트 발송 오류:', error);
            respondServerError(res, 'SENS 상담확정 테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-sens-trial
     * SENS — 체험수업 알림톡 테스트 발송 (오늘/오늘+2일 가짜 일정).
     */
    router.post('/test-sens-trial', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSensConfigured(setting, res)) return;
            if (!ensureTemplateCode(setting.sens_trial_template_code, res, '체험수업 템플릿 코드')) return;

            const decryptedSecret = decryptSensSecretOrFail(setting, res, { sensLabel: true });
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '테스트학원';

            // 원본 동작 보존: getDate()+2 단순 산술 (월말 케이스 미보정).
            const today = new Date();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const trialSchedule = `✓ 1회차: ${today.getMonth() + 1}/${today.getDate()}(${dayNames[today.getDay()]})\n2회차: ${today.getMonth() + 1}/${today.getDate() + 2}(${dayNames[(today.getDay() + 2) % 7]})`;

            const vars = {
                '이름': '테스트학생',
                '학원명': academyName,
                '체험일정': trialSchedule,
            };
            const content = replaceTemplateVars(setting.sens_trial_template_content || '', vars);
            const buttons = parseButtons(setting.sens_trial_buttons);

            const result = await sendAlimtalk(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id,
                },
                setting.sens_trial_template_code,
                [{ phone, content, buttons }]
            );

            if (result.success) {
                res.json({
                    message: 'SENS 체험수업 테스트 발송 성공',
                    success: true,
                    requestId: result.requestId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: false });
            }
        } catch (error) {
            logger.error('SENS 체험수업 테스트 발송 오류:', error);
            respondServerError(res, 'SENS 체험수업 테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-sens-overdue
     * SENS — 미납자 알림톡 테스트 발송.
     *  - 가짜 데이터: 학생='테스트학생', 교육비='500,000', 월=당월, 날짜=당일.
     */
    router.post('/test-sens-overdue', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSensConfigured(setting, res)) return;
            if (!ensureTemplateCode(setting.sens_overdue_template_code, res, '미납자 템플릿 코드')) return;

            const decryptedSecret = decryptSensSecretOrFail(setting, res, { sensLabel: true });
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '테스트학원';
            const academyPhone = academy.phone || '02-1234-5678';

            const today = new Date();
            const monthStr = `${today.getMonth() + 1}`;
            const dateStr = `${today.getMonth() + 1}월 ${today.getDate()}일`;

            const vars = {
                '이름': '테스트학생',
                '월': monthStr,
                '교육비': '500,000',
                '날짜': dateStr,
                '학원명': academyName,
                '학원전화': academyPhone,
            };
            const content = replaceTemplateVars(setting.sens_overdue_template_content || '', vars);
            const buttons = parseButtons(setting.sens_overdue_buttons);

            const result = await sendAlimtalk(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id,
                },
                setting.sens_overdue_template_code,
                [{ phone, content, buttons }]
            );

            if (result.success) {
                res.json({
                    message: 'SENS 미납자 테스트 발송 성공',
                    success: true,
                    requestId: result.requestId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: false });
            }
        } catch (error) {
            logger.error('SENS 미납자 테스트 발송 오류:', error);
            respondServerError(res, 'SENS 미납자 테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-sens-reminder
     * SENS — 상담 리마인드 알림톡 테스트 발송.
     *  - reminderHours (>=24 → "N일", <24 → "N시간") 표기.
     *  - 응답 표면 원본 보존: 성공 `{ success, message }` / 실패 `{ error: 'Send Error', message, details }`.
     */
    router.post('/test-sens-reminder', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSensConfigured(setting, res)) return;
            if (!ensureTemplateCode(setting.sens_reminder_template_code, res, '리마인드 템플릿 코드')) return;

            const decryptedSecret = decryptSensSecretOrFail(setting, res, { sensLabel: true });
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '학원';
            const academyPhone = academy.phone || '';

            const now = new Date();
            const testDate = `${now.getMonth() + 1}월 ${now.getDate()}일`;
            const testTime = '14:00';
            const reminderHours = setting.sens_reminder_hours || 1;
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
            const content = replaceTemplateVars(setting.sens_reminder_template_content || '', vars);
            const buttons = parseButtons(setting.sens_reminder_buttons);
            const imageUrl = setting.sens_reminder_image_url || null;

            const result = await sendAlimtalk(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id,
                },
                setting.sens_reminder_template_code,
                [{
                    phone,
                    content,
                    buttons,
                    imageUrl,
                }]
            );

            if (result.success) {
                res.json({
                    success: true,
                    message: 'SENS 리마인드 테스트 알림톡이 발송되었습니다.',
                });
            } else {
                res.status(400).json({
                    error: 'Send Error',
                    message: result.message || '알림톡 발송에 실패했습니다.',
                    details: result.details,
                });
            }
        } catch (error) {
            logger.error('SENS 리마인드 테스트 발송 오류:', error);
            respondServerError(res, '테스트 발송에 실패했습니다.');
        }
    });

    /**
     * POST /paca/notifications/test-sens-attendance
     * SENS — 출결 알림톡 테스트 발송 (오늘 날짜 / 출석 상태).
     *  - 월/일은 실제 발송(attendanceNotify.js)과 동일하게 "5월"/"18일" 단위 포함.
     */
    router.post('/test-sens-attendance', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            if (!ensureSensConfigured(setting, res)) return;
            if (!ensureTemplateCode(setting.sens_attendance_template_code, res, '출결 템플릿 코드')) return;

            const decryptedSecret = decryptSensSecretOrFail(setting, res, { sensLabel: true });
            if (!decryptedSecret) return;

            const academy = await fetchAcademy(req.user.academyId);
            const academyName = academy.name || '테스트학원';

            const now = new Date();
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];

            const vars = {
                '학원명': academyName,
                '이름': '테스트학생',
                '월': `${now.getMonth() + 1}월`,
                '일': `${now.getDate()}일`,
                '요일': dayNames[now.getDay()],
                '출결상태': '출석',
            };
            const content = replaceTemplateVars(setting.sens_attendance_template_content || '', vars);
            const buttons = parseButtons(setting.sens_attendance_buttons);

            const result = await sendAlimtalk(
                {
                    naver_access_key: setting.naver_access_key,
                    naver_secret_key: decryptedSecret,
                    naver_service_id: setting.naver_service_id,
                    kakao_channel_id: setting.kakao_channel_id,
                },
                setting.sens_attendance_template_code,
                [{ phone, content, buttons }]
            );

            if (result.success) {
                res.json({
                    message: 'SENS 출결 테스트 발송 성공',
                    success: true,
                    requestId: result.requestId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: false });
            }
        } catch (error) {
            logger.error('SENS 출결 테스트 발송 오류:', error);
            respondServerError(res, 'SENS 출결 테스트 발송에 실패했습니다.');
        }
    });
};
