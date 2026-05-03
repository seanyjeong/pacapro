/**
 * routes/consultations/index.js
 *
 * 상담 도메인 mount-only 진입점 (Phase 3 #2, ADR-014 mount-only).
 *
 * ## 마운트 (paca.js 자동 등록 W-6)
 * paca.js 가 `routes/` 디렉토리 스캔 시 `consultations/` 폴더를 발견 → 본 `index.js` 를
 * require → `app.use('/paca/consultations', router)` 로 마운트.
 *
 * 동작 변경 0건 (라우트 / 미들웨어 / 응답 모두 sub-라우터 위임).
 *
 * ## 등록 순서 (필수 — express 라우트 매칭 순서 의존)
 * express 는 등록 순서대로 매칭. `/:id` 와일드카드 라우트보다 **먼저** 모든 고정 경로
 * (`/settings/*`, `/calendar/*`, `/booked-times`, `/by-student/*`, `/direct`, `/learning`)
 * 가 등록되어야 한다. 순서가 뒤바뀌면 `GET /booked-times` 같은 호출이 `GET /:id` 핸들러로
 * 잘못 라우팅되어 NaN id 로 5xx.
 *
 * 1. `settings.js`   — GET/PUT `/settings/info`, PUT `/settings/weekly-hours`,
 *                      POST `/settings/blocked-slots`, DELETE `/settings/blocked-slots/:id`
 *                      (모든 경로 `/settings/` prefix — 와일드카드 `/:id` 와 충돌 X)
 * 2. `calendar.js`   — GET `/calendar/events`, GET `/booked-times`,
 *                      GET `/by-student/:studentId`
 *                      (`/calendar/`, `/booked-times`, `/by-student/` 모두 고정 prefix)
 * 3. `learning.js`   — POST `/learning` (고정 경로)
 * 4. `conversion.js` — POST `/:id/convert-to-trial`, POST `/:id/convert-to-pending`
 *                      (`/:id/convert-*` — `:id` 와일드카드지만 다음 segment 가 고정이라 충돌 X.
 *                      crud 의 PUT `/:id` 보다 먼저 등록할 필요는 없음 — segment 수가 다름.
 *                      그러나 가독성 + write.js 안의 `/:id/link-student` 와 묶이는 의미상
 *                      conversion → write 순으로 둠.)
 * 5. `write.js`      — PUT `/:id`, POST `/direct`, POST `/:id/link-student`
 *                      (`/:id` 등록 — list-detail 의 GET `/:id` / DELETE `/:id` 와 라우트 매칭은
 *                      method 가 다르면 별개로 처리되므로 등록 순서 충돌 X.
 *                      `/direct` 는 고정 경로, write 안에서 PUT/POST 만 다룸.)
 * 6. `list-detail.js`— GET `/`, GET `/:id`, DELETE `/:id`
 *                      (마지막 단계로 두어 모든 고정 경로 등록 후 `/:id` 와일드카드 매칭).
 *
 * ## ADR-014 (mount-only 진입점 정책)
 * - 본 진입점에서 `router.use(verifyToken)` 같은 광역 미들웨어 추가 절대 금지.
 *   인증은 각 sub-라우터의 endpoint 별 `verifyToken` 으로 적용 (원본 정책 보존).
 * - JSDoc / 등록 순서 코멘트 외 동작 추가 X.
 *
 * ## 회귀 테스트
 * - `__tests__/routes/consultations/index.test.js` 가 sub-라우터 6건 require 호출 / 호출 순서 /
 *   동일 router 인스턴스 전달 / express Router 시그니처 / `app.use` 마운트 호환 5가지 보장.
 */

const express = require('express');
const router = express.Router();

// 등록 순서 중요 (위 JSDoc 참조)
require('./settings')(router);     // GET/PUT /settings/info, PUT /settings/weekly-hours,
                                   // POST /settings/blocked-slots, DELETE /settings/blocked-slots/:id
require('./calendar')(router);     // GET /calendar/events, GET /booked-times,
                                   // GET /by-student/:studentId
require('./learning')(router);     // POST /learning
require('./conversion')(router);   // POST /:id/convert-to-trial, POST /:id/convert-to-pending
require('./write')(router);        // PUT /:id, POST /direct, POST /:id/link-student
require('./list-detail')(router);  // GET /, GET /:id, DELETE /:id

module.exports = router;
