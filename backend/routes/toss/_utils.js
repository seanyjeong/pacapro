/**
 * paca/toss/_utils.js — toss 도메인 sub-라우터 공통 유틸 (Phase 3 #8, ADR-017 자율 진행)
 *
 * 사용처: toss/{plugin,callbacks,admin,settings}.js
 *
 * 제공:
 *   - pool/db (mysql2 promise pool, ADR-005/ADR-011 alias) — pool 신규 표준 / db 호환
 *   - encrypt / decrypt (utils/encryption — ADR-007 보안 헬퍼 시그니처 무변경)
 *   - crypto (HMAC-SHA256 콜백 서명 검증 — ADR-007 무변경)
 *   - logger (utils/logger)
 *   - 미들웨어 2종 (verifyTossPlugin / verifyCallbackSignature) — 동작 1:1 보존
 *   - maskName 유틸 (홍*동 마스킹)
 *   - 상수 2종 (TOSS_PLUGIN_API_KEY / CALLBACK_TIMESTAMP_TOLERANCE)
 *
 * 보안 영역 (ADR-007) — 자동 변경 금지 영역:
 *   - encrypt / decrypt (utils/encryption) 시그니처 무변경 = 호출만 함
 *   - crypto.createHmac('sha256', secret) HMAC 검증 로직 1:1 보존
 *   - 학원별 API 키 + callback_secret 검증 흐름 1:1 보존
 *   - 외부 API 호출 X (toss 는 inbound webhook 수신만 — axios/fetch 0건)
 *
 * ADR-005 (pool.execute 통일): 본 파일 + sub-라우터 모두 pool.execute / conn.execute.
 * ADR-013 응답 표면 보존: verifyTossPlugin / verifyCallbackSignature 의 401/403 응답 셰이프
 *   (`{success:false, error, message}`) 토스 플러그인 + 토스 콜백 측이 실제 소비.
 */

const pool = require('../../config/database');
const { decrypt, encrypt } = require('../../utils/encryption');
const crypto = require('crypto');
const logger = require('../../utils/logger');

// pool 의 alias (ADR-011 — 신규 표준은 pool, 호환을 위해 db 도 노출)
const db = pool;

// ============================================
// 설정 상수
// ============================================
// 주의: 기본값 제거됨! 프로덕션에서는 반드시 환경변수 설정 필요
const TOSS_PLUGIN_API_KEY = process.env.TOSS_PLUGIN_API_KEY;
const CALLBACK_TIMESTAMP_TOLERANCE = 5 * 60 * 1000; // 5분

// 토스 플러그인 API 키 미설정 경고 (모듈 로드 시 1회)
if (!TOSS_PLUGIN_API_KEY) {
    logger.warn('[TOSS] ⚠️ TOSS_PLUGIN_API_KEY 미설정. 토스 연동이 작동하지 않습니다.');
}

// ============================================
// 보안 미들웨어 (ADR-007 — 동작 1:1 보존)
// ============================================

/**
 * 토스 플러그인 API 키 인증
 * 토스 프론트 플러그인에서 호출하는 API용 (X-Toss-Plugin-Key 헤더)
 * 응답 셰이프 (ADR-013): { success:false, error:'Unauthorized', message:'...' }
 */
const verifyTossPlugin = async (req, res, next) => {
    const apiKey = req.headers['x-toss-plugin-key'];
    const academyId = req.headers['x-academy-id'] || req.query.academy_id;

    if (!apiKey) {
        return res.status(401).json({
            success: false,
            error: 'Unauthorized',
            message: 'API 키가 필요합니다.'
        });
    }

    // 전역 API 키 확인
    if (apiKey === TOSS_PLUGIN_API_KEY) {
        req.tossAuth = {
            type: 'global',
            academyId: parseInt(academyId) || null
        };
        return next();
    }

    // 학원별 API 키 확인
    if (academyId) {
        try {
            const [settings] = await pool.execute(
                `SELECT * FROM toss_settings
                 WHERE academy_id = ? AND is_active = 1`,
                [academyId]
            );

            if (settings.length > 0 && settings[0].plugin_api_key === apiKey) {
                req.tossAuth = {
                    type: 'academy',
                    academyId: parseInt(academyId),
                    settings: settings[0]
                };
                return next();
            }
        } catch (error) {
            logger.error('[Toss] API Key verification error:', error);
        }
    }

    return res.status(401).json({
        success: false,
        error: 'Unauthorized',
        message: '유효하지 않은 API 키입니다.'
    });
};

/**
 * 콜백 서명 검증 (보안 강화)
 * 토스에서 결제 완료 시 호출하는 콜백 검증 (HMAC-SHA256)
 * 응답 셰이프 (ADR-013): { success:false, error:'Forbidden', message:'...' }
 *
 * 검증 단계:
 *   1) 타임스탬프 (X-Toss-Timestamp) — 5분 허용. 프로덕션은 거부 / 개발은 경고.
 *   2) 서명 (X-Toss-Signature) — academyId 학원별 callback_secret 으로 HMAC-SHA256.
 *   3) 요청 로깅 (보안 감사용).
 */
const verifyCallbackSignature = async (req, res, next) => {
    const signature = req.headers['x-toss-signature'];
    const timestamp = req.headers['x-toss-timestamp'];
    const academyId = req.body.metadata?.academyId;
    const isDev = process.env.NODE_ENV === 'development';

    // 1. 타임스탬프 검증 (리플레이 공격 방지)
    if (timestamp) {
        const requestTime = parseInt(timestamp);
        const now = Date.now();
        if (Math.abs(now - requestTime) > CALLBACK_TIMESTAMP_TOLERANCE) {
            logger.warn('[Toss] Callback timestamp expired:', {
                requestTime,
                now,
                diff: now - requestTime
            });
            // 프로덕션에서는 거부, 개발에서는 경고만
            if (!isDev) {
                return res.status(403).json({
                    success: false,
                    error: 'Forbidden',
                    message: '타임스탬프가 만료되었습니다.'
                });
            }
        }
    }

    // 2. 서명 검증 (학원별 callback_secret 설정된 경우)
    if (signature && academyId) {
        try {
            const [settings] = await pool.execute(
                `SELECT callback_secret FROM toss_settings WHERE academy_id = ?`,
                [academyId]
            );

            if (settings.length > 0 && settings[0].callback_secret) {
                const secret = settings[0].callback_secret;
                const payload = JSON.stringify(req.body);
                const expectedSignature = crypto
                    .createHmac('sha256', secret)
                    .update(payload)
                    .digest('hex');

                if (signature !== expectedSignature) {
                    logger.error('[Toss] Invalid callback signature for academy:', academyId);
                    return res.status(403).json({
                        success: false,
                        error: 'Forbidden',
                        message: '서명 검증 실패'
                    });
                }
                logger.info('[Toss] Callback signature verified for academy:', academyId);
            }
        } catch (error) {
            logger.error('[Toss] Signature verification error:', error);
        }
    }

    // 3. 요청 로깅 (보안 감사용)
    logger.info('[Toss] Callback received:', {
        orderId: req.body.orderId,
        amount: req.body.amount,
        academyId: academyId,
        hasSignature: !!signature,
        hasTimestamp: !!timestamp,
        ip: req.ip
    });

    next();
};

// ============================================
// 유틸리티 함수
// ============================================

/**
 * 이름 마스킹 (홍*동) — 학생 이름 노출 시 민감정보 차단
 */
function maskName(name) {
    if (!name || name.length < 2) return name;
    if (name.length === 2) return name[0] + '*';
    return name[0] + '*'.repeat(name.length - 2) + name[name.length - 1];
}

module.exports = {
    pool,
    db,
    encrypt,
    decrypt,
    crypto,
    logger,
    TOSS_PLUGIN_API_KEY,
    CALLBACK_TIMESTAMP_TOLERANCE,
    verifyTossPlugin,
    verifyCallbackSignature,
    maskName,
};
