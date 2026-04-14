# Codebase Report: 일괄생성 (Bulk Creation) Button - 수업관리
Generated: 2026-01-28

## Summary
Found the "일괄 생성" (bulk creation) button in the schedules management system. It supports three modes for batch creating class schedules: Season-based, Student class-days based, and Class-based creation.

---

## 1. Frontend Button Location

### File: `/home/sean/pacapro/src/app/schedules/page.tsx`

**Line 243:**
```tsx
<Button variant="outline" onClick={() => setBulkModalOpen(true)}>
  <CalendarPlus className="h-4 w-4 mr-2" />
  일괄 생성
</Button>
```

**Context:** Located in the schedules page header toolbar, alongside:
- 강사 출근 (Instructor attendance) button
- 개별수업등록 (Individual class registration) button

**State Management:**
```tsx
const [bulkModalOpen, setBulkModalOpen] = useState(false);
```

**Modal Component Usage (Line 364):**
```tsx
<BulkScheduleModal
  open={bulkModalOpen}
  onClose={() => setBulkModalOpen(false)}
  onSuccess={handleBulkSuccess}
/>
```

---

## 2. Modal Component

### File: `/home/sean/pacapro/src/components/schedules/bulk-schedule-modal.tsx`

**Component:** `BulkScheduleModal`
**Total Lines:** 529

### Key Features

#### Two Creation Modes:

1. **학생 수업일 기반 (Student Class Days)** - RECOMMENDED (default)
   - Automatically queries all active students' class_days
   - Creates schedules for union of all student class days in selected month
   - Simpler UI, fewer options needed

2. **시즌 기반 (Season-based)**
   - Creates schedules based on season operating days
   - Supports target grade selection (고3, N수)
   - Supports multiple time slots
   - Preview and exclude specific dates

### Props Interface:
```typescript
interface BulkScheduleModalProps {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
}
```

### State Variables:

**Mode Selection:**
- `mode: CreateMode` - 'student' | 'season'

**Student Mode:**
- `year: number` - Year for schedule creation
- `month: number` - Month for schedule creation
- `timeSlot: TimeSlot` - Single time slot (morning/afternoon/evening)

**Season Mode:**
- `selectedSeasonId: number` - Selected season ID
- `selectedTargetGrade: SeasonTargetGrade` - '고3' | 'N수'
- `selectedTimeSlots: Set<TimeSlot>` - Multiple time slots supported
- `seasonExcludedDates: Set<string>` - Dates to exclude from creation

### Key Functions:

**loadData()** - Lines 58-94
- Fetches active seasons
- Auto-selects first season
- Auto-sets time slots based on grade_time_slots config

**handleSubmit()** - Lines 174-236
Sends different payloads based on mode:

**Student Mode Payload:**
```typescript
{
  mode: 'student',
  year: number,
  month: number,
  time_slot: TimeSlot
}
```

**Season Mode Payload:**
```typescript
{
  mode: 'season',
  season_id: number,
  target_grade: SeasonTargetGrade,
  excluded_dates: string[],
  time_slots: TimeSlot[]  // Multiple slots supported
}
```

---

## 3. API Endpoint

### Route: `POST /paca/schedules/bulk`

### File: `/home/sean/pacapro/backend/routes/schedules.js`
**Lines:** 530-830

### Access Control:
```javascript
verifyToken, checkPermission('schedules', 'edit')
```
**Allowed:** owner, admin only

### Three Modes Supported:

#### Mode 1: Season-based (`mode: 'season'`)

**Required Parameters:**
- `season_id` - Season ID
- `target_grade` - '고3' or 'N수'

**Optional Parameters:**
- `excluded_dates` - Array of dates to skip
- `time_slots` - Array of time slots (supports multiple)
- `title` - Custom schedule title

**Logic:**
1. Fetch season data (season_name, start/end dates, operating_days, grade_time_slots)
2. Parse operating_days JSON (array of weekday numbers 0-6)
3. Calculate all dates within season period matching operating_days
4. Remove excluded_dates
5. Create schedules for each date × each time slot
6. Skip if schedule already exists for that date+timeslot

**Database Fields Set:**
```javascript
INSERT INTO class_schedules
(academy_id, class_id, season_id, target_grade, class_date, time_slot, instructor_id, title)
VALUES (?, ?, ?, ?, ?, ?, NULL, ?)
```

#### Mode 2: Student-based (`mode: 'student'`) - NEW

**Required Parameters:**
- `year` - Year (e.g., 2026)
- `month` - Month (1-12)

**Optional Parameters:**
- `time_slot` - Default time slot (default: 'evening')
- `excluded_dates` - Array of dates to skip
- `title` - Custom schedule title

**Logic:**
1. Query all active students' class_days
   ```sql
   SELECT DISTINCT s.class_days
   FROM students s
   WHERE s.academy_id = ?
   AND s.status = 'active'
   AND s.deleted_at IS NULL
   AND s.class_days IS NOT NULL
   ```
2. Parse each student's class_days JSON and create union set
3. Calculate all dates in specified month matching any student's class days
4. Remove excluded_dates
5. Create schedules for each date with specified time_slot
6. Skip if schedule already exists

**Database Fields Set:**
```javascript
INSERT INTO class_schedules
(academy_id, class_id, season_id, target_grade, class_date, time_slot, instructor_id, title)
VALUES (?, NULL, NULL, NULL, ?, ?, NULL, ?)
```

#### Mode 3: Class-based (`mode: 'class'`)

**Required Parameters:**
- `class_id` - Class ID
- `year` - Year
- `month` - Month
- `weekdays` - Array of weekday numbers (0=Sun, 6=Sat)

**Optional Parameters:**
- `excluded_dates` - Array of dates to skip
- `time_slot` - Override class default
- `title` - Custom schedule title

**Logic:**
1. Fetch class info (class_name, default_time_slot)
2. Calculate all dates in specified month matching weekdays
3. Remove excluded_dates
4. Create schedules for each date
5. Skip if schedule already exists

### Response Format:

**Success (201):**
```json
{
  "message": "N개 스케줄 생성 완료",
  "season_id": number | null,
  "class_id": number | null,
  "title": string,
  "created_count": number,
  "skipped_count": number,
  "skipped_dates": string[],
  "schedules": [
    {
      "id": number,
      "class_date": "YYYY-MM-DD",
      "time_slot": string
    }
  ]
}
```

**Frontend Toast:**
```typescript
toast.success(`${result.created_count}개의 수업이 생성되었습니다.`, {
  description: result.skipped_count > 0 ? `${result.skipped_count}개 스킵됨` : undefined,
});
```

---

## 4. Full Functionality

### Student Mode (Recommended):
1. User selects year and month
2. User selects default time slot (morning/afternoon/evening)
3. System automatically queries all active students' class_days
4. System creates union of all class days from all students
5. System generates schedules for all matching dates in the month
6. Skips dates with existing schedules
7. Shows success message with created/skipped counts

### Season Mode (Advanced):
1. User selects active season
2. User selects target grade (고3 or N수)
3. System loads season's operating_days
4. System auto-selects time slots based on grade_time_slots config
5. User can select multiple time slots
6. System shows preview of all dates to be created
7. User can click dates to exclude them (marked with X)
8. System calculates: dates × time_slots = total schedules
9. On submit, creates all combinations
10. Skips existing schedules
11. Shows success message

### Class Mode (Legacy):
1. User provides class_id, year, month, weekdays
2. System creates schedules for specified weekdays
3. Uses class default time slot or override

---

## 5. Database Schema

### Table: `class_schedules`

**Relevant Columns:**
```sql
academy_id      - Academy identifier
class_id        - Optional class assignment
season_id       - Optional season association (Season mode)
target_grade    - Optional target grade (Season mode: '고3', 'N수')
class_date      - Schedule date (YYYY-MM-DD)
time_slot       - Time slot ('morning', 'afternoon', 'evening')
instructor_id   - Optional instructor (NULL for bulk, assigned later)
title           - Schedule title
```

**Unique Constraint Check:**
Checks for existing schedules using:
```sql
SELECT id FROM class_schedules 
WHERE academy_id = ? 
AND class_date = ? 
AND time_slot = ?
```

---

## 6. Dependencies

### Frontend Dependencies:
- `@/lib/api/seasons` - Season data fetching
- `@/lib/api/client` - API client for bulk creation
- `@/components/ui/dialog` - Modal UI
- `sonner` - Toast notifications
- `lucide-react` - Icons (Trophy, Users, CalendarPlus, etc.)

### Types Used:
```typescript
TimeSlot = 'morning' | 'afternoon' | 'evening'
SeasonTargetGrade = '고3' | 'N수'
CreateMode = 'season' | 'student'
```

### Backend Dependencies:
- `verifyToken` - Authentication middleware
- `checkPermission('schedules', 'edit')` - Permission check
- `db.getConnection()` - MySQL connection pool
- Transaction support (BEGIN, COMMIT, ROLLBACK)

---

## 7. User Flow Diagram

```
[Schedules Page]
      |
      | Click "일괄 생성" button
      v
[BulkScheduleModal Opens]
      |
      |-- Tab: 학생 수업일 (Recommended) ✅
      |     |
      |     |-- Select Year + Month
      |     |-- Select Time Slot
      |     |-- Click "수업 생성"
      |     |
      |     v
      |   POST /paca/schedules/bulk
      |     mode: 'student'
      |     |
      |     |-- Query all active students' class_days
      |     |-- Union all weekdays
      |     |-- Generate dates for month
      |     |-- Create schedules (skip existing)
      |     v
      |   Success Toast
      |   Modal Closes
      |   Refresh Schedule List
      |
      |-- Tab: 시즌 기반
            |
            |-- Select Season
            |-- Select Target Grade (고3/N수)
            |-- Select Time Slots (multiple)
            |-- Preview Dates (click to exclude)
            |-- Click "N개 수업 생성"
            |
            v
          POST /paca/schedules/bulk
            mode: 'season'
            |
            |-- Calculate dates from season operating_days
            |-- Create schedules for each date × timeslot
            |-- Skip existing
            v
          Success Toast
          Modal Closes
          Refresh Schedule List
```

---

## 8. Key Files Summary

| File | Purpose | Lines |
|------|---------|-------|
| `src/app/schedules/page.tsx` | Schedules page with button | Line 243 |
| `src/components/schedules/bulk-schedule-modal.tsx` | Modal component | 529 lines |
| `backend/routes/schedules.js` | API endpoint handler | Lines 530-830 |
| `src/lib/api/client.ts` | API client | - |
| `src/lib/api/seasons.ts` | Season API | - |

---

## 9. Related Permissions

**Permission Required:** `schedules.edit`

**Roles Allowed:**
- owner
- admin

**Backend Check:**
```javascript
checkPermission('schedules', 'edit')
```

---

## 10. Notes

- **PWA Consideration:** Version must be updated when modifying this feature (4 locations)
- **Transaction Safety:** Uses MySQL transactions with rollback on error
- **Duplicate Prevention:** Automatically skips existing schedules
- **Multiple Time Slots:** Season mode supports creating multiple time slots per date
- **Encrypted Fields:** Student names/phones are encrypted, but class_days is not
- **Default Mode:** Student mode is recommended and set as default
- **Smart Defaults:** Auto-selects first season, auto-sets time slots based on grade

---

## Open Questions

None - functionality is well-documented and tested.
