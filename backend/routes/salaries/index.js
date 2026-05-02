/**
 * Salaries Router 진입점 (mount-only, ADR-014)
 * ----------------------------------------------------------------
 * 마운트:
 *   - paca.js W-6 자동 라우트 등록이 `routes/salaries/index.js` 를 require 하여
 *     `app.use('/paca/salaries', router)` 로 마운트.
 *   - 기존 단일 파일 `routes/salaries.js` 는 동일 commit 에서 삭제 (파일/디렉토리 중복 마운트 회피).
 *
 * 분리 (ADR-006 / ADR-017):
 *   - 단일 975줄 → 5 파일 분리. `_utils.js` 는 의존성 re-export only.
 *   - 본 파일은 sub-라우터를 require + 등록 순서 코멘트만. 라우트 정의 / 미들웨어 추가 0건.
 *
 * 등록 순서 (express 라우트 매칭은 등록 순서 의존):
 *   1. `payment`     ← POST /bulk-pay (고정 경로) + POST /:id/pay (와일드카드 suffix '/pay')
 *   2. `calculation` ← POST /calculate (고정) + GET /work-summary/:instructorId/:yearMonth (고정 prefix)
 *                       + POST /:id/recalculate (와일드카드 suffix '/recalculate')
 *   3. `crud`        ← GET / + GET /:id + POST / + PUT /:id + DELETE /:id (와일드카드 마지막)
 *
 *   ⚠️ 순서 변경 시 깨지는 케이스:
 *     - `crud` 가 먼저 등록되면 `GET /:id`, `POST /:id/pay`, `POST /:id/recalculate` 의
 *       매칭 우선순위가 꼬여 `bulk-pay` 같은 고정 경로가 `/:id` 로 잘못 잡힐 수 있음.
 *     - 각 sub-라우터 내부 정의 순서도 동일 정책: 고정 경로 → 와일드카드 prefix → 와일드카드 only.
 *
 * 인증 정책 (ADR-014):
 *   - sub-라우터 내부에서 endpoint 별로 `verifyToken` + `checkPermission` / `requireRole` 적용.
 *   - 본 파일에서 `router.use(verifyToken)` 같은 광역 미들웨어 추가 금지 (현재 모든 endpoint 가
 *     이미 verifyToken 을 통과하지만, 향후 webhook/외부 cron endpoint 추가 시 깨지는 것을 방지).
 *
 * 응답 표면 보존 (ADR-013):
 *   - 모든 sub-라우터는 기존 root 키 (`{message, salaries}`, `{salary}`, `{salary, attendance_summary}`,
 *     `{message, instructor, salary}`, `{message, instructor, work_summary}`,
 *     `{message, paid_count, salaries}`) 를 그대로 유지. 프론트 `src/lib/api/salaries.ts` 호환.
 */
const express = require('express');
const router = express.Router();

require('./payment')(router);
require('./calculation')(router);
require('./crud')(router);

module.exports = router;
