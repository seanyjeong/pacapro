/**
 * routes/instructors/index.js
 *
 * 강사 도메인 mount-only 진입점 (sub-라우터 require + router export).
 *
 * ## 마운트 (paca.js 자동 등록 W-6)
 * paca.js 가 `routes/` 디렉토리 스캔 시 `instructors/` 폴더를 발견 → 본 `index.js` 를
 * require → `app.use('/paca/instructors', router)` 로 마운트.
 *
 * 동작 변경 0건 (라우트 / 미들웨어 / 응답 모두 sub-라우터 위임).
 *
 * ## 등록 순서 (필수 — express 라우트 매칭 순서 의존)
 * express 는 등록 순서대로 매칭. `/:id` 와일드카드 라우트보다 **먼저** 모든 고정 경로
 * (`/overtime/*`, `/verify-admin-password`) 가 등록되어야 한다. 순서가 뒤바뀌면
 * `GET /overtime/pending` 같은 호출이 `GET /:id` 핸들러로 잘못 라우팅되어 NaN id 로 5xx.
 *
 * 1. `auth.js` — POST `/verify-admin-password` (고정 경로)
 *      ⛔ ADR-007 보안 영역: bcrypt.compare 직접 호출 → 자동 변경 절대 X. 본 sub-라우터
 *      내부 로직은 원본 instructors.js 에서 그대로 이전된 코드 (db.query 포함). DB 패턴
 *      통일 (ADR-005) / 한국어 메시지 (ADR-003) 도 별도 사장님 컨펌 후에만 진행.
 * 2. `overtime.js` — GET `/overtime/pending`, GET `/overtime/history`,
 *      PUT `/overtime/:approvalId/approve`, POST `/:id/overtime`
 *      (앞 3개 = 고정 경로, 마지막 1개는 `:id` 패턴이지만 `/:id/overtime` 으로 충돌 X)
 * 3. `crud.js` — GET `/`, GET `/:id`, POST `/`, PUT `/:id`, DELETE `/:id`
 * 4. `attendance.js` — POST `/:id/attendance`, GET `/:id/attendance`
 *
 * ## ADR-014 (mount-only 진입점 정책)
 * - 본 진입점에서 `router.use(verifyToken)` 같은 광역 미들웨어 추가 절대 금지.
 *   인증은 각 sub-라우터의 endpoint 별 `verifyToken` + `checkPermission(...)` 으로 적용.
 * - JSDoc / 등록 순서 코멘트 외 동작 추가 X.
 *
 * ## 회귀 테스트
 * - `__tests__/routes/instructors/index.test.js` 가 sub-라우터 4건 require 호출 / 호출 순서 /
 *   동일 router 인스턴스 전달 / express Router 시그니처 / `app.use` 마운트 호환 5가지 보장.
 */

const express = require('express');
const router = express.Router();

// 등록 순서 중요 (위 JSDoc 참조)
require('./auth')(router);          // POST /verify-admin-password (보안 영역, ADR-007)
require('./overtime')(router);      // GET /overtime/pending, GET /overtime/history,
                                    // PUT /overtime/:approvalId/approve, POST /:id/overtime
require('./crud')(router);          // GET /, GET /:id, POST /, PUT /:id, DELETE /:id
require('./attendance')(router);    // POST /:id/attendance, GET /:id/attendance

module.exports = router;
