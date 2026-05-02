/**
 * routes/notifications/send/_utils.js
 *
 * notifications/send/* 8개 endpoint (수동 발송 2건 + 자동발송 2건 + webhook 4건) 가
 * 공유하는 의존성 / 헬퍼 모음. 부모 `routes/notifications/_utils.js` 의 헬퍼를
 * 그대로 재공급한다 (DB pool / 인증 / 발송 채널 / 암호화 / 로거).
 *
 * 설계 원칙 (paca 리팩 RULES.md + ADR 준수):
 *  - DB 호출은 ADR-005 에 따라 `pool.execute(sql, params)` 가 정답이다.
 *    부모 `_utils.js` 는 동일 mysql2 풀을 `db` / `pool` 두 이름으로 노출
 *    (ADR-011) 하므로, 신규 sub-라우터는 `pool` 이름을 사용해 ADR-005 와 정렬한다.
 *  - 보안 헬퍼 (`decryptApiKey` / `sendAlimtalk` / `sendAlimtalkSolapi`) 의 시그니처
 *    및 동작은 절대 변형하지 않는다 (ADR-007). 외부 발송 API 키 호출 셰이프 보존.
 *  - 응답 표면은 ADR-013 에 따라 1:1 보존한다. 8 endpoint 가 각자 다른 root 키
 *    (`message` / `sent` / `failed` / `requestId` / `groupId` / `results` /
 *    `current_hour` / `academies_processed` / `total_sent` / `total_failed` /
 *    `date` / `day_name`) 를 노출하므로 헬퍼로 강제 통일 시도 X.
 *  - webhook (`/send-*-auto-sens` 4건 + `/send-reminder-auto` 4건 중 일부) 의
 *    X-API-Key 검증 로직은 무인증 endpoint 정책 보존을 위해 본 헬퍼에 통합한다
 *    (`assertWebhookApiKey`).
 */

const parent = require('../_utils');

const {
    db,
    pool,
    verifyToken,
    checkPermission,
    decryptApiKey,
    sendAlimtalk,
    sendAlimtalkSolapi,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    decrypt,
    decryptStudentInfo,
    decryptStudentArray,
    ENCRYPTION_KEY,
    logger,
} = parent;

/**
 * X-API-Key 헤더 검증 (n8n webhook / cron 호출용 무인증 endpoint 4건 보호).
 *
 * - notifications/send 의 `/send-*-auto-sens` (4건) + `/send-reminder-auto` (1건) 가
 *   verifyToken 미적용 endpoint 로 등록되어 있다 (ADR-014 광역 미들웨어 금지 사유).
 * - 검증 실패 시 401 `{error:'Unauthorized'}` 응답하고 false 를 반환한다.
 *   호출자는 false 시 즉시 return 해야 한다.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {boolean} true = 통과, false = 401 응답 후 호출자 종료 필요
 */
function assertWebhookApiKey(req, res) {
    const apiKey = req.headers['x-api-key'];
    if (apiKey !== 'paca-n8n-api-key-2024') {
        res.status(401).json({ error: 'Unauthorized' });
        return false;
    }
    return true;
}

module.exports = {
    // DB
    db,
    pool,
    // 인증 (manual/auto endpoint 용 — webhook 4건은 미사용)
    verifyToken,
    checkPermission,
    // 외부 발송 채널 (ADR-007 시그니처 무변경)
    decryptApiKey,
    sendAlimtalk,
    sendAlimtalkSolapi,
    createUnpaidNotificationMessage,
    isValidPhoneNumber,
    // 암호화
    decrypt,
    decryptStudentInfo,
    decryptStudentArray,
    ENCRYPTION_KEY,
    // webhook 보호 (X-API-Key 검증)
    assertWebhookApiKey,
    // 로거
    logger,
};
