/**
 * routes/notifications/test/_utils.js
 *
 * 알림 테스트 발송 sub-라우터 공용 헬퍼 (Phase 3 #1).
 *  - 9개 테스트 endpoint 가 공유하던 반복 로직 (설정 조회 / Secret 복호화 /
 *    학원 정보 조회 / 템플릿 변수 치환 / 버튼 파싱 / 로그 기록 / 응답 표면) 을
 *    한 곳에 모아 sub-라우터 (unpaid / solapi / sens) 가 재사용한다.
 *
 * 설계 원칙 (RULES.md / ADR 준수):
 *  - DB 호출은 ADR-005 표준 (`pool.execute`) 만 사용.
 *  - 사용자 노출 메시지는 ADR-003 한국어 친화 + 시스템 정보 누출 0.
 *  - 응답 표면은 ADR-013 보존: 프론트 `src/lib/api/notifications.ts` 가
 *    `SendResponse { message, success?, sent?, failed? }` 와 추가 root 키
 *    (`requestId` / `groupId`) 를 직접 소비. body 의 root 키 셋을 변경하지 않는다.
 *  - 보안 헬퍼 (`decryptApiKey`) 시그니처/호출 인자 무변경 (ADR-007).
 *  - 외부 API 호출 (sendAlimtalk / sendAlimtalkSolapi) 는 헬퍼에서 직접 호출하지 않고
 *    각 sub-라우터에서 호출한다 — 채널/페이로드 차이가 커서 헬퍼 강제 시 분기 폭발.
 */

const {
    pool,
    decryptApiKey,
    isValidPhoneNumber,
    ENCRYPTION_KEY,
    logger,
} = require('../_utils');

/**
 * 입력 phone 검증.
 *  - 유효하지 않으면 400 응답을 보낸 뒤 null 반환 (호출자 즉시 return).
 *  - 유효하면 정규화 X (raw 전달).
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {string|null}
 */
function requirePhone(req, res) {
    const { phone } = req.body || {};
    if (!phone || !isValidPhoneNumber(phone)) {
        res.status(400).json({
            error: 'Validation Error',
            message: '유효한 전화번호를 입력해주세요.',
        });
        return null;
    }
    return phone;
}

/**
 * `notification_settings` row 1건 조회.
 *  - 없으면 400 + "알림 설정을 먼저 완료해주세요." 응답 후 null 반환.
 *
 * @param {import('express').Request} req
 * @param {import('express').Response} res
 * @returns {Promise<object|null>}
 */
async function loadSettings(req, res) {
    const [settings] = await pool.execute(
        'SELECT * FROM notification_settings WHERE academy_id = ?',
        [req.user.academyId]
    );
    if (!settings || settings.length === 0) {
        res.status(400).json({
            error: 'Configuration Error',
            message: '알림 설정을 먼저 완료해주세요.',
        });
        return null;
    }
    return settings[0];
}

/**
 * 솔라피 필수 설정 (api_key / api_secret / pfid) 검증.
 *  - 누락 시 400 + 한국어 메시지 응답 후 false 반환.
 *
 * @param {object} setting
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function ensureSolapiConfigured(setting, res) {
    if (!setting.solapi_api_key || !setting.solapi_api_secret || !setting.solapi_pfid) {
        res.status(400).json({
            error: 'Configuration Error',
            message: '솔라피 API 설정을 먼저 완료해주세요.',
        });
        return false;
    }
    return true;
}

/**
 * SENS 필수 설정 (access_key / secret_key / service_id) 검증.
 *  - 누락 시 400 + 한국어 메시지 응답 후 false 반환.
 *
 * @param {object} setting
 * @param {import('express').Response} res
 * @returns {boolean}
 */
function ensureSensConfigured(setting, res) {
    if (!setting.naver_access_key || !setting.naver_secret_key || !setting.naver_service_id) {
        res.status(400).json({
            error: 'Configuration Error',
            message: 'SENS API 설정을 먼저 완료해주세요.',
        });
        return false;
    }
    return true;
}

/**
 * 솔라피 템플릿 ID 검증 (특정 분기 별 누락 메시지).
 *
 * @param {string|null|undefined} templateId
 * @param {import('express').Response} res
 * @param {string} kindLabel 사용자 노출 라벨 (예: "상담확정 템플릿 ID")
 * @returns {boolean}
 */
function ensureTemplateId(templateId, res, kindLabel) {
    if (!templateId) {
        res.status(400).json({
            error: 'Configuration Error',
            message: `${kindLabel}를 먼저 설정해주세요.`,
        });
        return false;
    }
    return true;
}

/**
 * SENS 템플릿 코드 검증.
 *
 * @param {string|null|undefined} templateCode
 * @param {import('express').Response} res
 * @param {string} kindLabel 사용자 노출 라벨 (예: "상담확정 템플릿 코드")
 * @returns {boolean}
 */
function ensureTemplateCode(templateCode, res, kindLabel) {
    if (!templateCode) {
        res.status(400).json({
            error: 'Configuration Error',
            message: `${kindLabel}를 먼저 설정해주세요.`,
        });
        return false;
    }
    return true;
}

/**
 * 솔라피 API Secret 복호화 + 검증 (ADR-007 보안 헬퍼 시그니처 무변경).
 *  - 실패 시 400 + 한국어 메시지 응답 후 null 반환.
 *
 * @param {object} setting
 * @param {import('express').Response} res
 * @returns {string|null}
 */
function decryptSolapiSecretOrFail(setting, res) {
    const decryptedSecret = decryptApiKey(setting.solapi_api_secret, ENCRYPTION_KEY);
    if (!decryptedSecret) {
        res.status(400).json({
            error: 'Configuration Error',
            message: '솔라피 API Secret이 올바르지 않습니다.',
        });
        return null;
    }
    return decryptedSecret;
}

/**
 * SENS API Secret Key 복호화 + 검증 (ADR-007 보안 헬퍼 시그니처 무변경).
 *  - 실패 시 400 + 한국어 메시지 응답 후 null 반환.
 *  - sub-라우터별로 사용자 노출 라벨이 다름:
 *    * 기본 ('test') → "API Secret Key가 올바르지 않습니다."
 *    * SENS 테스트 분기 → "SENS API Secret이 올바르지 않습니다."
 *
 * @param {object} setting
 * @param {import('express').Response} res
 * @param {object} [opts]
 * @param {boolean} [opts.sensLabel=false]
 * @returns {string|null}
 */
function decryptSensSecretOrFail(setting, res, { sensLabel = false } = {}) {
    const decryptedSecret = decryptApiKey(setting.naver_secret_key, ENCRYPTION_KEY);
    if (!decryptedSecret) {
        res.status(400).json({
            error: 'Configuration Error',
            message: sensLabel
                ? 'SENS API Secret이 올바르지 않습니다.'
                : 'API Secret Key가 올바르지 않습니다.',
        });
        return null;
    }
    return decryptedSecret;
}

/**
 * 학원 정보 1건 조회 (name, phone — 존재 시).
 *  - row 없을 경우 빈 객체 반환 (호출자가 fallback 처리).
 *
 * @param {number} academyId
 * @param {object} [opts]
 * @param {boolean} [opts.includeDueDay=false] — `tuition_due_day` 까지 JOIN 조회.
 * @returns {Promise<object>}
 */
async function fetchAcademy(academyId, { includeDueDay = false } = {}) {
    if (includeDueDay) {
        const [rows] = await pool.execute(
            `SELECT a.name, a.phone, COALESCE(s.tuition_due_day, 1) as tuition_due_day
             FROM academies a
             LEFT JOIN academy_settings s ON a.id = s.academy_id
             WHERE a.id = ?`,
            [academyId]
        );
        return rows[0] || {};
    }
    const [rows] = await pool.execute(
        'SELECT name, phone FROM academies WHERE id = ?',
        [academyId]
    );
    return rows[0] || {};
}

/**
 * 템플릿 문자열의 #{var} 자리표시자를 일괄 치환.
 *  - vars 가 null/undefined 인 키는 건너뛰지 않고 그대로 빈 문자열로 치환되지 않게,
 *    "값이 정의된 키만" 처리. 정의되지 않은 키는 #{name} 그대로 남는다.
 *  - 각 sub-라우터에서 동일하게 사용 가능 (상담확정 / 체험수업 / 미납자 / 리마인드).
 *
 * @param {string} content
 * @param {Record<string, string>} vars
 * @returns {string}
 */
function replaceTemplateVars(content, vars) {
    let out = content || '';
    for (const [key, value] of Object.entries(vars || {})) {
        if (value === undefined || value === null) continue;
        const re = new RegExp(`#\\{${escapeRegExp(key)}\\}`, 'g');
        out = out.replace(re, String(value));
    }
    return out;
}

function escapeRegExp(s) {
    return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * 버튼 설정 JSON 파싱.
 *  - 파싱 실패 시 logger.error 만 남기고 null 반환 (원본 동작 보존).
 *  - linkVars 가 주어지면 buttons[].linkMo / linkPc 의 #{var} 도 치환.
 *
 * @param {string|null|undefined} buttonsJson
 * @param {Record<string, string>|null} [linkVars=null]
 * @returns {Array|null}
 */
function parseButtons(buttonsJson, linkVars = null) {
    if (!buttonsJson) return null;
    let buttons;
    try {
        buttons = JSON.parse(buttonsJson);
    } catch (e) {
        logger.error('버튼 설정 파싱 오류:', e);
        return null;
    }
    if (!linkVars) return buttons;
    return buttons.map(btn => ({
        ...btn,
        linkMo: btn.linkMo ? replaceTemplateVars(btn.linkMo, linkVars) : btn.linkMo,
        linkPc: btn.linkPc ? replaceTemplateVars(btn.linkPc, linkVars) : btn.linkPc,
    }));
}

/**
 * `notification_logs` 에 발송 성공 로그 1건 기록.
 *  - 호출자가 발송 성공한 경우에만 호출.
 *  - 실패 발송은 로그를 기록하지 않는다 (원본 동작 보존).
 *
 * @param {object} args
 * @param {number} args.academyId
 * @param {string} args.recipientName
 * @param {string} args.recipientPhone
 * @param {string} args.templateCode
 * @param {string} args.messageContent
 * @param {string|null} args.requestId
 * @returns {Promise<void>}
 */
async function logSent({ academyId, recipientName, recipientPhone, templateCode, messageContent, requestId }) {
    await pool.execute(
        `INSERT INTO notification_logs
        (academy_id, recipient_name, recipient_phone, message_type, template_code,
         message_content, status, request_id, sent_at)
        VALUES (?, ?, ?, 'alimtalk', ?, ?, 'sent', ?, NOW())`,
        [
            academyId,
            recipientName,
            recipientPhone,
            templateCode,
            messageContent,
            requestId,
        ]
    );
}

const GENERIC_SEND_FAILURE_PATTERN =
    /^(fail(?:ed|ure)?|send\s*(fail(?:ed|ure)?|error)|발송에 실패했습니다[.:]?|알림톡 발송에 실패했습니다[.:]?|메시지 발송에 실패했습니다[.:]?)$/i;
const TECHNICAL_SEND_FAILURE_PATTERN =
    /(Failed to load|CORS|Axios|stack trace|HTTP\s*\d{3}|status\s*\d{3}|\b(400|401|403|404|429|500)\b|ECONN|ETIMEDOUT|^[A-Z0-9]+(?:_[A-Z0-9]+)+$)/i;
const FAILURE_DETAIL_KEYS = ['errorMessage', 'reason', 'message', 'details', 'error', 'description'];

function collectFailureTexts(value, depth = 0) {
    if (depth > 3 || value === null || value === undefined) return [];
    if (typeof value === 'string') return [value.trim()].filter(Boolean);
    if (typeof value !== 'object') return [];

    const texts = [];
    for (const key of FAILURE_DETAIL_KEYS) {
        if (Object.prototype.hasOwnProperty.call(value, key)) {
            texts.push(...collectFailureTexts(value[key], depth + 1));
        }
    }
    return texts;
}

function normalizeFailureReason(text) {
    if (!text || GENERIC_SEND_FAILURE_PATTERN.test(text)) return null;

    if (/허용되지 않은\s*IP|forbidden/i.test(text)) {
        return '발송 서비스의 보안 설정에서 현재 서버가 허용되지 않았습니다. 알림톡 연동 서비스의 접속 허용 설정을 확인해주세요.';
    }
    if (/[가-힣]/.test(text) && !TECHNICAL_SEND_FAILURE_PATTERN.test(text)) return text;
    if (/template|템플릿/i.test(text)) {
        return '알림톡 템플릿 설정이 올바르지 않습니다. 승인된 템플릿과 입력한 내용을 확인해주세요.';
    }
    if (/unauthori[sz]ed|authentication|api\s*key|secret|인증/i.test(text)) {
        return '발송 서비스 인증 정보가 올바르지 않습니다. 알림톡 연동 설정을 다시 확인해주세요.';
    }
    if (/recipient|phone|수신|전화번호/i.test(text)) {
        return '받는 전화번호가 올바르지 않습니다. 전화번호를 확인해주세요.';
    }
    if (/insufficient|balance|잔액/i.test(text)) {
        return '발송 서비스 잔액이 부족합니다. 충전 상태를 확인해주세요.';
    }
    if (/timeout|network|연결/i.test(text)) {
        return '발송 서비스에 일시적으로 연결하지 못했습니다. 잠시 후 다시 시도해주세요.';
    }
    return null;
}

function getSendFailureReason(result) {
    const texts = collectFailureTexts(result);
    for (const text of texts) {
        const reason = normalizeFailureReason(text);
        if (reason) return reason;
    }
    return '발송 서비스에서 요청을 처리하지 못했습니다. 알림톡 연동 설정을 확인한 뒤 다시 시도해주세요.';
}

function getSendFailureMessage(result) {
    return `테스트 발송에 실패했습니다. 사유: ${getSendFailureReason(result)}`;
}

/**
 * 발송 실패 시 표준 400 응답 (원본 SENS sub-라우터 패턴).
 *  - 제공사 상세 사유를 안전한 한국어 안내로 변환한다.
 *  - details 필드는 SENS 테스트 분기에서는 없음, 솔라피 분기에서는 result 자체.
 *
 * @param {import('express').Response} res
 * @param {object} result
 * @param {object} [opts]
 * @param {boolean} [opts.includeDetails=false]
 */
function respondSendFailed(res, result, { includeDetails = false } = {}) {
    const body = {
        error: 'Send Failed',
        message: getSendFailureMessage(result),
    };
    if (includeDetails) body.details = result;
    res.status(400).json(body);
}

/**
 * 5xx 표준 응답 (한국어 메시지, e.message 누출 X).
 *
 * @param {import('express').Response} res
 * @param {string} message
 */
function respondServerError(res, message) {
    res.status(500).json({
        error: 'Server Error',
        message,
    });
}

module.exports = {
    requirePhone,
    loadSettings,
    ensureSolapiConfigured,
    ensureSensConfigured,
    ensureTemplateId,
    ensureTemplateCode,
    decryptSolapiSecretOrFail,
    decryptSensSecretOrFail,
    fetchAcademy,
    replaceTemplateVars,
    parseButtons,
    logSent,
    getSendFailureReason,
    getSendFailureMessage,
    respondSendFailed,
    respondServerError,
};
