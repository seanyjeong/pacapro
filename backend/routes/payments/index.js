/**
 * paca/payments/index.js — payments 도메인 mount-only 진입점 (Phase 3 #6, ADR-017 자율 진행)
 *
 * paca.js 자동 라우트 등록 (W-6) → app.use('/paca/payments', router) 호출.
 *
 * Sub-라우터 (7건) — 등록 순서 = **정적 → /:id 와일드카드** (express 라우트 매칭 의존):
 *   1. bulk      — 정적 POST /bulk-monthly + /generate-prorated + /generate-monthly-for-student
 *   2. prepaid   — 정적 POST /prepaid-preview + /prepaid-pay (트랜잭션)
 *   3. credits   — 정적 GET /credits + /credits/summary
 *   4. stats     — 정적 GET /stats/summary
 *   5. list      — 정적 GET / + /unpaid + /unpaid-today
 *   6. pay       — POST /:id/pay (와일드카드, 정적 + /pay)
 *   7. crud      — GET /:id + POST / + PUT /:id + DELETE /:id
 *
 * ⚠️ 등록 순서 뒤바뀌면:
 *   - credits 가 crud 뒤로 가면 → GET /credits 호출이 GET /:id (id='credits') 로 매칭되어 NaN 5xx
 *   - stats/summary 가 crud 뒤로 가면 → GET /stats/summary 가 GET /:id 매칭 시도 → 'stats' NaN 5xx
 *   - unpaid / unpaid-today 동일 위험
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/payments.ts (paymentsAPI):
 *   getPayments        → { message, payments }
 *   getUnpaidPayments  → { message, payments }
 *   getUnpaidTodayPayments → { message, date, day_of_week, day_name, count, payments }
 *   getPayment         → { payment }
 *   createPayment      → { message, payment }              (POST /, 201)
 *   bulkMonthlyCharge  → { message, created, updated, skipped, withNonSeasonProrated, withCarryover, year, month, due_date }
 *   recordPayment      → { message, payment }              (POST /:id/pay)
 *   updatePayment      → { message, payment }
 *   deletePayment      → { message, payment:{id, student_name} }
 *   getPaymentStats    → { message, stats }
 *   prepaidPreview     → { student_name, monthly_tuition, student_discount_rate, prepaid_discount_rate, months, total_final, total_prepaid_discount, months_payable, months_already_paid }
 *   prepaidPay         → { message, prepaid_group_id, total_amount, total_discount, months_processed, months_skipped }
 *   getCredits         → { credits, stats }
 *   getCreditsSummary  → { students_with_credit, type_stats }
 *
 * ⛔ ADR-014 — 광역 미들웨어 (router.use(verifyToken) 등) 추가 절대 금지.
 *    sub-라우터별 verifyToken + checkPermission 정책 차이 보존:
 *      - bulk / credits / stats / list (대부분) / crud / pay : verifyToken + checkPermission('payments', 'view'|'edit')
 *      - list GET /unpaid-today : verifyToken 만 (PACA automation account 호환)
 *      - prepaid : verifyToken 만 (학원 관리자 직접 호출)
 *      - crud DELETE /:id : verifyToken + requireRole('owner') (owner only)
 *
 * 보안 (ADR-007 + 사장님 결정 2026-05-02):
 *   - 결제 데이터 영속 변경 X (분리/표면만, 동작 1:1 보존)
 *   - decrypt 시그니처 무변경 (학생 이름 복호화)
 *   - 외부 결제 API 호출 X (toss 는 별도 도메인)
 *
 * 회귀 테스트:
 *   __tests__/routes/payments/index.test.js (sub-라우터 require 호출 / 순서 / 광역 미들웨어 0건)
 *   __tests__/routes/payments/{list,credits,crud,bulk,pay,prepaid,stats}.test.js
 */

const express = require('express');
const router = express.Router();

require('./bulk')(router);     // 정적 POST /bulk-monthly + /generate-prorated + /generate-monthly-for-student
require('./prepaid')(router);  // 정적 POST /prepaid-preview + /prepaid-pay
require('./credits')(router);  // 정적 GET /credits + /credits/summary
require('./stats')(router);    // 정적 GET /stats/summary
require('./list')(router);     // 정적 GET / + /unpaid + /unpaid-today
require('./pay')(router);      // 와일드카드 POST /:id/pay
require('./crud')(router);     // 와일드카드 GET /:id + POST / + PUT /:id + DELETE /:id

module.exports = router;
