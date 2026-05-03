/**
 * routes/instructors/auth.js
 *
 * ⛔ **ADR-007 보안 영역** — 자동 리팩 금지 모듈.
 *
 * ## endpoint
 * - POST `/verify-admin-password` — 강사 등록/수정 모달 저장 시 관리자 비밀번호 재확인.
 *
 * ## 본 sub-라우터의 변경 정책
 * - 본 파일은 원본 `routes/instructors.js` (line 256~303) 에서 코드를 **무수정으로 이전**.
 * - 다음 ADR 적용은 **사장님 별도 컨펌 후에만** 진행한다:
 *   - ADR-005 (`db.query` → `pool.execute`)
 *   - ADR-003 (사용자 노출 메시지 한국어화)
 *   - 응답 표면 / 에러 코드 / 인자 시그니처 변경 일체
 * - `bcrypt.compare(...)` 가 라우터 본문에 직접 호출되어 있어 (헬퍼 미경유) 인증 메커니즘
 *   본체에 해당. 자동 변경 시 인증 회귀 위험.
 *
 * ## 마운트
 * `instructors/index.js` 가 본 sub-라우터를 가장 먼저 require → `/verify-admin-password` 고정
 * 경로가 `/:id` 와일드카드 라우트보다 먼저 등록되어야 매칭 충돌 회피.
 *
 * ## 응답 표면 (ADR-013 보존)
 * - 200: `{message: 'Password verified', verified: true}`
 * - 401: `{error: 'Unauthorized', message: 'Invalid password', verified: false}`
 * - 400: `{error: 'Validation Error', message: 'Password is required'}`
 * - 404: `{error: 'Not Found', message: 'User not found'}`
 * - 500: `{error: 'Server Error', message: 'Failed to verify password'}`
 * 프론트가 `verified` boolean 직접 소비.
 */

const bcrypt = require('bcryptjs');
const {
    db,
    verifyToken,
    checkPermission,
    logger
} = require('./_utils');

module.exports = function(router) {

    /**
     * POST /paca/instructors/verify-admin-password
     * Verify admin password for approval operations
     * Access: owner, admin
     *
     * ⛔ ADR-007: 본 endpoint 코드는 원본 instructors.js 에서 무수정 이전.
     */
    router.post('/verify-admin-password', verifyToken, checkPermission('instructors', 'edit'), async (req, res) => {
        try {
            const { password } = req.body;

            if (!password) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Password is required'
                });
            }

            // Get user with password
            const [users] = await db.query(
                'SELECT id, password FROM users WHERE id = ?',
                [req.user.id]
            );

            if (users.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: 'User not found'
                });
            }

            const isMatch = await bcrypt.compare(password, users[0].password);

            if (!isMatch) {
                return res.status(401).json({
                    error: 'Unauthorized',
                    message: 'Invalid password',
                    verified: false
                });
            }

            res.json({
                message: 'Password verified',
                verified: true
            });
        } catch (error) {
            logger.error('Error verifying password:', error);
            res.status(500).json({
                error: 'Server Error',
                message: 'Failed to verify password'
            });
        }
    });

};
