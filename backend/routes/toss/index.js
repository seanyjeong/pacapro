/**
 * paca/toss/index.js — toss 도메인 mount-only 진입점 (Phase 3 #8, ADR-017 자율 진행)
 *
 * paca.js 자동 라우트 등록 (W-6) → app.use('/paca/toss', router) 호출.
 *
 * 상태 (2026-05-02): ⚠️ **보류 (LIVE 미사용)** — 사장님 결정. 토스 결제 안 씀.
 *   webhook 코드만 존재. 위험도 🟢 낮음으로 재분류 (ADR-017).
 *
 * Sub-라우터 (4건) — 등록 순서 = 인증 강도 / 도메인 응집도 기준:
 *   1. plugin     — verifyTossPlugin (X-Toss-Plugin-Key 헤더, 토스 프론트 플러그인)
 *                    GET  /unpaid          — 미납자 목록 조회
 *                    GET  /student/:id     — 특정 학생 결제 정보 조회
 *   2. callbacks  — verifyCallbackSignature (HMAC-SHA256, 토스 결제 완료/취소 콜백)
 *                    POST /payment-callback — 결제 완료 콜백 (트랜잭션, 큐 fallback)
 *                    POST /cancel-callback  — 결제 취소 콜백 (트랜잭션, 큐 fallback)
 *   3. admin      — verifyToken + checkPermission(payments) + checkAcademyAccess
 *                    GET  /history              — 결제 이력 조회
 *                    GET  /queue                — 매칭 대기열 조회
 *                    POST /queue/:id/match      — 수동 매칭 (트랜잭션)
 *                    POST /queue/:id/ignore     — 대기열 무시 처리
 *                    GET  /stats                — 결제 통계 (월별)
 *   4. settings   — verifyToken + checkPermission(settings) + checkAcademyAccess
 *                    GET  /settings — 토스 연동 설정 조회 (callback_secret/plugin_api_key 응답 X)
 *                    PUT  /settings — 토스 연동 설정 저장
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/toss.ts (tossAPI):
 *   getHistory   → { success, total, history }
 *   getQueue     → { success, stats, queue }
 *   manualMatch  → { success, message, paymentId, newStatus, paidAmount }
 *   ignoreQueueItem → { success, message }
 *   getStats     → { success, month, paymentStats, queueStats }
 *   getSettings  → { success, settings, message? }
 *   saveSettings → { success, message }
 *   토스 플러그인 / 토스 콜백 응답 (plugin / callbacks 4 endpoint) 셰이프 1:1 보존.
 *
 * ⛔ ADR-014 — 광역 미들웨어 (router.use(verifyToken) 등) 추가 절대 금지.
 *    plugin / callbacks 6 endpoint 는 의도적으로 verifyToken 미적용 (X-Toss-Plugin-Key /
 *    HMAC-SHA256 자체 검증). 광역 verifyToken 추가 시 토스 측 호출 6건 모두 401 break.
 *    추가 시 깨지는 endpoint 목록:
 *      - GET  /paca/toss/unpaid             (verifyTossPlugin)
 *      - GET  /paca/toss/student/:id        (verifyTossPlugin)
 *      - POST /paca/toss/payment-callback   (verifyCallbackSignature)
 *      - POST /paca/toss/cancel-callback    (verifyCallbackSignature)
 *
 * 보안 (ADR-007) — encrypt / decrypt / crypto.createHmac 시그니처 100% 무변경.
 *   외부 결제 API 호출 X (토스 측이 본 서버를 호출하는 webhook 수신 모델).
 *
 * 회귀 테스트:
 *   __tests__/routes/toss/index.test.js (sub-라우터 require 호출 / 순서 / 광역 미들웨어 0건)
 */

const express = require('express');
const router = express.Router();

require('./plugin')(router);      // verifyTossPlugin — 2 endpoint
require('./callbacks')(router);   // verifyCallbackSignature — 2 endpoint
require('./admin')(router);       // verifyToken + checkPermission(payments) — 5 endpoint
require('./settings')(router);    // verifyToken + checkPermission(settings) — 2 endpoint

module.exports = router;
