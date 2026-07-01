/**
 * paca/seasons/index.js — seasons 도메인 mount-only 진입점
 *
 * paca.js 자동 라우트 등록 (W-6) → app.use('/paca/seasons', router) 호출.
 *
 * Sub-라우터 (5건) — 등록 순서 = 정적 경로 우선, /:id 와일드카드 마지막 (express 매칭 순서 의존):
 *   1. enrollments  — POST /enrollments/:enrollment_id/pay, PUT /enrollments/:enrollment_id,
 *                      POST /enrollments/:enrollment_id/refund-preview, POST /enrollments/:enrollment_id/cancel
 *   2. list         — GET /, GET /active, GET /:id  ← /active 가 /:id 보다 먼저
 *   3. crud         — POST /, PUT /:id, DELETE /:id
 *   4. enroll       — POST /:id/enroll
 *   5. preview      — GET /:id/preview
 *   6. students     — GET /:id/students, DELETE /:id/students/:student_id
 *
 * 등록 순서 깨면 GET /paca/seasons/active 가 GET /:id 핸들러로 잘못 매칭 → NaN id 5xx 회귀.
 *
 * ⛔ ADR-014 — 광역 미들웨어 (router.use(verifyToken) 등) 추가 금지.
 *    seasons 14 endpoint 모두 verifyToken 적용되어 있고 일부는 checkPermission/requireRole 추가.
 *    sub-라우터 내부에서 endpoint 별로 처리. 진입점에 router.use(...) 추가 시
 *    sub-라우터 내부 인증 정책이 한 곳에서 깨질 수 있음.
 *
 * 회귀 테스트: __tests__/routes/seasons/index.test.js (sub-라우터 require 호출 / 순서 / 광역 미들웨어 0건)
 */

const express = require('express');
const router = express.Router();

require('./enrollments')(router);   // 정적 /enrollments/* 4건 (와일드카드 충돌 회피)
require('./list')(router);           // GET / + GET /active + GET /:id
require('./crud')(router);           // POST / + PUT /:id + DELETE /:id
require('./enroll')(router);         // POST /:id/enroll
require('./preview')(router);        // GET /:id/preview
require('./students')(router);       // GET /:id/students + DELETE /:id/students/:student_id

module.exports = router;
