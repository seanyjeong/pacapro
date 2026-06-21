/**
 * routes/students/crud/index.js
 *
 * 학생 CRUD sub-라우터 mount-only 진입점 (ADR-014).
 *
 * ## 마운트 흐름
 * 1. paca.js 자동 라우트 등록 (W-6) 이 `routes/students/` 디렉토리를 발견하면
 *    `routes/students/index.js` 를 require → `app.use('/paca/students', studentsRouter)`.
 * 2. 부모 `routes/students/index.js` 가 `require('./crud')(router)` 호출.
 *    Node require resolve 가 `crud.js` 파일이 없으면 `crud/` 디렉토리 + `crud/index.js`
 *    자동 처리 → 본 파일 실행.
 * 3. 본 파일이 sub-라우터 6 파일 (list, detail, create, update, remove, search)
 *    을 require 하여 동일 router 인스턴스에 endpoint 들을 등록.
 *
 * ## ⛔ 광역 미들웨어 추가 금지 (ADR-014)
 * - `router.use(verifyToken)` 같은 광역 미들웨어 절대 추가 X.
 *   각 sub-라우터가 endpoint 별로 인증 정책 (verifyToken / checkPermission / requireRole) 을
 *   직접 적용한다. 광역 적용 시 sub-라우터의 의도된 인증 모델이 한 곳에서 깨짐.
 * - 본 모듈은 endpoint 정의 / 미들웨어 추가 / 응답 변경 0건. mount-only.
 *
 * ## 등록 순서 — ⚠️ 변경 금지
 * - `list` (GET /), `detail` (GET /:id), `create` (POST /), `update` (PUT /:id),
 *   `remove` (DELETE /:id), `search` (GET /search) 순.
 * - **원본 동작 보존 (ADR-013 핵심)**: GET /search 는 GET /:id 뒤에 등록되어 있어
 *   express 라우트 매칭 우선순위 상 `/search` 호출이 `:id="search"` 로 잡혀 NaN 처리됨.
 *   사실상 dead code 지만 원본 동작 100% 보존을 위해 동일 순서 유지.
 *   별도 트랙 (라우트 정상화 + 프론트 동시 검증) 진행 시 `search` 를 `detail` 앞으로 이동.
 *
 * ## 분리 배경
 * - 원본 `routes/students/crud.js` (1,638줄 단일, 6 endpoint) → 본 디렉토리 7 파일.
 * - Phase 3 #4, ADR-017 자율 진행. backup tag: `before-refactor-students-crud-20260502`.
 * - 응답 표면 (ADR-013) + 18 필드 dynamic update / 26 컬럼 INSERT 동작 (ADR-015) 보존.
 */

module.exports = function(router) {
    // 등록 순서 = 원본 students/crud.js 와 동일. 변경 금지.
    require('./list')(router);     // GET /
    require('./detail')(router);   // GET /:id
    require('./create')(router);   // POST /
    require('./update')(router);   // PUT /:id
    require('./remove')(router);   // DELETE /:id
    require('./search')(router);   // GET /search (원본 :id 뒤 = NaN 동작 보존)
};
