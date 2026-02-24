# 요일별 시간대(Per-Day Time Slot) 설계서

> **Summary**: class_days JSON 구조를 확장하여 요일별 시간대 지정 지원
>
> **Project**: P-ACA (파카)
> **Version**: 3.10.3
> **Author**: Sean
> **Date**: 2026-02-24
> **Status**: Draft
> **Planning Doc**: [per-day-timeslot.plan.md](../01-plan/features/per-day-timeslot.plan.md)

---

## 1. Overview

### 1.1 Design Goals

- **프로덕션 안전성**: 기존 데이터 0% 손실, 하위호환 100%
- **최소 변경**: DB 스키마 변경 없음 (JSON 컬럼 내부 구조만 변경)
- **점진적 마이그레이션**: 새/구 포맷 공존 가능, 언제든 롤백 가능

### 1.2 Design Principles

- **하위호환 우선**: 기존 `[1,3,6]` 포맷을 읽을 수 있어야 함
- **단일 파서**: 백엔드/프론트엔드 모두 하나의 파서 함수로 통일
- **기존 time_slot 컬럼 유지**: 기본값 역할 + 하위호환용

---

## 2. Data Model

### 2.1 class_days JSON 포맷 변경

**DB 컬럼 변경 없음** - `class_days` JSON 컬럼의 내부 구조만 변경

```
기존 (Legacy):    [1, 3, 6]
신규 (New):       [{"day":1,"timeSlot":"morning"}, {"day":3,"timeSlot":"morning"}, {"day":6,"timeSlot":"afternoon"}]
```

### 2.2 TypeScript 타입 정의

```typescript
// 새 타입 (src/lib/types/student.ts에 추가)

// 요일별 시간대 객체
export interface ClassDaySlot {
  day: number;  // 0-6 (일-토)
  timeSlot: 'morning' | 'afternoon' | 'evening';
}

// class_days 가능한 타입 (하위호환)
export type ClassDaysValue = number[] | ClassDaySlot[] | string;
```

### 2.3 영향받는 타입 변경

```typescript
// Student 인터페이스 (line 48)
// 변경 전: class_days: number[] | string;
// 변경 후:
class_days: ClassDaysValue;

// StudentFormData (line 95)
// 변경 전: class_days: number[];
// 변경 후:
class_days: ClassDaySlot[];

// ClassDaysStudent (line 470)
// 변경 전: class_days: number[];
// 변경 후:
class_days: ClassDaySlot[];

// ClassDaysUpdateRequest (line 484-486)
// 변경 전: class_days: number[];
// 변경 후:
class_days: ClassDaySlot[];

// ClassDaysBulkUpdateRequest (line 492-494)
// 변경 전: students: Array<{ id: number; class_days: number[]; }>
// 변경 후:
students: Array<{ id: number; class_days: ClassDaySlot[]; }>;

// Student.class_days_next (line 73)
// 변경 전: class_days_next: number[] | string | null;
// 변경 후:
class_days_next: ClassDaySlot[] | number[] | string | null;
```

---

## 3. 핵심 유틸리티 함수 (Shared)

### 3.1 하위호환 파서 - Backend (students.js 상단에 추가)

```javascript
/**
 * class_days를 새 포맷으로 정규화
 * - 숫자 배열 [1,3,6] → [{day:1,timeSlot:defaultTS}, ...]
 * - 객체 배열은 그대로 반환
 * - JSON 문자열은 파싱 후 재귀
 */
function parseClassDaysWithSlots(classDays, defaultTimeSlot = 'evening') {
  if (!classDays) return [];
  const parsed = typeof classDays === 'string' ? JSON.parse(classDays) : classDays;
  if (!Array.isArray(parsed)) return [];

  return parsed.map(item => {
    if (typeof item === 'number') {
      return { day: item, timeSlot: defaultTimeSlot };
    }
    if (item && typeof item === 'object' && 'day' in item) {
      return { day: item.day, timeSlot: item.timeSlot || defaultTimeSlot };
    }
    return null;
  }).filter(Boolean);
}

/**
 * 새 포맷에서 요일 숫자 배열만 추출 (하위호환 쿼리용)
 */
function extractDayNumbers(classDaySlots) {
  return classDaySlots.map(s => s.day);
}

/**
 * 특정 요일의 시간대 조회
 */
function getTimeSlotForDay(classDaySlots, dayOfWeek, defaultTimeSlot = 'evening') {
  const slot = classDaySlots.find(s => s.day === dayOfWeek);
  return slot ? slot.timeSlot : defaultTimeSlot;
}
```

### 3.2 하위호환 파서 - Frontend (student-helpers.ts 수정)

```typescript
import type { ClassDaySlot } from '@/lib/types/student';

/**
 * class_days를 새 포맷으로 정규화 (하위호환)
 */
export function parseClassDaysWithSlots(
  classDays: ClassDaysValue,
  defaultTimeSlot: 'morning' | 'afternoon' | 'evening' = 'evening'
): ClassDaySlot[] {
  if (!classDays) return [];
  const parsed = typeof classDays === 'string' ? JSON.parse(classDays) : classDays;
  if (!Array.isArray(parsed)) return [];

  return parsed.map((item: number | ClassDaySlot) => {
    if (typeof item === 'number') {
      return { day: item, timeSlot: defaultTimeSlot };
    }
    if (item && typeof item === 'object' && 'day' in item) {
      return { day: item.day, timeSlot: item.timeSlot || defaultTimeSlot };
    }
    return null;
  }).filter(Boolean) as ClassDaySlot[];
}

/**
 * 기존 parseClassDays 유지 (숫자 배열만 필요한 곳 용)
 */
export function parseClassDays(classDays: ClassDaysValue): number[] {
  const slots = parseClassDaysWithSlots(classDays);
  return slots.map(s => s.day);
}

/**
 * 포맷 표시 - "월(오전), 수(오전), 토(오후)"
 * 모든 시간대가 동일하면 기존처럼 "월, 수, 토" 표시
 */
export function formatClassDaysWithSlots(classDays: ClassDaysValue): string {
  const slots = parseClassDaysWithSlots(classDays);
  if (slots.length === 0) return '-';

  const TIME_SLOT_SHORT: Record<string, string> = {
    morning: '오전', afternoon: '오후', evening: '저녁'
  };

  // 시간대가 모두 동일하면 기존 표시
  const allSame = slots.every(s => s.timeSlot === slots[0].timeSlot);
  if (allSame) {
    return slots.map(s => WEEKDAY_MAP[s.day] || '').filter(Boolean).join(', ');
  }

  // 혼합 시간대면 각 요일에 시간대 표시
  return slots.map(s =>
    `${WEEKDAY_MAP[s.day]}(${TIME_SLOT_SHORT[s.timeSlot] || s.timeSlot})`
  ).filter(Boolean).join(', ');
}
```

---

## 4. Backend 변경 상세

### 4.1 autoAssignStudentToSchedules() 수정

**파일**: `backend/routes/students.js` (L18-87)

```javascript
// 변경 전 시그니처:
async function autoAssignStudentToSchedules(dbConn, studentId, academyId, classDays, enrollmentDate, defaultTimeSlot = 'evening')

// 변경 후 시그니처 (하위호환):
async function autoAssignStudentToSchedules(dbConn, studentId, academyId, classDaysInput, enrollmentDate, defaultTimeSlot = 'evening')
```

**핵심 변경**:
```javascript
// 함수 시작 부분에 추가
const classDaySlots = parseClassDaysWithSlots(classDaysInput, defaultTimeSlot);
if (classDaySlots.length === 0) { return { assigned: 0, created: 0 }; }

// 기존 루프 내부 변경 (L39):
// 변경 전: if (classDays.includes(dayOfWeek))
// 변경 후:
const slotForDay = classDaySlots.find(s => s.day === dayOfWeek);
if (slotForDay) {
    const timeSlot = slotForDay.timeSlot;
    // 이후 defaultTimeSlot → timeSlot 으로 대체 (L46, L55)
```

### 4.2 reassignStudentSchedules() 수정

**파일**: `backend/routes/students.js` (L94-171)

동일 패턴 적용:
```javascript
// L94: 시그니처 변경
async function reassignStudentSchedules(dbConn, studentId, academyId, oldClassDays, newClassDaysInput, defaultTimeSlot = 'evening')

// 함수 시작 부분:
const newClassDaySlots = parseClassDaysWithSlots(newClassDaysInput, defaultTimeSlot);

// L125: 변경
const slotForDay = newClassDaySlots.find(s => s.day === dayOfWeek);
if (slotForDay) {
    const timeSlot = slotForDay.timeSlot;
    // ...
```

### 4.3 POST /students (학생 생성) 수정

**파일**: `backend/routes/students.js` (L710-1100)

```javascript
// 저장 시 (L914 부근):
// 변경 전: JSON.stringify(class_days || [])
// 변경 후:
const classDaySlots = (class_days || []).map(d => {
    if (typeof d === 'number') return { day: d, timeSlot: time_slot || 'evening' };
    return d; // 이미 객체면 그대로
});
JSON.stringify(classDaySlots)

// autoAssign 호출 (L1096):
// 변경 전: autoAssignStudentToSchedules(dbConn, studentId, academyId, class_days, enrollment_date, time_slot)
// 변경 후:
autoAssignStudentToSchedules(dbConn, studentId, academyId, classDaySlots, enrollment_date, time_slot)
```

### 4.4 PUT /class-days/bulk 수정

**파일**: `backend/routes/students.js` (L390-478)

```javascript
// 요청 본문 변경:
// 변경 전: students: [{id, class_days: [1,3,5]}]
// 변경 후: students: [{id, class_days: [{day:1,timeSlot:"morning"}, ...]}]

// 처리 (L428):
// 기존: const timeSlot = currentStudent.time_slot || 'evening';
// 유지하되, reassign 호출 시 새 class_days를 그대로 전달
await reassignStudentSchedules(dbConn, id, academyId, oldClassDays, newClassDays, currentStudent.time_slot);

// weekly_count 계산 변경:
// 변경 전: newClassDays.length
// 변경 후: (동일 - 객체 배열이어도 .length 는 같음)
```

### 4.5 PUT /class-days/:id 수정

**파일**: `backend/routes/students.js` (L485-593)

동일 패턴. `class_days` 저장 시 객체 배열로, `weekly_count`는 `.length`로.

### 4.6 GET /class-days 수정

**파일**: `backend/routes/students.js` (L351-387)

```javascript
// 응답 파싱 (L380 부근):
// 변경 전: class_days를 JSON.parse → 숫자 배열
// 변경 후: parseClassDaysWithSlots 사용하여 정규화
student.class_days = parseClassDaysWithSlots(student.class_days, student.time_slot);
```

### 4.7 월간 자동배정 크론 수정

**파일**: `backend/cron/monthly-schedule-assign.js`

```javascript
// L17: const DEFAULT_TIME_SLOT = 'evening'; → 유지 (폴백용)

// assignStudentToMonth 수정 (L22):
async function assignStudentToMonth(dbConn, studentId, academyId, classDaysInput, year, month, defaultTimeSlot = DEFAULT_TIME_SLOT) {
    const classDaySlots = parseClassDaysWithSlots(classDaysInput, defaultTimeSlot);
    // L32: classDays.includes(dayOfWeek) → classDaySlots.find(s => s.day === dayOfWeek)
    // timeSlot → slotForDay.timeSlot

// L137-150: 메인 루프
// 변경 전: const classDays = JSON.parse(...)
// 변경 후:
const classDaySlots = parseClassDaysWithSlots(student.class_days, student.time_slot || DEFAULT_TIME_SLOT);
// assignStudentToMonth에 classDaySlots 전달
```

**중요**: `time_slot` 컬럼도 같이 SELECT해야 함 (L123):
```sql
SELECT id, name, class_days, time_slot
FROM students
WHERE ...
```

### 4.8 수업일 변경 스케줄러 수정

**파일**: `backend/scheduler/classDaysScheduler.js`

```javascript
// L39-41: newClassDays 파싱
// 변경 전: JSON.parse(student.class_days_next)
// 변경 후: parseClassDaysWithSlots(student.class_days_next, student.time_slot)

// L42: weekly_count 계산
// 변경 전: newClassDays.length
// 변경 후: newClassDaySlots.length (동일 동작)

// L74: JSON.stringify 시 새 포맷 유지
JSON.stringify(newClassDaySlots) // [{day:1,timeSlot:"morning"}, ...]
```

**중요**: SELECT에 `time_slot` 추가 (L20):
```sql
SELECT id, name, class_days, class_days_next, class_days_effective_from, student_type, time_slot
```

### 4.9 결제 라우트 JSON_CONTAINS 수정

**파일**: `backend/routes/payments.js` (L308)

```javascript
// 변경 전:
// AND JSON_CONTAINS(COALESCE(s.class_days, '[]'), ?)
// [JSON.stringify(dayOfWeek)]

// 변경 후 (두 포맷 모두 지원):
// AND (
//   JSON_CONTAINS(COALESCE(s.class_days, '[]'), ?) OR
//   JSON_CONTAINS(COALESCE(s.class_days, '[]'), JSON_OBJECT('day', ?))
// )
// 또는 더 안전한 방법:
AND (
  JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
  OR EXISTS (
    SELECT 1 FROM JSON_TABLE(
      COALESCE(s.class_days, '[]'), '$[*]'
      COLUMNS (day_val INT PATH '$.day')
    ) jt WHERE jt.day_val = ?
  )
)
```

**참고**: 마이그레이션 완료 후에는 JSON_TABLE 방식만 남길 수 있음.

### 4.10 PUT /:id (학생 수정) 수정 ⚠️ 누락 보완

**파일**: `backend/routes/students.js` (L1137-1452)

학생 수정 페이지에서도 class_days를 직접 변경할 수 있음 (항상 즉시 적용).

#### 4.10.1 class_days 저장 (L1291-1297)
```javascript
// 변경 전:
if (class_days !== undefined) {
    updates.push('class_days = ?');
    params.push(JSON.stringify(class_days));
}

// 변경 후:
if (class_days !== undefined) {
    // 새 포맷 정규화 (프론트에서 이미 객체 배열이지만 안전장치)
    const normalizedClassDays = parseClassDaysWithSlots(class_days, time_slot || oldTimeSlot);
    updates.push('class_days = ?');
    params.push(JSON.stringify(normalizedClassDays));
}
```

#### 4.10.2 변경 감지 로직 (L1402-1409)
```javascript
// 변경 전 (숫자 Set 비교 - 객체 배열이면 깨짐):
const oldSet = new Set(oldClassDays);
const newSet = new Set(newClassDays);

// 변경 후 (문자열 직렬화 비교):
const oldSlots = parseClassDaysWithSlots(oldClassDays, oldTimeSlot);
const newSlots = parseClassDaysWithSlots(class_days, time_slot || oldTimeSlot);
const oldKey = new Set(oldSlots.map(s => `${s.day}-${s.timeSlot}`));
const newKey = new Set(newSlots.map(s => `${s.day}-${s.timeSlot}`));
const isChanged = oldKey.size !== newKey.size ||
                  [...oldKey].some(k => !newKey.has(k));
```

#### 4.10.3 스케줄 재배정 호출 (L1413-1419)
```javascript
// 변경 전:
reassignStudentSchedules(db, studentId, academyId, oldClassDays, newClassDays, currentTimeSlot);

// 변경 후 (새 포맷 전달):
reassignStudentSchedules(db, studentId, academyId, oldSlots, newSlots, time_slot || oldTimeSlot);
```

#### 4.10.4 time_slot 단독 변경 처리 (L1428-1451)
```javascript
// 변경 전: time_slot만 바뀌면 전체 스케줄 재배정
// 변경 후: time_slot(기본값)만 바뀌는 건 기존 요일별 시간대에 영향 없음
// → "기본 시간대" 변경일 뿐이므로 스케줄 재배정 불필요
// → 단, 프론트에서 "기본 시간대 일괄 적용" 버튼 누르면 class_days도 같이 변경됨

if (time_slot !== undefined && time_slot !== oldTimeSlot && class_days === undefined) {
    // 기본 시간대만 변경: 스케줄 재배정 하지 않음 (기존 요일별 설정 유지)
    // 사용자가 일괄 변경 원하면 프론트에서 class_days의 모든 timeSlot을 변경 후 전송
    logger.info(`Student ${studentId}: default time_slot changed to ${time_slot}, per-day settings preserved`);
}
```

---

## 5. Frontend 변경 상세

### 5.1 StudentForm - 요일별 시간대 선택 UI

**파일**: `src/components/students/student-form.tsx`

#### 현재 UI 구조:
```
[수업 요일] 월 화 수 목 금 토 일  ← 체크박스
[수업 시간대] 오전 오후 저녁        ← 전체 적용 버튼
```

#### 변경 후 UI 구조:
```
[수업 요일 & 시간대]
 월 [오전▾]  수 [오전▾]  토 [오후▾]   ← 요일 체크 + 개별 시간대 드롭다운

[기본 시간대] 오전 오후 저녁          ← 새 요일 추가 시 기본값
```

#### 구체적 변경:

**formData 초기화 (L115, L129):**
```typescript
// 변경 전:
class_days: initialData ? parseClassDays(initialData.class_days) : [],
time_slot: (initialData?.time_slot || 'evening') as ...

// 변경 후:
class_days: initialData
  ? parseClassDaysWithSlots(initialData.class_days, initialData.time_slot || 'evening')
  : [],
time_slot: (initialData?.time_slot || 'evening') as ...
```

**handleClassDayToggle 변경 (L244-262):**
```typescript
const handleClassDayToggle = (day: number) => {
  const current = formData.class_days as ClassDaySlot[];
  const existing = current.find(s => s.day === day);

  let newDays: ClassDaySlot[];
  if (existing) {
    // 제거
    newDays = current.filter(s => s.day !== day);
  } else {
    // 추가 (기본 시간대 사용)
    newDays = [...current, { day, timeSlot: formData.time_slot }]
      .sort((a, b) => a.day - b.day);
  }

  const newWeeklyCount = newDays.length;
  const newTuition = settingsLoaded
    ? getTuitionByWeeklyCount(formData.student_type, newWeeklyCount)
    : formData.monthly_tuition;

  setFormData(prev => ({
    ...prev,
    class_days: newDays,
    weekly_count: newWeeklyCount,
    monthly_tuition: newTuition,
  }));
};

// 개별 요일의 시간대 변경
const handleDayTimeSlotChange = (day: number, newTimeSlot: 'morning' | 'afternoon' | 'evening') => {
  setFormData(prev => ({
    ...prev,
    class_days: (prev.class_days as ClassDaySlot[]).map(s =>
      s.day === day ? { ...s, timeSlot: newTimeSlot } : s
    ),
  }));
};
```

**UI 렌더링 (L870 부근 수업 요일 섹션):**
```tsx
{/* 수업 요일 & 시간대 */}
<div>
  <label className="block text-sm font-medium text-foreground mb-2">
    수업 요일 & 시간대
  </label>
  <div className="space-y-2">
    {WEEKDAY_OPTIONS.map((opt) => {
      const slot = (formData.class_days as ClassDaySlot[]).find(s => s.day === opt.value);
      const isActive = !!slot;

      return (
        <div key={opt.value} className="flex items-center gap-2">
          <button onClick={() => handleClassDayToggle(opt.value)}
            className={`w-10 h-10 rounded-lg border ... ${isActive ? 'bg-primary ...' : '...'}`}>
            {opt.label}
          </button>
          {isActive && (
            <select value={slot.timeSlot}
              onChange={(e) => handleDayTimeSlotChange(opt.value, e.target.value)}
              className="text-sm border rounded px-2 py-1">
              <option value="morning">오전</option>
              <option value="afternoon">오후</option>
              <option value="evening">저녁</option>
            </select>
          )}
        </div>
      );
    })}
  </div>
</div>

{/* 기본 시간대 (새 요일 추가 시 사용) */}
<div>
  <label className="block text-sm font-medium text-foreground mb-2">
    기본 시간대 <span className="text-xs text-muted-foreground">(새 요일 추가 시 기본값)</span>
  </label>
  <div className="flex flex-wrap gap-2">
    {[{value:'morning',label:'오전'}, {value:'afternoon',label:'오후'}, {value:'evening',label:'저녁'}].map(slot => (
      <button key={slot.value} onClick={() => handleChange('time_slot', slot.value)} ...>
        {slot.label}
      </button>
    ))}
  </div>
</div>
```

### 5.2 ClassDaysPage - 반배치 관리 페이지

**파일**: `src/app/students/class-days/page.tsx`

#### StudentEdit 인터페이스 변경 (L45-48):
```typescript
// 변경 전:
interface StudentEdit {
  class_days: number[];
  changed: boolean;
}

// 변경 후:
interface StudentEdit {
  class_days: ClassDaySlot[];
  changed: boolean;
}
```

#### toggleDay 변경 (L98-124):
```typescript
const toggleDay = (studentId: number, dayValue: number) => {
  const student = students.find(s => s.id === studentId);
  if (!student) return;

  const currentEdit = edits.get(studentId);
  const currentDays: ClassDaySlot[] = currentEdit
    ? currentEdit.class_days
    : [...student.class_days]; // 이미 ClassDaySlot[] 타입

  const existing = currentDays.find(s => s.day === dayValue);
  let newDays: ClassDaySlot[];
  if (existing) {
    newDays = currentDays.filter(s => s.day !== dayValue);
  } else {
    newDays = [...currentDays, { day: dayValue, timeSlot: student.time_slot || 'evening' }]
      .sort((a, b) => a.day - b.day);
  }

  // 변경 비교
  const originalSet = new Set(student.class_days.map(s => `${s.day}-${s.timeSlot}`));
  const newSet = new Set(newDays.map(s => `${s.day}-${s.timeSlot}`));
  const changed = originalSet.size !== newSet.size ||
    [...originalSet].some(d => !newSet.has(d));

  // ... (기존 setEdits 로직)
};
```

#### 시간대 변경 함수 추가:
```typescript
const changeTimeSlot = (studentId: number, dayValue: number, newTimeSlot: string) => {
  const student = students.find(s => s.id === studentId);
  if (!student) return;

  const currentEdit = edits.get(studentId);
  const currentDays = currentEdit ? currentEdit.class_days : [...student.class_days];

  const newDays = currentDays.map(s =>
    s.day === dayValue ? { ...s, timeSlot: newTimeSlot } : s
  );

  // 변경 비교 + setEdits (위와 동일)
};
```

#### 테이블 UI 변경 (L357-381):

요일 버튼 아래에 시간대 표시 추가:
```tsx
{WEEKDAY_OPTIONS.map(opt => {
  const slot = currentDays.find(s => s.day === opt.value);
  const isActive = !!slot;

  return (
    <div key={opt.value} className="flex flex-col items-center gap-0.5">
      <button onClick={() => toggleDay(student.id, opt.value)}
        className={`w-8 h-8 rounded-md text-xs font-medium ... ${isActive ? '...' : '...'}`}>
        {opt.label}
      </button>
      {isActive && (
        <select value={slot.timeSlot}
          onChange={(e) => changeTimeSlot(student.id, opt.value, e.target.value)}
          className="w-8 text-[10px] text-center border-0 bg-transparent p-0 cursor-pointer">
          <option value="morning">오전</option>
          <option value="afternoon">오후</option>
          <option value="evening">저녁</option>
        </select>
      )}
    </div>
  );
})}
```

### 5.3 formatClassDays 표시 변경

기존 `"월, 수, 토"` → 혼합 시간대 시 `"월(오전), 수(오전), 토(오후)"` 표시.
동일 시간대면 기존처럼 `"월, 수, 토"` 유지.

---

## 6. 마이그레이션 전략 (프로덕션 안전)

### 6.1 순서 (롤백 가능하도록)

```
Step 1: 하위호환 파서 배포 (읽기만 변경)
  ↓ 확인 후
Step 2: 백엔드 저장 로직 변경 (새 포맷으로 저장 시작)
  ↓ 확인 후
Step 3: 프론트엔드 UI 배포
  ↓ 확인 후
Step 4: DB 마이그레이션 (기존 데이터 일괄 변환)
  ↓ 확인 후
Step 5: 크론잡 업데이트
```

### 6.2 Step 1 - 파서 배포 (위험도: ZERO)

- `parseClassDaysWithSlots()` 함수 추가 (백엔드 + 프론트엔드)
- 기존 `parseClassDays()` 내부에서 호출하도록 변경
- **아무것도 깨지지 않음**: 숫자 배열 → 숫자 배열 그대로 반환

### 6.3 Step 4 - DB 마이그레이션

```sql
-- 1. 백업 먼저!
CREATE TABLE students_class_days_backup AS
SELECT id, class_days, class_days_next, time_slot
FROM students
WHERE class_days IS NOT NULL AND class_days != '[]';

-- 2. 기존 숫자 배열 → 객체 배열 변환
UPDATE students
SET class_days = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT('day', CAST(jt.day_val AS UNSIGNED), 'timeSlot', COALESCE(students.time_slot, 'evening'))
  )
  FROM JSON_TABLE(students.class_days, '$[*]' COLUMNS (day_val INT PATH '$')) AS jt
)
WHERE class_days IS NOT NULL
  AND class_days != '[]'
  AND JSON_TYPE(JSON_EXTRACT(class_days, '$[0]')) = 'INTEGER';

-- 3. class_days_next도 동일하게 변환
UPDATE students
SET class_days_next = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT('day', CAST(jt.day_val AS UNSIGNED), 'timeSlot', COALESCE(students.time_slot, 'evening'))
  )
  FROM JSON_TABLE(students.class_days_next, '$[*]' COLUMNS (day_val INT PATH '$')) AS jt
)
WHERE class_days_next IS NOT NULL
  AND class_days_next != '[]'
  AND JSON_TYPE(JSON_EXTRACT(class_days_next, '$[0]')) = 'INTEGER';

-- 4. 검증
SELECT id, name, class_days, time_slot
FROM students
WHERE class_days IS NOT NULL AND class_days != '[]'
LIMIT 10;

-- 5. 롤백 (필요 시)
-- UPDATE students s
-- JOIN students_class_days_backup b ON s.id = b.id
-- SET s.class_days = b.class_days, s.class_days_next = b.class_days_next;
```

### 6.4 롤백 계획

| 단계 | 롤백 방법 | 소요 시간 |
|------|----------|----------|
| Step 1 | 코드 revert | 즉시 (git) |
| Step 2 | 코드 revert (파서가 양쪽 지원하므로 안전) | 즉시 |
| Step 3 | 프론트 revert (Vercel rollback) | 1분 |
| Step 4 | 백업 테이블에서 복원 | 3분 |
| Step 5 | 코드 revert | 즉시 |

---

## 7. 구현 순서

### Phase 1: 유틸리티 & 타입 (영향 없음)
1. [ ] `src/lib/types/student.ts` - ClassDaySlot 타입 추가
2. [ ] `src/lib/utils/student-helpers.ts` - parseClassDaysWithSlots, formatClassDaysWithSlots 추가
3. [ ] `backend/routes/students.js` 상단 - parseClassDaysWithSlots 유틸 함수 추가

### Phase 2: 백엔드 로직 (하위호환)
4. [ ] `backend/routes/students.js` - autoAssignStudentToSchedules 수정
5. [ ] `backend/routes/students.js` - reassignStudentSchedules 수정
6. [ ] `backend/routes/students.js` - POST /students (생성 시 새 포맷 저장)
7. [ ] `backend/routes/students.js` - PUT /class-days/bulk 수정
8. [ ] `backend/routes/students.js` - PUT /class-days/:id 수정
9. [ ] `backend/routes/students.js` - GET /class-days 응답 정규화
10. [ ] `backend/routes/students.js` - PUT /:id (학생 수정) 수정 ← **추가!**

### Phase 3: 프론트엔드 UI
11. [ ] `src/components/students/student-form.tsx` - 요일별 시간대 선택 UI
12. [ ] `src/app/students/class-days/page.tsx` - 반배치 관리 페이지 UI

### Phase 4: 결제 & 크론 (마이그레이션 후)
13. [ ] `backend/routes/payments.js` - JSON_CONTAINS 쿼리 수정
14. [ ] `backend/cron/monthly-schedule-assign.js` - 크론잡 수정
15. [ ] `backend/scheduler/classDaysScheduler.js` - 스케줄러 수정

### Phase 5: DB 마이그레이션
16. [ ] DB 백업 + 마이그레이션 실행
17. [ ] 검증

---

## 8. Test Plan

### 8.1 수동 테스트 시나리오

| # | 시나리오 | 기대 결과 |
|---|---------|----------|
| T-01 | 기존 학생 조회 (숫자 배열 데이터) | 정상 표시, 오류 없음 |
| T-02 | 새 학생 등록: 월(오전), 수(오전), 토(오후) | 객체 배열로 저장, 스케줄 각 시간대에 맞게 생성 |
| T-03 | 기존 학생 수업일 변경 (벌크) | 새 포맷으로 저장, 재배정 정상 |
| T-04 | 기존 학생 수업일 변경 (개별) | 새 포맷으로 저장, 재배정 정상 |
| T-05 | 반배치 관리 페이지에서 시간대 변경 | 요일별 시간대 변경 정상 |
| T-06 | 예약 변경 (class_days_next) 설정 | 객체 배열로 저장 |
| T-07 | 예약 변경 자동 적용 (크론) | 정상 적용, weekly_count 정확 |
| T-08 | 월간 자동배정 크론 실행 | 요일별 시간대에 맞는 스케줄에 배정 |
| T-09 | 수강료 계산 | 기존과 동일 (weekly_count 기반) |
| T-10 | DB 마이그레이션 후 전체 기능 | 모든 기능 정상 |

### 8.2 하위호환 테스트

| # | 데이터 포맷 | 기대 결과 |
|---|-----------|----------|
| C-01 | `[1, 3, 6]` (숫자 배열) | parseClassDaysWithSlots → 기본 time_slot 적용 |
| C-02 | `'[1, 3, 6]'` (JSON 문자열) | 동일 |
| C-03 | `[{"day":1,"timeSlot":"morning"}]` (객체 배열) | 그대로 반환 |
| C-04 | `null` / `[]` / `''` | 빈 배열 반환 |

---

## 9. Security Considerations

- [x] 입력 검증: timeSlot 값은 'morning' | 'afternoon' | 'evening'만 허용
- [x] SQL Injection 방지: 기존 Prepared Statement 유지
- [x] XSS 방지: JSON.stringify로 저장, 프론트에서 파싱 시 타입 체크

---

## Version History

| Version | Date | Changes | Author |
|---------|------|---------|--------|
| 0.1 | 2026-02-24 | 초안 작성 | Sean |
