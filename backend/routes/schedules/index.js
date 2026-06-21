/**
 * paca/schedules/index.js — schedules 도메인 mount-only 진입점 (Phase 3 #7)
 *
 * paca.js 자동 라우트 등록 (W-6) → app.use('/paca/schedules', router) 호출.
 *
 * Sub-라우터 (7건) — 등록 순서 = 정적 경로 우선, /:id 와일드카드 마지막
 * (express 매칭 순서 의존, lesson #205 source 정적 검증으로 회귀 보호):
 *
 *   1. slot                  — GET /slot, POST /slot/student, DELETE /slot/student, POST /slot/move
 *                               (정적 /slot/* 4건 — /:id 보다 먼저 필수)
 *   2. instructor-schedules  — GET /date/:date/instructor-schedules, POST /date/:date/instructor-schedules,
 *                               GET /instructor-schedules/month
 *                               (정적 /date/* + /instructor-schedules/* — /:id 보다 먼저 필수)
 *   3. instructor-attendance — GET /:id/instructor-attendance, POST /:id/instructor-attendance,
 *                               GET /date/:date/instructor-attendance, POST /date/:date/instructor-attendance
 *                               (혼합: 정적 /date/* 2건 + /:id/instructor-attendance 2건)
 *   4. fix-all               — POST /fix-all (owner only, 정적 /fix-all)
 *   5. list                  — GET /, GET /instructor/:instructor_id (목록)
 *   6. attendance            — GET /:id/attendance, POST /:id/attendance (학생 출결)
 *   7. crud                  — GET /:id, POST /, PUT /:id/assign-instructor, PUT /:id, DELETE /:id
 *                               (/:id 와일드카드 마지막)
 *
 * 등록 순서 깨면 GET /paca/schedules/slot 같은 정적 경로가 GET /:id 핸들러로
 * 잘못 매칭되어 NaN id 5xx 회귀 발생.
 *
 * ⛔ ADR-014 — 광역 미들웨어 (router.use(verifyToken) 등) 추가 금지.
 *    schedules 21 endpoint 모두 verifyToken 적용되어 있고 일부는 checkPermission/requireRole 추가.
 *    sub-라우터 내부에서 endpoint 별로 처리. 진입점에 router.use(...) 추가 시
 *    sub-라우터 내부 인증 정책이 한 곳에서 깨질 수 있음.
 *
 * 회귀 테스트: __tests__/routes/schedules/index.test.js
 *   (sub-라우터 require 호출 / 순서 / 광역 미들웨어 0건 source 정적 검증)
 */

const express = require('express');
const router = express.Router();

require('./slot')(router);                    // 정적 /slot/* 4건 (와일드카드 충돌 회피)
require('./instructor-schedules')(router);    // 정적 /date/*/instructor-schedules + /instructor-schedules/month
require('./instructor-attendance')(router);   // 혼합: 정적 /date/* + /:id/instructor-attendance
require('./fix-all')(router);                 // 정적 /fix-all
require('./list')(router);                    // GET / + GET /instructor/:instructor_id
require('./attendance')(router);              // GET /:id/attendance + POST /:id/attendance
require('./crud')(router);                    // GET /:id + POST / + PUT /:id/* + DELETE /:id (/:id 마지막)

module.exports = router;
