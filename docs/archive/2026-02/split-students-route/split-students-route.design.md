# Design: split-students-route

> **Date**: 2026-02-26
> **Plan**: [split-students-route.plan.md](../../01-plan/features/split-students-route.plan.md)
> **Type**: Refactoring (로직 변경 없음)

---

## 1. 현재 구조

```
backend/routes/students.js (3,609줄, 단일 파일)
  ├── L1-8:     imports
  ├── L9-56:    유틸 함수 (parseClassDaysWithSlots, extractDayNumbers, getTimeSlotForDay)
  ├── L58-152:  autoAssignStudentToSchedules()
  ├── L154-242: reassignStudentSchedules()
  ├── L244-300: GET /rest-ended          [enrollment]
  ├── L301-420: GET /                    [crud]
  ├── L422-463: GET /class-days          [classDays]
  ├── L465-556: PUT /class-days/bulk     [classDays]
  ├── L558-674: PUT /:id/class-days      [classDays]
  ├── L675-700: DELETE /:id/class-days-schedule [classDays]
  ├── L702-783: GET /:id                 [crud]
  ├── L785-1211: POST /                  [crud] ← 가장 큰 핸들러 (426줄)
  ├── L1213-1951: PUT /:id               [crud] ← 두 번째 (738줄)
  ├── L1953-2025: DELETE /:id            [crud]
  ├── L2027-2094: POST /:id/withdraw     [enrollment]
  ├── L2096-2219: POST /grade-upgrade    [enrollment]
  ├── L2221-2362: POST /auto-promote     [enrollment]
  ├── L2364-2437: GET /:id/seasons       [enrollment]
  ├── L2439-2495: GET /search            [crud]
  ├── L2502-2736: POST /:id/process-rest [rest]
  ├── L2738-2940: POST /:id/resume       [rest]
  ├── L2942-3054: GET /:id/rest-credits  [credits]
  ├── L3056-3221: POST /:id/manual-credit [credits]
  ├── L3223-3248: GET /:id/credits       [credits]
  ├── L3250-3329: PUT /:id/credits/:creditId [credits]
  ├── L3331-3373: DELETE /:id/credits/:creditId [credits]
  ├── L3375-3503: POST /:id/credits/:creditId/apply [credits]
  ├── L3505-3605: GET /:id/attendance    [attendance]
  └── L3607:    module.exports = router
```

## 2. 목표 구조

```
backend/routes/students/
├── index.js          # 서브 라우터 등록 (router.use)
├── _utils.js         # 공유 유틸 함수
├── crud.js           # 핵심 CRUD + 검색
├── classDays.js      # 수업일 관리
├── enrollment.js     # 등록/퇴원/학년승급
├── rest.js           # 휴원/복원
├── credits.js        # 크레딧 관리
└── attendance.js     # 출결 조회
```

## 3. 파일별 상세 설계

### 3.1 `_utils.js` — 공유 유틸 함수

**출처**: L9-242 (유틸 함수 + 스케줄 배정 함수)

```javascript
// exports:
module.exports = {
    parseClassDaysWithSlots,    // L17-39
    extractDayNumbers,          // L45-47
    getTimeSlotForDay,          // L53-56
    autoAssignStudentToSchedules, // L67-152
    reassignStudentSchedules,     // L159-242
};
```

**의존성**: `db`, `logger`
**사용처**: `crud.js` (POST, PUT에서 autoAssign/reassign), `classDays.js` (bulk/individual에서 reassign)

### 3.2 `crud.js` — 핵심 CRUD + 검색

| 메서드 | 경로 | 원본 라인 | 줄수 |
|--------|------|----------|------|
| GET | / | L301-420 | 119 |
| GET | /:id | L702-783 | 81 |
| POST | / | L785-1211 | 426 |
| PUT | /:id | L1213-1951 | 738 |
| DELETE | /:id | L1953-2025 | 72 |
| GET | /search | L2439-2495 | 56 |

**총**: ~1,492줄
**의존성**: `_utils.js` (autoAssign, reassign, parseClassDaysWithSlots), `encryption`, `dueDateCalculator`, `logger`, `db`

```javascript
const router = require('express').Router();
const db = require('../../config/database');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { encrypt, decrypt, encryptFields, decryptFields, decryptArrayFields, ENCRYPTED_FIELDS } = require('../../utils/encryption');
const { calculateDueDate } = require('../../utils/dueDateCalculator');
const logger = require('../../utils/logger');
const { parseClassDaysWithSlots, autoAssignStudentToSchedules, reassignStudentSchedules } = require('./_utils');
```

### 3.3 `classDays.js` — 수업일 관리

| 메서드 | 경로 | 원본 라인 | 줄수 |
|--------|------|----------|------|
| GET | /class-days | L422-463 | 41 |
| PUT | /class-days/bulk | L465-556 | 91 |
| PUT | /:id/class-days | L558-674 | 116 |
| DELETE | /:id/class-days-schedule | L675-700 | 25 |

**총**: ~273줄
**의존성**: `_utils.js` (parseClassDaysWithSlots, reassign), `encryption` (decrypt name), `logger`, `db`

### 3.4 `enrollment.js` — 등록/퇴원/학년승급

| 메서드 | 경로 | 원본 라인 | 줄수 |
|--------|------|----------|------|
| GET | /rest-ended | L249-300 | 51 |
| POST | /:id/withdraw | L2027-2094 | 67 |
| POST | /grade-upgrade | L2096-2219 | 123 |
| POST | /auto-promote | L2221-2362 | 141 |
| GET | /:id/seasons | L2364-2437 | 73 |

**총**: ~455줄
**의존성**: `encryption` (decrypt), `logger`, `db`

### 3.5 `rest.js` — 휴원/복원

| 메서드 | 경로 | 원본 라인 | 줄수 |
|--------|------|----------|------|
| POST | /:id/process-rest | L2502-2736 | 234 |
| POST | /:id/resume | L2738-2940 | 202 |

**총**: ~436줄
**의존성**: `_utils.js` (autoAssign), `encryption` (decrypt), `logger`, `db`

### 3.6 `credits.js` — 크레딧 관리

| 메서드 | 경로 | 원본 라인 | 줄수 |
|--------|------|----------|------|
| GET | /:id/rest-credits | L2942-3054 | 112 |
| POST | /:id/manual-credit | L3056-3221 | 165 |
| GET | /:id/credits | L3223-3248 | 25 |
| PUT | /:id/credits/:creditId | L3250-3329 | 79 |
| DELETE | /:id/credits/:creditId | L3331-3373 | 42 |
| POST | /:id/credits/:creditId/apply | L3375-3503 | 128 |

**총**: ~551줄
**의존성**: `encryption` (decrypt name), `logger`, `db`

### 3.7 `attendance.js` — 출결 조회

| 메서드 | 경로 | 원본 라인 | 줄수 |
|--------|------|----------|------|
| GET | /:id/attendance | L3505-3605 | 100 |

**총**: ~100줄
**의존성**: `logger`, `db`

### 3.8 `index.js` — 라우터 등록

```javascript
const express = require('express');
const router = express.Router();

const crudRoutes = require('./crud');
const classDaysRoutes = require('./classDays');
const enrollmentRoutes = require('./enrollment');
const restRoutes = require('./rest');
const creditsRoutes = require('./credits');
const attendanceRoutes = require('./attendance');

router.use('/', crudRoutes);
router.use('/', classDaysRoutes);
router.use('/', enrollmentRoutes);
router.use('/', restRoutes);
router.use('/', creditsRoutes);
router.use('/', attendanceRoutes);

module.exports = router;
```

## 4. 라우트 등록 순서 (중요!)

Express는 라우트를 **등록 순서대로** 매칭합니다. 특히 다음 충돌 주의:

| 순서 | 경로 | 설명 |
|------|------|------|
| 1 | GET /rest-ended | `/rest-ended` 먼저 → `:id`에 안 걸림 |
| 2 | GET /search | `/search` 먼저 → `:id`에 안 걸림 |
| 3 | GET /class-days | `/class-days` 먼저 |
| 4 | GET / | 리스트 |
| 5 | GET /:id | 개별 조회 |
| 6 | 나머지 `/:id/*` | 순서 무관 |

**해결 방법**: `index.js`에서 등록 순서를 원본과 동일하게 유지.
- 원본 순서: rest-ended(249) → list(301) → class-days(422) → /:id(702) → search(2439)
- `search`는 원본에서 `:id` 뒤에 있지만, Express에서 `/search`는 문자열 매칭이라 `:id`보다 먼저 매칭되지 않음 → 실제로는 `search`가 `req.params.id = "search"`로 들어가서 GET /:id에 걸릴 수 있음!

**확인 필요**: 원본에서 GET /search(L2439)가 GET /:id(L702) 뒤에 있는데, 원본에서도 같은 문제가 있을 수 있음. 분리 시에도 동일 순서 유지하면 동일 동작 보장.

→ **결론**: `index.js`에서 **원본 라인 순서와 동일한 순서**로 router.use 등록.

```javascript
// 원본 순서와 동일하게 등록
router.use('/', enrollmentRoutes);   // rest-ended가 249에서 제일 먼저
router.use('/', crudRoutes);          // list(301), /:id(702), POST(785), PUT(1213), DELETE(1953), search(2439)
router.use('/', classDaysRoutes);     // 422-700 (crud 내부의 GET / 뒤)
// → 아 이러면 순서가 꼬인다.
```

**최종 결정**: 서브 라우터 대신, 각 파일이 `(router)` 매개변수로 받아서 **같은 router에 직접 등록**하는 방식 사용. 이러면 등록 순서를 `index.js`에서 정확히 제어 가능.

```javascript
// index.js
const express = require('express');
const router = express.Router();

// 원본 라인 순서대로 등록
require('./enrollment')(router);  // L249: GET /rest-ended
require('./crud')(router);        // L301: GET /, L702: GET /:id, etc.
require('./classDays')(router);   // L422: GET /class-days, etc.
require('./rest')(router);        // L2502: POST /:id/process-rest
require('./credits')(router);     // L2942: GET /:id/rest-credits
require('./attendance')(router);  // L3505: GET /:id/attendance

module.exports = router;
```

**하지만 원본 순서가 파일 단위로 깔끔하게 안 나뉨:**
- enrollment: L249 (rest-ended) → 중간에 crud(L301) → 다시 enrollment(L2027)
- classDays: L422-700 → 중간에 crud(L702)

→ **최최종 결정**: 각 파일이 `router`를 받아서 등록하되, `index.js`에서 **정확한 원본 순서**로 호출.

```javascript
// index.js — 원본 students.js와 정확히 같은 순서로 등록
const router = require('express').Router();

require('./enrollment').registerRestEnded(router);     // L249
require('./crud').registerList(router);                 // L301
require('./classDays').register(router);                // L422-700
require('./crud').registerDetail(router);               // L702-2025
require('./enrollment').registerActions(router);        // L2027-2437
require('./crud').registerSearch(router);               // L2439
require('./rest').register(router);                     // L2502-2940
require('./credits').register(router);                  // L2942-3503
require('./attendance').register(router);               // L3505

module.exports = router;
```

→ 이건 너무 복잡. **더 단순한 접근**: 원본에서 `/search`가 `/:id` 뒤에 있지만 실제로 문제 없는지 확인 후, 각 파일은 자체 Router를 만들고, 충돌 가능한 고정 경로(`/rest-ended`, `/search`, `/class-days`, `/grade-upgrade`, `/auto-promote`)를 먼저 등록하면 됨.

## 5. 최종 설계: 단순 위임 패턴

각 서브 파일은 `module.exports = function(router) { ... }` 패턴:

```javascript
// classDays.js
const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
// ...

module.exports = function(router) {
    router.get('/class-days', verifyToken, checkPermission('class_days', 'view'), async (req, res) => {
        // ... 기존 코드 그대로
    });

    router.put('/class-days/bulk', verifyToken, checkPermission('class_days', 'edit'), async (req, res) => {
        // ... 기존 코드 그대로
    });
    // ...
};
```

```javascript
// index.js — 원본 순서 그대로 등록
const router = require('express').Router();

require('./enrollment')(router);   // GET /rest-ended (L249)
require('./crud')(router);         // GET / (L301), 이후 GET /:id, POST, PUT, DELETE, GET /search
require('./classDays')(router);    // GET /class-days (L422) ~ DELETE /:id/class-days-schedule (L700)
require('./rest')(router);         // POST /:id/process-rest, POST /:id/resume
require('./credits')(router);     // 크레딧 관련 6개
require('./attendance')(router);  // GET /:id/attendance

module.exports = router;
```

**문제**: `crud.js` 내부에서 GET / (L301) → classDays(L422) → GET /:id (L702) 순서인데, classDays가 crud 중간에 끼어있음.

**해결**: crud.js 내에서 라우트 등록 순서:
1. GET / (L301)
2. GET /:id (L702) — `/class-days`는 별도 파일이라 crud에서 등록 안 됨 → `:id`에 "class-days"가 걸려도 DB에서 못 찾아서 404 반환
3. POST / (L785)
4. PUT /:id (L1213)
5. DELETE /:id (L1953)
6. GET /search (L2439) — 역시 `:id`에 "search"가 걸리지만, 원본에서도 같은 위치

→ 원본에서 `GET /search`가 `GET /:id` 뒤에 있으므로, `search`라는 ID로 학생 조회를 먼저 시도하고 없으면 404. 실제로는 학생 ID가 정수이므로 `parseInt("search") = NaN` → 에러 처리됨. **분리 후에도 동일 동작.**

실제로 확인: 원본에서 classDays(L422)가 GET /:id(L702)보다 먼저 등록되어 있으므로, `/class-days` 요청은 `GET /class-days`에 먼저 매칭됨. 분리 후에도 `index.js`에서 classDays를 crud보다 먼저(또는 직후에) 등록하면 동일.

**최종 index.js 순서:**

```javascript
const router = require('express').Router();

// 1. 고정 경로 먼저 (enrollment의 /rest-ended)
require('./enrollment')(router);
// 2. classDays (고정 경로 /class-days, /class-days/bulk)
require('./classDays')(router);
// 3. CRUD (GET /, POST /, GET /search 포함 → 이후 /:id 패턴)
require('./crud')(router);
// 4. 나머지 /:id/* 하위 경로 (순서 무관)
require('./rest')(router);
require('./credits')(router);
require('./attendance')(router);

module.exports = router;
```

이러면:
- `/rest-ended` → enrollment에서 매칭 (`:id`보다 먼저)
- `/class-days` → classDays에서 매칭 (`:id`보다 먼저)
- `/grade-upgrade`, `/auto-promote` → enrollment에서 매칭 (`:id`보다 먼저)
- `/search` → crud 내에서 `:id` 뒤에 등록되지만, 원본과 동일 순서이므로 동일 동작
- `/:id` → crud에서 매칭
- `/:id/process-rest` 등 → 각 파일에서 매칭

## 6. 구현 순서 (안전 우선)

| Phase | 작업 | 위험도 |
|-------|------|--------|
| 1 | `students/` 디렉토리 생성 + `_utils.js` 작성 | 없음 (기존 파일 미수정) |
| 2 | `attendance.js` 분리 (100줄, 의존성 최소) | 최소 |
| 3 | `credits.js` 분리 (551줄, 독립적) | 낮음 |
| 4 | `classDays.js` 분리 (273줄) | 낮음 |
| 5 | `enrollment.js` 분리 (455줄) | 낮음 |
| 6 | `rest.js` 분리 (436줄) | 낮음 |
| 7 | `crud.js` 분리 (1,492줄, 핵심) | 중간 |
| 8 | `index.js` 작성 + 기존 students.js 교체 | 중간 |
| 9 | 테스트 실행 + API 검증 | - |

## 7. 검증 방법

1. `npm test` — 기존 58개 유닛테스트 통과
2. 백엔드 재시작 후 주요 API 수동 확인:
   - `GET /paca/students` (목록)
   - `GET /paca/students/:id` (상세)
   - `GET /paca/students/class-days` (수업일)
   - `GET /paca/students/:id/attendance` (출결)
3. `paca.js` 수정 불필요 확인 (`require('./routes/students')` → `students/index.js` 자동 로드)

## 8. 롤백 계획

```bash
# 1초 만에 원복
git checkout -- backend/routes/students.js
rm -rf backend/routes/students/
```

## 9. 완료 기준

- [ ] 기존 students.js 삭제 → students/ 디렉토리로 완전 교체
- [ ] 24개 엔드포인트 모두 동일 동작
- [ ] paca.js 변경 없음
- [ ] npm test 58개 통과
- [ ] 최대 파일 줄수 < 1,700줄 (crud.js)
