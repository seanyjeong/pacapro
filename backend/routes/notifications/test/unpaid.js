/**
 * routes/notifications/test/unpaid.js
 *
 * POST `/paca/notifications/test` — 미납 안내 테스트 알림톡 발송 (Phase 3 #1).
 *  - 솔라피 / SENS 듀얼 채널 분기 (notification_settings.service_type 으로 결정).
 *  - createUnpaidNotificationMessage() 로 표준 미납 메시지 생성 후 채널별 send 헬퍼 호출.
 *  - 성공 시 notification_logs 에 'sent' 1건 INSERT (request_id 컬럼에 requestId/groupId 저장).
 *
 * 응답 표면 (ADR-013 보존):
 *  - 성공: `{ message: string, success: true, requestId: string|null }`
 *  - 발송 실패 (400): `{ error: 'Send Failed', message, details }` (details = result 자체)
 *  - 5xx: `{ error: 'Server Error', message }`
 *
 * 보안 영역 (ADR-007):
 *  - decryptApiKey(setting.solapi_api_secret | setting.naver_secret_key, ENCRYPTION_KEY) 시그니처 무변경.
 *  - sendAlimtalk / sendAlimtalkSolapi 호출 인자 객체 셰이프 무변경.
 */

const {
    verifyToken,
    checkPermission,
    sendAlimtalk,
    sendAlimtalkSolapi,
    createUnpaidNotificationMessage,
    logger,
} = require('../_utils');

const {
    requirePhone,
    loadSettings,
    decryptSolapiSecretOrFail,
    decryptSensSecretOrFail,
    fetchAcademy,
    logSent,
    respondSendFailed,
    respondServerError,
} = require('./_utils');

module.exports = function (router) {
    /**
     * POST /paca/notifications/test
     * 미납 안내 테스트 메시지 발송 (솔라피/SENS 듀얼 채널).
     *  - 학원 설정의 service_type (`solapi` | `sens`) 에 따라 채널 분기.
     *  - 발송 성공 시 notification_logs 'sent' 기록 → 사장님이 발송 이력 페이지에서 확인 가능.
     */
    router.post('/test', verifyToken, checkPermission('notifications', 'edit'), async (req, res) => {
        try {
            const phone = requirePhone(req, res);
            if (!phone) return;

            const setting = await loadSettings(req, res);
            if (!setting) return;

            const serviceType = setting.service_type || 'sens';

            const academy = await fetchAcademy(req.user.academyId, { includeDueDay: true });
            const dueDay = academy.tuition_due_day || 1;
            const dueDayText = `${dueDay}일`;

            let result;
            let templateCode;
            let messageContent;

            if (serviceType === 'solapi') {
                const decryptedSolapiSecret = decryptSolapiSecretOrFail(setting, res);
                if (!decryptedSolapiSecret) return;

                const testMessage = createUnpaidNotificationMessage(
                    { month: '12', amount: 300000, due_date: dueDayText },
                    { name: '테스트학생' },
                    { name: academy.name || '테스트학원', phone: academy.phone || '02-1234-5678' },
                    setting.solapi_template_content || setting.template_content
                );

                templateCode = setting.solapi_template_id;
                messageContent = testMessage.content;

                result = await sendAlimtalkSolapi(
                    {
                        solapi_api_key: setting.solapi_api_key,
                        solapi_api_secret: decryptedSolapiSecret,
                        solapi_pfid: setting.solapi_pfid,
                        solapi_sender_phone: setting.solapi_sender_phone,
                    },
                    setting.solapi_template_id,
                    [{ phone, content: testMessage.content }]
                );
            } else {
                const decryptedSecret = decryptSensSecretOrFail(setting, res, { sensLabel: false });
                if (!decryptedSecret) return;

                const testMessage = createUnpaidNotificationMessage(
                    { month: '12', amount: 300000, due_date: dueDayText },
                    { name: '테스트학생' },
                    { name: academy.name || '테스트학원', phone: academy.phone || '02-1234-5678' },
                    setting.template_content
                );

                templateCode = setting.template_code;
                messageContent = testMessage.content;

                result = await sendAlimtalk(
                    {
                        naver_access_key: setting.naver_access_key,
                        naver_secret_key: decryptedSecret,
                        naver_service_id: setting.naver_service_id,
                        kakao_channel_id: setting.kakao_channel_id,
                    },
                    setting.template_code,
                    [{ phone, content: testMessage.content, variables: testMessage.variables }]
                );
            }

            if (result.success) {
                await logSent({
                    academyId: req.user.academyId,
                    recipientName: '테스트',
                    recipientPhone: phone,
                    templateCode,
                    messageContent,
                    requestId: result.requestId || result.groupId,
                });

                res.json({
                    message: `테스트 메시지가 발송되었습니다. (${serviceType === 'solapi' ? '솔라피' : 'SENS'})`,
                    success: true,
                    requestId: result.requestId || result.groupId,
                });
            } else {
                respondSendFailed(res, result, { includeDetails: true });
            }
        } catch (error) {
            logger.error('테스트 발송 오류:', error);
            respondServerError(res, '테스트 발송에 실패했습니다.');
        }
    });
};
