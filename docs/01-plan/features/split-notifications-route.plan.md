# Plan: split-notifications-route

> **Date**: 2026-02-26
> **Feature**: notifications.js 3,538줄 → 도메인별 파일 분리
> **Type**: Refactoring (로직 변경 없음)
> **Risk Level**: Medium (프로덕션 라우트, 단 로직 변경 0)
> **CTO Review**: W-1 (God Object 패턴 — notifications.js)

---

## 1. 배경

CTO 리뷰 W-1 지적: `backend/routes/notifications.js`가 3,538줄로 God Object 패턴.
알림 설정 + 솔라피 발송 + SENS 발송 + 테스트 + 로그/통계가 모두 한 파일에 존재.

`students.js` 3,609줄 분리를 성공적으로 완료(Match Rate 98%)했으므로, 동일 패턴으로 진행.

## 2. 목표

- `notifications.js` 단일 파일 → 5~6개 도메인별 파일로 분리
- **비즈니스 로직 0% 변경** — 코드를 잘라서 옮기기만 함
- 라우터 엔드포인트, 미들웨어, 응답 포맷 전부 동일 유지
- 기존 API 호출하는 프론트엔드 영향 0

## 3. 현재 라우트 분석 (21개 엔드포인트)

| 라인 | 메서드 | 경로 | 도메인 |
|------|--------|------|--------|
| 48 | GET | /settings | **settings** |
| 203 | PUT | /settings | **settings** |
| 576 | POST | /test | **test** (솔라피 납부안내) |
| 728 | POST | /send-unpaid | **send** (솔라피 수동) |
| 956 | POST | /send-individual | **send** (솔라피 개별) |
| 1137 | GET | /logs | **logs** |
| 1206 | POST | /send-unpaid-today-auto | **send** (솔라피 자동) |
| 1469 | POST | /test-consultation | **test** (솔라피 상담) |
| 1613 | POST | /test-trial | **test** (솔라피 체험) |
| 1762 | POST | /test-overdue | **test** (솔라피 미납) |
| 1902 | POST | /send-trial-today-auto | **send** (솔라피 자동) |
| 2155 | GET | /stats | **logs** |
| 2199 | POST | /test-sens-consultation | **test** (SENS 상담) |
| 2321 | POST | /test-sens-trial | **test** (SENS 체험) |
| 2435 | POST | /test-sens-overdue | **test** (SENS 미납) |
| 2559 | POST | /send-unpaid-today-auto-sens | **send** (SENS 자동) |
| 2764 | POST | /send-trial-today-auto-sens | **send** (SENS 자동) |
| 2922 | POST | /test-reminder | **test** (솔라피 리마인드) |
| 3051 | POST | /test-sens-reminder | **test** (SENS 리마인드) |
| 3185 | POST | /send-reminder-auto | **send** (솔라피 자동) |
| 3364 | POST | /send-reminder-auto-sens | **send** (SENS 자동) |

## 4. 분리 계획

```
backend/routes/notifications/
├── index.js              # router 등록만 (~15줄)
├── _utils.js             # decryptStudentInfo, decryptStudentArray, ENCRYPTION_KEY (~30줄)
├── settings.js           # GET/PUT /settings (2 routes, ~530줄)
├── send.js               # 수동+자동 발송 8개 (Solapi+SENS) (~1,400줄)
├── test.js               # 테스트 발송 9개 (Solapi+SENS) (~1,300줄)
└── logs.js               # GET /logs, GET /stats (2 routes, ~110줄)
```

### 도메인 분류 근거

| 도메인 | 라우트 수 | 예상 줄수 | 설명 |
|--------|-----------|----------|------|
| settings | 2 | ~530 | 알림 설정 CRUD (SENS+Solapi 통합) |
| send | 8 | ~1,400 | 실제 발송 (수동+자동, Solapi+SENS) |
| test | 9 | ~1,300 | 테스트 발송 (Solapi+SENS, 모든 유형) |
| logs | 2 | ~110 | 발송 로그 조회 + 통계 |
| _utils | - | ~30 | 공유 헬퍼 (복호화) |
| index | - | ~15 | 라우터 등록 |

## 5. 구현 순서

### Phase 1: 구조 준비
1. `backend/routes/notifications/` 디렉토리 생성
2. `_utils.js` — 공유 헬퍼 함수 이동 (decryptStudentInfo, decryptStudentArray, ENCRYPTION_KEY)
3. `index.js` — 위임 패턴 스켈레톤

### Phase 2: 작은 것부터 분리
4. `logs.js` — 가장 작음 (~110줄), 의존성 최소
5. `settings.js` — 설정 CRUD 2개 라우트

### Phase 3: 큰 것 분리
6. `test.js` — 테스트 발송 9개 라우트
7. `send.js` — 실제 발송 8개 라우트 (가장 큼)

### Phase 4: 연결 & 정리
8. `index.js` 완성 (위임 패턴)
9. 기존 `notifications.js` 제거
10. 테스트 실행 + API 검증

## 6. 안전 장치

- **로직 변경 0**: 코드를 그대로 잘라서 붙여넣기만
- **students.js 분리 성공 패턴** 그대로 적용 (위임 패턴)
- **원복**: `git checkout` 한 방으로 원복
- **paca.js 변경 불필요**: `require('./routes/notifications')` → Node.js가 `notifications/index.js` 자동 로드

## 7. 완료 기준

- [ ] 모든 21개 엔드포인트 동일하게 작동
- [ ] `paca.js` 수정 불필요 확인
- [ ] 서버 정상 재시작
- [ ] 최대 파일 줄수 < 1,500줄

---

## 8. CTO 리뷰 남은 항목 (세션 지속용)

> 이 섹션은 세션 초기화 시 컨텍스트 유지 목적

### 완료 (8/13)
- [x] C-1: 유닛 테스트 0개 → 58개 작성
- [x] W-1: students.js 3,609줄 분리 → 8파일 (Match Rate 98%)
- [x] W-5: parseClassDaysWithSlots 복잡도 → per-day-timeslot로 해결
- [x] W-7: .env.example → 이미 존재
- [x] S-1: backend_old_backup/ → 이미 삭제됨
- [x] S-2: next.config 중복 → 이미 정리됨
- [x] S-3: N8N academy_id 검증 → 적절히 구현됨
- [x] per-day-timeslot → v3.11.0 배포 완료

### 진행 중
- [ ] **W-1: notifications.js 3,538줄 분리** ← 현재 작업

### 미착수 (4개)
- [ ] W-2: Service layer 분리 (비즈니스 로직이 Route에 직접 존재)
- [ ] W-3: Scheduler registry 패턴 (9개 수동 import in paca.js)
- [ ] W-6: Route auto-registration (26개 수동 import in paca.js)
- [ ] S-4: package.json version 동기화 (sidebar/settings v3.11.0 outdated)
