/**
 * exports 도메인 mount-only 진입점 (Phase 2 #6, ADR-017 / ADR-014)
 *
 * paca.js W-6 자동 라우트 등록이 본 디렉토리 (`routes/exports/`) 를 스캔하여
 * `routes/exports/index.js` 를 require → `app.use('/paca/exports', router)` 로 마운트.
 *
 * sub-라우터 6개를 동일 router 인스턴스에 위임. 각 sub-라우터는
 * `module.exports = function(router) { router.get('/<path>', ...) }` 패턴.
 *
 * ⚠️ 광역 미들웨어 (`router.use(verifyToken)` 등) 추가 절대 금지 (ADR-014).
 *    exports 도메인은 모든 endpoint 가 endpoint 단위 verifyToken + checkPermission 적용 (5건)
 *    또는 verifyToken 만 (1건, /students) 으로 인증 정책이 endpoint 마다 다름.
 *    광역 미들웨어 추가 시 students endpoint 의 의도된 단순 인증 정책과 충돌 위험.
 *
 * 등록 순서: 모든 endpoint 가 고정 prefix (/revenue, /expenses, /financial,
 * /payments, /salaries, /students) 라 와일드카드 충돌 X. 알파벳 순으로 등록.
 */

const express = require('express');
const router = express.Router();

require('./expenses')(router);
require('./financial')(router);
require('./payments')(router);
require('./revenue')(router);
require('./salaries')(router);
require('./students')(router);

module.exports = router;
