# 요일별 시간대(Per-Day Time Slot) 계획서

> **Summary**: 학생의 수업 요일마다 다른 시간대(오전/오후/저녁)를 지정할 수 있도록 확장
>
> **Project**: P-ACA (파카)
> **Version**: 3.10.3
> **Author**: Sean
> **Date**: 2026-02-24
> **Status**: Draft

---

## 1. Overview

### 1.1 Purpose

현재 학생은 `time_slot` 하나로 모든 수업 요일에 동일한 시간대가 적용됨.
"월,수 오전 + 토 오후" 같은 **혼합 시간대** 수업을 지원하지 못하는 한계를 해결.

### 1.2 Background

- 다른 지점에서 P-ACA 사용 피드백: **"반배치/반편성이 어렵고, 월수토(토요일은 오후) 같은 케이스 처리가 난감"**
- 실제 학원 운영에서 평일은 오전/저녁, 주말은 오후 수업이 흔한 패턴
- 현 시스템은 학생당 `time_slot` 1개만 저장 → 요일별 분리 불가

### 1.3 현재 데이터 구조

```
students 테이블:
  class_days: [1, 3, 6]           ← 월, 수, 토 (JSON 배열)
  time_slot: "morning"            ← 전체 요일에 동일 적용
  class_days_next: [1, 4]         ← 예약 변경
  class_days_effective_from: DATE  ← 변경 적용일
```

### 1.4 목표 데이터 구조

```
students 테이블:
  class_days: [
    {"day": 1, "timeSlot": "morning"},     ← 월 오전
    {"day": 3, "timeSlot": "morning"},     ← 수 오전
    {"day": 6, "timeSlot": "afternoon"}    ← 토 오후
  ]
  time_slot: "morning"            ← 기본값 (새 요일 추가 시 사용)
  class_days_next: [              ← 예약 변경도 동일 구조
    {"day": 1, "timeSlot": "morning"},
    {"day": 4, "timeSlot": "evening"}
  ]
```

---

## 2. Scope

### 2.1 In Scope

- [ ] DB `class_days` JSON 구조 확장 (숫자 배열 → 객체 배열)
- [ ] 기존 데이터 마이그레이션 (숫자 → 객체 자동 변환)
- [ ] 스케줄 자동배정 로직 수정 (요일별 시간대 사용)
- [ ] 프론트엔드 학생 폼 UI 수정 (요일별 시간대 선택)
- [ ] 반배치 관리 페이지 UI 수정
- [ ] 월별 자동배정 크론 수정
- [ ] 수강료 계산 로직 호환

### 2.2 Out of Scope

- 시즌(특별반) 시스템 변경 (이미 별도 time_slots 필드 보유)
- 반(classes) 테이블 구조 변경
- 출석 시스템 변경 (attendance는 class_schedule 기반이라 영향 없음)

---

## 3. Requirements

### 3.1 Functional Requirements

| ID | Requirement | Priority | Status |
|----|-------------|----------|--------|
| FR-01 | class_days JSON에 요일+시간대 객체 저장 | High | Pending |
| FR-02 | 기존 숫자 배열 데이터 하위호환 (파싱 시 자동 변환) | High | Pending |
| FR-03 | 학생 등록/수정 폼에서 요일별 시간대 선택 가능 | High | Pending |
| FR-04 | 반배치 관리 페이지에서 요일별 시간대 표시/수정 | High | Pending |
| FR-05 | 스케줄 자동배정 시 요일별 시간대 사용 | High | Pending |
| FR-06 | 월간 자동배정 크론에서 요일별 시간대 사용 | High | Pending |
| FR-07 | 예약 변경(class_days_next)도 동일 구조 지원 | Medium | Pending |
| FR-08 | 기본 시간대(time_slot 컬럼) 유지 - 새 요일 추가 시 기본값으로 사용 | Medium | Pending |
| FR-09 | DB 마이그레이션 스크립트 (기존 데이터 일괄 변환) | High | Pending |

### 3.2 Non-Functional Requirements

| Category | Criteria | 비고 |
|----------|----------|------|
| 하위호환 | 기존 숫자 배열 `[1,3,6]`도 정상 파싱 | 점진적 마이그레이션 |
| 성능 | JSON 파싱 오버헤드 최소화 | 기존 `JSON_CONTAINS` 쿼리 유지 |
| UX | 요일 선택 후 시간대 변경이 직관적 | 기본값 자동 적용 |

---

## 4. 영향 분석 (Impact Analysis)

### 4.1 Backend - HIGH Impact

| 파일 | 함수/위치 | 변경 내용 |
|------|----------|----------|
| `backend/routes/students.js` | `autoAssignStudentToSchedules()` (L10-87) | `defaultTimeSlot` → 요일별 timeSlot 사용 |
| `backend/routes/students.js` | `reassignStudentSchedules()` (L89-171) | 동일 |
| `backend/routes/students.js` | POST `/students` (L710-1100) | 생성 시 객체 배열 저장 |
| `backend/routes/students.js` | PUT `/class-days/bulk` (L390-478) | 벌크 업데이트 구조 변경 |
| `backend/routes/students.js` | PUT `/class-days/:id` (L485-593) | 개별 업데이트 구조 변경 |
| `backend/routes/students.js` | GET `/class-days` (L351-387) | 응답 구조 확장 |
| `backend/cron/monthly-schedule-assign.js` | `assignStudentToMonth()` (L78-189) | 하드코딩 'evening' 제거, 요일별 사용 |
| `backend/scheduler/classDaysScheduler.js` | `applyScheduledClassDaysChanges()` (L13-99) | next 구조 호환 |
| `backend/routes/payments.js` | 수강료 계산 (L278-310, 628-680) | `JSON_CONTAINS` 쿼리 수정 |

### 4.2 Frontend - HIGH Impact

| 파일 | 컴포넌트 | 변경 내용 |
|------|---------|----------|
| `src/components/students/student-form.tsx` | StudentForm | 요일별 시간대 선택 UI 추가 |
| `src/app/students/class-days/page.tsx` | ClassDaysPage | 각 요일 옆 시간대 표시/변경 |
| `src/lib/types/student.ts` | Student 타입 | `class_days` 타입 확장 |
| `src/lib/api/students.ts` | API 클라이언트 | 페이로드 구조 업데이트 |
| `src/lib/utils/student-helpers.ts` | `parseClassDays()`, `formatClassDays()` | 객체 배열 파싱/포맷 |

### 4.3 영향 없음

- `attendance` 테이블 - class_schedule 기반이라 무관
- `class_schedules` 테이블 - time_slot은 스케줄 자체 속성
- `seasons` 시스템 - 별도 time_slots 필드 사용

---

## 5. 마이그레이션 전략

### 5.1 하위호환 파서 (핵심)

```javascript
// parseClassDays() 확장 - 두 가지 포맷 모두 처리
function parseClassDaysWithSlots(classDays, defaultTimeSlot = 'evening') {
  const parsed = typeof classDays === 'string' ? JSON.parse(classDays) : classDays;
  if (!Array.isArray(parsed)) return [];

  return parsed.map(item => {
    // 기존 포맷: 숫자 → 객체로 변환
    if (typeof item === 'number') {
      return { day: item, timeSlot: defaultTimeSlot };
    }
    // 새 포맷: 그대로 반환
    return item;
  });
}
```

### 5.2 DB 마이그레이션

```sql
-- 기존 데이터 변환 (class_days: [1,3,6] + time_slot: "morning")
-- → class_days: [{"day":1,"timeSlot":"morning"},{"day":3,"timeSlot":"morning"},{"day":6,"timeSlot":"morning"}]

UPDATE students
SET class_days = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT('day', jt.day_val, 'timeSlot', students.time_slot)
  )
  FROM JSON_TABLE(class_days, '$[*]' COLUMNS (day_val INT PATH '$')) AS jt
)
WHERE class_days IS NOT NULL
  AND class_days != '[]'
  AND JSON_TYPE(JSON_EXTRACT(class_days, '$[0]')) = 'INTEGER';
```

### 5.3 단계별 적용

1. **Phase 1**: 파서 함수에 하위호환 추가 (기존 포맷도 처리)
2. **Phase 2**: 백엔드 API에서 새 포맷 저장 시작
3. **Phase 3**: 프론트엔드 UI 업데이트
4. **Phase 4**: DB 마이그레이션 실행 (기존 데이터 일괄 변환)
5. **Phase 5**: 크론잡 업데이트

---

## 6. Risks and Mitigation

| Risk | Impact | Likelihood | Mitigation |
|------|--------|------------|------------|
| 기존 데이터 손상 | High | Low | 하위호환 파서로 양쪽 포맷 모두 처리 |
| 결제/수강료 계산 오류 | High | Medium | 마이그레이션 전 기존 로직 충분히 테스트 |
| 프론트엔드 복잡도 증가 | Medium | High | 기본값 자동 적용으로 UX 단순화 |
| 크론잡 실패 | High | Low | 파서에서 숫자/객체 모두 처리하므로 안전 |

---

## 7. Success Criteria

### 7.1 Definition of Done

- [ ] "월,수 오전 + 토 오후" 학생 등록 가능
- [ ] 해당 학생의 스케줄이 요일별 시간대에 맞게 자동 생성
- [ ] 기존 학생 데이터 정상 동작 (하위호환)
- [ ] 반배치 관리 페이지에서 요일별 시간대 확인/수정 가능
- [ ] 월간 자동배정 크론 정상 동작
- [ ] 수강료 계산 정확

---

## 8. Next Steps

1. [ ] Design 문서 작성 (`/pdca design per-day-timeslot`)
2. [ ] 리뷰 및 승인
3. [ ] 구현 시작

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-24 | 초안 작성 | Sean |
