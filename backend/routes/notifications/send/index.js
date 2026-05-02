/**
 * routes/notifications/send/index.js
 *
 * `/paca/notifications/send-*` 8개 endpoint 의 mount-only 진입점.
 *  - 부모 `routes/notifications/index.js` 가 `require('./send')(router)` 로
 *    호출하면 Node 의 require resolve 가 디렉토리/index.js 를 자동 처리한다.
 *  - 본 파일은 `module.exports = function(router) {...}` 패턴의 sub-라우터 3개
 *    (manual / auto / webhooks) 를 단일 router 인스턴스에 위임 등록한다.
 *
 * 리팩 노트 (Phase 3 #3 — ADR-014 진입점 정책):
 *  - mount-only 진입점이라 라우트 정의를 포함하지 않는다.
 *  - sub-라우터 등록 순서는 prefix 가 모두 달라 충돌이 없으나, 가독성을 위해
 *    인증 강도 강 → 약 (`manual` (verifyToken+checkPermission) → `auto`
 *    (verifyToken) → `webhooks` (X-API-Key)) 순으로 배치.
 *
 * ⛔ router.use(verifyToken) 같은 광역 미들웨어 추가 절대 금지 (ADR-014).
 *  - webhook 4건 (`/send-unpaid-today-auto-sens`, `/send-trial-today-auto-sens`,
 *    `/send-reminder-auto`, `/send-reminder-auto-sens`) 은 의도적으로 verifyToken
 *    미적용 + 자체 X-API-Key 검증 패턴으로 등록되어 있다.
 *  - n8n / cron 외부 워크플로우가 service account 토큰 없이 호출하므로
 *    광역 verifyToken 추가 시 4건 모두 401 break → 자동발송 중단 (학원 미납자 알림 끊김).
 *  - 새 endpoint 추가 시에는 인증 정책을 endpoint 별로 명시 (verifyToken / X-API-Key).
 */

module.exports = function(router) {
    require('./manual')(router);   // POST /send-unpaid, /send-individual (verifyToken + checkPermission)
    require('./auto')(router);     // POST /send-unpaid-today-auto, /send-trial-today-auto (verifyToken)
    require('./webhooks')(router); // POST /send-*-auto-sens (2건) + /send-reminder-auto + /send-reminder-auto-sens (X-API-Key, 무인증)
};
