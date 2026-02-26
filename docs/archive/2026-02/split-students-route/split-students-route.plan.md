# Plan: split-students-route

> **Date**: 2026-02-26
> **Feature**: students.js 3,609줄 → 도메인별 파일 분리
> **Type**: Refactoring (로직 변경 없음)
> **Risk Level**: Medium (프로덕션 라우트, 단 로직 변경 0)

---

## 1. 배경

CTO 리뷰 W-1 지적: `backend/routes/students.js`가 3,609줄로 God Object 패턴.
CRUD + 수업일관리 + 휴원/복원 + 학년승급 + 크레딧 + 출결조회가 모두 한 파일에 존재.

## 2. 목표

- `students.js` 단일 파일 → 5~6개 도메인별 파일로 분리
- **비즈니스 로직 0% 변경** — 코드를 잘라서 옮기기만 함
- 라우터 엔드포인트, 미들웨어, 응답 포맷 전부 동일 유지
- 기존 API 호출하는 프론트엔드 영향 0

## 3. 현재 라우트 분석 (24개 엔드포인트)

| 라인 | 메서드 | 경로 | 도메인 |
|------|--------|------|--------|
| 249 | GET | /rest-ended | **enrollment** |
| 301 | GET | / | **crud** |
| 422 | GET | /class-days | **class-days** |
| 465 | PUT | /class-days/bulk | **class-days** |
| 558 | PUT | /:id/class-days | **class-days** |
| 675 | DELETE | /:id/class-days-schedule | **class-days** |
| 702 | GET | /:id | **crud** |
| 785 | POST | / | **crud** |
| 1213 | PUT | /:id | **crud** |
| 1953 | DELETE | /:id | **crud** |
| 2027 | POST | /:id/withdraw | **enrollment** |
| 2096 | POST | /grade-upgrade | **enrollment** |
| 2221 | POST | /auto-promote | **enrollment** |
| 2364 | GET | /:id/seasons | **enrollment** |
| 2439 | GET | /search | **crud** |
| 2502 | POST | /:id/process-rest | **rest** |
| 2738 | POST | /:id/resume | **rest** |
| 2942 | GET | /:id/rest-credits | **credits** |
| 3056 | POST | /:id/manual-credit | **credits** |
| 3223 | GET | /:id/credits | **credits** |
| 3250 | PUT | /:id/credits/:creditId | **credits** |
| 3331 | DELETE | /:id/credits/:creditId | **credits** |
| 3375 | POST | /:id/credits/:creditId/apply | **credits** |
| 3505 | GET | /:id/attendance | **attendance** |

## 4. 분리 계획

```
backend/routes/students/
├── index.js              # router 등록만 (~30줄)
├── _utils.js             # parseClassDaysWithSlots, autoAssign 등 공유 유틸 (~200줄)
├── crud.js               # GET /, GET /:id, POST /, PUT /:id, DELETE /:id, GET /search (~1,700줄)
├── classDays.js          # GET /class-days, PUT /class-days/bulk, PUT /:id/class-days, DELETE /:id/class-days-schedule (~400줄)
├── enrollment.js         # GET /rest-ended, POST /:id/withdraw, POST /grade-upgrade, POST /auto-promote, GET /:id/seasons (~500줄)
├── rest.js               # POST /:id/process-rest, POST /:id/resume (~400줄)
├── credits.js            # GET /:id/rest-credits, POST /:id/manual-credit, GET /:id/credits, PUT /:id/credits/:creditId, DELETE /:id/credits/:creditId, POST /:id/credits/:creditId/apply (~500줄)
└── attendance.js         # GET /:id/attendance (~100줄)
```

## 5. 구현 순서

### Phase 1: 구조 준비
1. `backend/routes/students/` 디렉토리 생성
2. `_utils.js` — 공유 유틸 함수 이동 (parseClassDaysWithSlots, extractDayNumbers, getTimeSlotForDay, autoAssignStudentToSchedules)
3. `index.js` — 서브 라우터 등록 스켈레톤

### Phase 2: 작은 것부터 분리
4. `attendance.js` — 가장 작음 (~100줄), 의존성 없음
5. `credits.js` — 독립적인 크레딧 관련 6개 라우트
6. `classDays.js` — 수업일 관리 4개 라우트 (_utils 의존)

### Phase 3: 큰 것 분리
7. `enrollment.js` — 등록/퇴원/학년승급 4개 라우트
8. `rest.js` — 휴원/복원 2개 라우트 (복잡도 높음)
9. `crud.js` — 핵심 CRUD 5개 라우트 (가장 큼, 마지막에)

### Phase 4: 연결 & 정리
10. `index.js`에서 모든 서브 라우터 `router.use()` 연결
11. 기존 `students.js` → `students/index.js`로 전환
12. `paca.js`의 require 경로 확인 (Node.js가 디렉토리면 index.js 자동 로드하므로 변경 불필요)

## 6. 안전 장치

- **로직 변경 0**: 코드를 그대로 잘라서 붙여넣기만
- **테스트**: 기존 58개 유닛테스트 + 분리 후 API 수동 확인
- **원복**: `git checkout` 한 방으로 원복
- **paca.js 변경 불필요**: `require('./routes/students')` → Node.js가 `students/index.js` 자동 로드

## 7. 예상 결과

| 파일 | 예상 줄수 |
|------|----------|
| index.js | ~30 |
| _utils.js | ~200 |
| crud.js | ~1,700 |
| classDays.js | ~400 |
| enrollment.js | ~500 |
| rest.js | ~400 |
| credits.js | ~500 |
| attendance.js | ~100 |
| **합계** | ~3,830 (import 중복분 +) |

최대 파일이 crud.js ~1,700줄로, 3,609줄의 절반 이하.

## 8. 완료 기준

- [ ] 모든 24개 엔드포인트 동일하게 작동
- [ ] `paca.js` 수정 불필요 확인
- [ ] 기존 테스트 58개 통과
- [ ] 프론트엔드 API 호출 영향 없음
