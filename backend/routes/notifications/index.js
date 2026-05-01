/**
 * routes/notifications/index.js
 *
 * `/paca/notifications/*` 라우트 마운트 진입점.
 *  - paca.js 가 `routes/notifications/` 디렉토리를 감지하면 이 파일을 require 한 뒤
 *    반환된 express Router 를 `/paca/notifications` prefix 로 app.use() 한다.
 *  - sub-라우터 4개 (settings / logs / test / send) 를 단일 router 인스턴스에
 *    위임 등록한다. 각 sub-라우터는 `module.exports = function(router) {...}` 패턴.
 *
 * 리팩 노트 (Phase 1 — Tier 1 #2):
 *  - mount-only 진입점이라 라우트 정의를 포함하지 않는다 (RULES.md 분리 패턴 준수).
 *  - sub-라우터 등록 순서는 prefix 가 모두 달라 충돌이 없으나, 가독성을 위해
 *    `settings → logs → test → send` (조회 → 테스트 → 실제 발송) 순으로 배치.
 *  - 인증/권한 (verifyToken / checkPermission) 은 각 sub-라우터 내부에서
 *    라우트 단위로 적용된다. router 레벨 미들웨어를 추가하면 webhook/cron 용
 *    공개 endpoint (send.js 의 `/send-*-auto-sens` 4개) 가 깨지므로 금지.
 *  - ADR-013 (응답 표면 보존) / ADR-007 (보안 영역 미수정) 적용.
 */

const express = require('express');
const router = express.Router();

// sub-라우터 등록 (각 모듈은 router 를 인자로 받아 자체 endpoint 등록)
require('./settings')(router); // GET/PUT /settings
require('./logs')(router);     // GET /logs, GET /stats
require('./test')(router);     // POST /test, /test-*, /test-sens-* (테스트 발송 9건)
require('./send')(router);     // POST /send-unpaid, /send-individual, /send-*-auto, /send-*-auto-sens (실제 발송 8건)

module.exports = router;
