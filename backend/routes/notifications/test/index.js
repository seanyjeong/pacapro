/**
 * routes/notifications/test/index.js
 *
 * 알림 테스트 발송 sub-라우터 진입점 (Phase 3 #1, ADR-014 mount-only).
 *  - 부모 `routes/notifications/index.js` 가 `require('./test')(router)` 로 호출.
 *    Node 가 `./test` 를 디렉토리로 인식하면 자동으로 `./test/index.js` 를 require → mount 표면 호환.
 *  - 본 파일은 라우트 정의를 갖지 않는다. sub-라우터 (unpaid / solapi / sens) 위임만 수행.
 *
 * 등록 순서 (중요):
 *  1. unpaid    — POST `/test`                    (단일 endpoint, 솔라피/SENS 듀얼 분기)
 *  2. solapi    — POST `/test-consultation` 외 4건 (모두 고정 경로, 솔라피 채널)
 *  3. sens      — POST `/test-sens-consultation` 외 4건 (모두 고정 경로, SENS 채널)
 *
 *  - 모든 경로가 고정 prefix (와일드카드 X) 라 등록 순서에 따른 라우트 매칭 충돌 X.
 *    그러나 가독성을 위해 "기본 (unpaid) → solapi → sens" 순으로 묶어 둔다.
 *
 * 인증/권한:
 *  - 각 sub-라우터의 endpoint 단위로 verifyToken + checkPermission('notifications', 'edit')
 *    이 적용된다 (원본 정책 보존).
 *  - router 레벨 광역 미들웨어 추가 금지 — webhook/cron 용 무인증 endpoint 가 다른 sub-라우터
 *    (notifications/send.js 의 `/send-*-auto-sens`) 에 섞여 있어, 부모 `notifications/index.js` 와
 *    본 진입점 모두 광역 미들웨어 부착 시 의도치 않은 영향 발생 가능.
 *
 * 리팩 정렬 (RULES / ADR):
 *  - ADR-005 (pool.execute 통일) — sub-라우터 + _utils.js 가 모두 pool.execute 사용.
 *  - ADR-003 (한국어 메시지) — 사용자 노출 메시지 100% 한국어, e.message 누출 0건.
 *  - ADR-007 (보안 영역) — decryptApiKey / sendAlimtalk / sendAlimtalkSolapi 시그니처 무변경.
 *  - ADR-013 (응답 표면 보존) — 9 endpoint 모두 root 키 (`message`, `success`, `requestId`, `groupId`)
 *    유지. 프론트 `src/lib/api/notifications.ts` 의 `SendResponse` 타입 호환.
 *  - ADR-014 (mount-only 진입점) — 동작 변경 0건, sub-라우터 등록만.
 */

// sub-라우터는 `module.exports = function(router) { ... }` 패턴으로 export.
// 부모 router 를 그대로 전달해 endpoint 를 직접 등록한다.
module.exports = function (router) {
    require('./unpaid')(router); // POST /test
    require('./solapi')(router); // POST /test-consultation, /test-trial, /test-overdue, /test-reminder
    require('./sens')(router);   // POST /test-sens-consultation, /test-sens-trial, /test-sens-overdue, /test-sens-reminder
};
