/**
 * paca/toss/settings.js — 토스 연동 설정 라우터 (Phase 3 #8)
 *
 * 마운트: paca.js → routes/toss/index.js → require('./settings')(router)
 *         mount path: '/paca/toss'
 *
 * Endpoint (2건):
 *   - GET /settings — 토스 연동 설정 조회 (callback_secret/plugin_api_key 응답에 포함 X)
 *   - PUT /settings — 토스 연동 설정 저장 (UPSERT, COALESCE — 기존 키 유지)
 *
 * 인증: verifyToken + checkPermission('settings', 'view'|'edit') + checkAcademyAccess
 *
 * 응답 표면 보존 (ADR-013):
 *   GET /settings (있음) → { success, settings }
 *   GET /settings (없음) → { success, settings:null, message }
 *   PUT /settings        → { success, message }
 *   4xx/5xx              → { success:false, error, message }
 *
 * DB 호출 (ADR-005): pool.execute. 4건 (조회 1 + 존재확인 1 + INSERT 1 / UPDATE 1).
 *   db.query 잔존 0건. ADR-016 IN 절 사용 0건.
 *
 * 보안 (ADR-007):
 *   - GET /settings 응답 SELECT 절에서 plugin_api_key / callback_secret 제외 — 의도적 보호.
 *   - PUT /settings 의 plugin_api_key / callback_secret 저장은 프론트에서 일반 PUT 으로 보냄.
 *     본 리팩에서는 별도 암호화 X (원본 동작 보존). 별도 보안 트랙에서 강화 검토 가능.
 *   - bcrypt/JWT 직접 호출 X.
 *
 * 분리 결정 (ADR-006): ~125줄 — 분리 불요.
 */

const { pool, logger } = require('./_utils');
const { verifyToken, checkPermission, checkAcademyAccess } = require('../../middleware/auth');

module.exports = function(router) {

/**
 * GET /paca/toss/settings
 * 토스 연동 설정 조회 (관리자용)
 *
 * SELECT 절에 plugin_api_key / callback_secret 미포함 — 응답 페이로드에서 의도적 제외 (ADR-007).
 */
router.get('/settings', verifyToken, checkPermission('settings', 'view'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;

        const [settings] = await pool.execute(
            `SELECT
                id, academy_id, merchant_id, is_active,
                auto_match_enabled, auto_receipt_print,
                created_at, updated_at
             FROM toss_settings
             WHERE academy_id = ?`,
            [academyId]
        );

        if (settings.length === 0) {
            return res.json({
                success: true,
                settings: null,
                message: '토스 연동 설정이 없습니다.'
            });
        }

        res.json({
            success: true,
            settings: settings[0]
        });

    } catch (error) {
        logger.error('[Toss] Error fetching settings:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '설정 조회에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/toss/settings
 * 토스 연동 설정 저장 (관리자용) — UPSERT (없으면 INSERT, 있으면 UPDATE)
 *
 * UPDATE 시 plugin_api_key / callback_secret 은 COALESCE 로 기존 값 유지 (NULL 입력 시).
 */
router.put('/settings', verifyToken, checkPermission('settings', 'edit'), checkAcademyAccess, async (req, res) => {
    try {
        const academyId = req.user.academy_id;
        const {
            merchant_id,
            plugin_api_key,
            callback_secret,
            is_active,
            auto_match_enabled,
            auto_receipt_print
        } = req.body;

        // 기존 설정 확인
        const [existing] = await pool.execute(
            'SELECT id FROM toss_settings WHERE academy_id = ?',
            [academyId]
        );

        if (existing.length === 0) {
            // 새로 생성
            await pool.execute(
                `INSERT INTO toss_settings (
                    academy_id, merchant_id, plugin_api_key, callback_secret,
                    is_active, auto_match_enabled, auto_receipt_print
                ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                [
                    academyId,
                    merchant_id ?? null,
                    plugin_api_key ?? null,
                    callback_secret ?? null,
                    is_active ? 1 : 0,
                    auto_match_enabled !== false ? 1 : 0,
                    auto_receipt_print !== false ? 1 : 0
                ]
            );
        } else {
            // 업데이트
            await pool.execute(
                `UPDATE toss_settings SET
                    merchant_id = COALESCE(?, merchant_id),
                    plugin_api_key = COALESCE(?, plugin_api_key),
                    callback_secret = COALESCE(?, callback_secret),
                    is_active = ?,
                    auto_match_enabled = ?,
                    auto_receipt_print = ?
                WHERE academy_id = ?`,
                [
                    merchant_id ?? null,
                    plugin_api_key ?? null,
                    callback_secret ?? null,
                    is_active ? 1 : 0,
                    auto_match_enabled !== false ? 1 : 0,
                    auto_receipt_print !== false ? 1 : 0,
                    academyId
                ]
            );
        }

        res.json({
            success: true,
            message: '설정이 저장되었습니다.'
        });

    } catch (error) {
        logger.error('[Toss] Error saving settings:', error);
        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '설정 저장에 실패했습니다.'
        });
    }
});

};
