# Per-Day Time Slot - Developer Quick Reference

> **Purpose**: Quick reference guide for developers working with per-day time slot feature
>
> **Last Updated**: 2026-02-24
> **Feature Status**: ✅ Completed & Deployed

---

## Data Format Quick Reference

### Legacy Format (Still Supported)
```javascript
{
  class_days: [1, 3, 6],           // Monday, Wednesday, Saturday
  time_slot: "morning"             // All days use this
}
```

### New Format (Preferred)
```javascript
{
  class_days: [
    { day: 1, timeSlot: "morning" },    // Monday
    { day: 3, timeSlot: "morning" },    // Wednesday
    { day: 6, timeSlot: "afternoon" }   // Saturday
  ],
  time_slot: "morning"             // Default for new days
}
```

### Parsing (Always Use This)
```javascript
const slots = parseClassDaysWithSlots(student.class_days, student.time_slot);
// Result: Always [{day:1,timeSlot:"morning"}, ...]
```

---

## Key Utility Functions

### Backend (`backend/routes/students.js` L17-56)

#### `parseClassDaysWithSlots(classDays, defaultTimeSlot = 'evening')`
Normalizes both legacy and new formats to new format.
```javascript
parseClassDaysWithSlots([1, 3, 6], 'morning')
// → [{day:1,timeSlot:'morning'}, {day:3,timeSlot:'morning'}, {day:6,timeSlot:'morning'}]

parseClassDaysWithSlots([{day:1,timeSlot:'morning'}], 'evening')
// → [{day:1,timeSlot:'morning'}]
```

#### `extractDayNumbers(classDaySlots)`
Get day numbers only from ClassDaySlot array.
```javascript
extractDayNumbers([{day:1,timeSlot:'morning'}, {day:6,timeSlot:'afternoon'}])
// → [1, 6]
```

#### `getTimeSlotForDay(classDaySlots, dayOfWeek, defaultTimeSlot = 'evening')`
Get time slot for specific day.
```javascript
getTimeSlotForDay(
  [{day:1,timeSlot:'morning'}, {day:6,timeSlot:'afternoon'}],
  1,
  'evening'
)
// → 'morning'

getTimeSlotForDay([{day:1,timeSlot:'morning'}], 3, 'evening')  // day 3 not found
// → 'evening'
```

### Frontend (`src/lib/utils/student-helpers.ts` L103-201)

Same signatures as backend, TypeScript versions with type safety.

---

## Common Tasks

### Task 1: Register New Student with Mixed Time Slots

```javascript
const newStudent = {
  name: "John Doe",
  class_days: [
    { day: 1, timeSlot: "morning" },     // Monday
    { day: 3, timeSlot: "morning" },     // Wednesday
    { day: 6, timeSlot: "afternoon" }    // Saturday
  ],
  time_slot: "morning",  // Default for any new days
  // ... other fields
};

// POST /students endpoint (backend/routes/students.js L710+)
// - Normalizes class_days via parseClassDaysWithSlots at L978
// - autoAssignStudentToSchedules uses per-day timeSlots at L67-141
```

### Task 2: Change Student's Time Slot for Specific Day

```javascript
// Frontend: Click day + select new time slot
const newClassDays = classDays.map(slot =>
  slot.day === 3  // Wednesday
    ? { ...slot, timeSlot: "afternoon" }
    : slot
);

// Send to: PUT /class-days/:id
await updateClassDays(studentId, { class_days: newClassDays });
```

### Task 3: Query Students by Day AND Time Slot

```javascript
// For legacy format [1, 3, 6] matching:
WHERE JSON_CONTAINS(class_days, JSON.stringify(1))

// For new format [{day:1,timeSlot:"morning"}] matching:
WHERE JSON_CONTAINS(class_days, JSON.stringify({day:1}))

// For both formats (dual query):
WHERE (
  JSON_CONTAINS(class_days, ?) OR JSON_CONTAINS(class_days, ?)
)
// params: [JSON.stringify(1), JSON.stringify({day:1})]

// To also match timeSlot in new format:
WHERE (
  JSON_CONTAINS(class_days, ?)
  OR JSON_CONTAINS(class_days, JSON.OBJECT('day', ?, 'timeSlot', ?))
)
// params: [JSON.stringify(1), 1, 'morning']
```

### Task 4: Migrate Legacy Data (When Ready)

```sql
-- Backup first!
CREATE TABLE students_class_days_backup AS
SELECT id, class_days, class_days_next FROM students;

-- Convert legacy [1,3,6] to [{day:1,...}]
UPDATE students
SET class_days = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT('day', CAST(jt.day_val AS UNSIGNED), 'timeSlot', COALESCE(time_slot, 'evening'))
  )
  FROM JSON_TABLE(class_days, '$[*]' COLUMNS (day_val INT PATH '$')) AS jt
)
WHERE JSON_TYPE(JSON_EXTRACT(class_days, '$[0]')) = 'INTEGER';

-- Same for class_days_next
UPDATE students
SET class_days_next = (
  SELECT JSON_ARRAYAGG(
    JSON_OBJECT('day', CAST(jt.day_val AS UNSIGNED), 'timeSlot', COALESCE(time_slot, 'evening'))
  )
  FROM JSON_TABLE(class_days_next, '$[*]' COLUMNS (day_val INT PATH '$')) AS jt
)
WHERE JSON_TYPE(JSON_EXTRACT(class_days_next, '$[0]')) = 'INTEGER';
```

---

## Important Code Locations

| Task | File | Lines | Notes |
|------|------|-------|-------|
| Auto-assign schedules | `backend/routes/students.js` | 67-141 | Uses parseClassDaysWithSlots |
| Reassign schedules | `backend/routes/students.js` | 148-231 | Per-day time slot logic |
| Create student | `backend/routes/students.js` | 710+ | Normalizes class_days at L978 |
| Update class days | `backend/routes/students.js` | 490-640 | Bulk + individual updates |
| Monthly cron | `backend/cron/monthly-schedule-assign.js` | 50-107 | Uses per-day timeSlots |
| Class days scheduler | `backend/scheduler/classDaysScheduler.js` | 55-58 | Applies scheduled changes |
| Student form UI | `src/components/students/student-form.tsx` | 116, 245-282 | Day buttons + timeslot dropdowns |
| Class days page | `src/app/students/class-days/page.tsx` | 99-168 | Bulk scheduling management |

---

## Common Pitfalls & Solutions

### Pitfall 1: Not Using Parser for Legacy Data
❌ **Wrong:**
```javascript
const days = JSON.parse(student.class_days);  // May be [1,3,6] or [{day:1,...}]
days[0].timeSlot  // TypeError! [1,3,6] has no .timeSlot
```

✅ **Right:**
```javascript
const slots = parseClassDaysWithSlots(student.class_days, student.time_slot);
const firstSlot = slots[0];  // Always {day:1,timeSlot:"..."}
```

### Pitfall 2: Not Selecting time_slot Column
❌ **Wrong:**
```sql
SELECT id, name, class_days FROM students;
-- Later: parseClassDaysWithSlots(student.class_days, student.time_slot)
-- → student.time_slot is undefined!
```

✅ **Right:**
```sql
SELECT id, name, class_days, time_slot FROM students;
```

### Pitfall 3: Comparing Class Days Without Normalization
❌ **Wrong:**
```javascript
const oldDays = new Set(student.class_days);  // May be mixed formats
const newDays = new Set(newClassDays);
if (oldDays.size !== newDays.size) { /* changed */ }  // Won't work for objects
```

✅ **Right:**
```javascript
const oldSlots = parseClassDaysWithSlots(student.class_days, student.time_slot);
const newSlots = parseClassDaysWithSlots(newClassDays, student.time_slot);
const oldKey = new Set(oldSlots.map(s => `${s.day}-${s.timeSlot}`));
const newKey = new Set(newSlots.map(s => `${s.day}-${s.timeSlot}`));
if (oldKey.size !== newKey.size || [...oldKey].some(k => !newKey.has(k))) { /* changed */ }
```

### Pitfall 4: Forgetting to Normalize Before Storage
❌ **Wrong:**
```javascript
// In POST /students endpoint
await db.query(
  'INSERT INTO students (class_days) VALUES (?)',
  [JSON.stringify(class_days)]  // Raw input, might be legacy format
);
```

✅ **Right:**
```javascript
// In POST /students endpoint
const normalized = parseClassDaysWithSlots(class_days, time_slot || 'evening');
await db.query(
  'INSERT INTO students (class_days) VALUES (?)',
  [JSON.stringify(normalized)]  // Always new format
);
```

---

## Testing Checklist

When modifying per-day-timeslot code:

- [ ] Test with legacy format student ([1,3,6]) - should work unchanged
- [ ] Test with new format student ([{day:1,...}]) - should work with per-day logic
- [ ] Test mixed timeslot scheduling (verify each day gets correct time slot)
- [ ] Test schedule reassignment (old class_days → new class_days)
- [ ] Test bulk class-days update (multiple students at once)
- [ ] Test monthly cron with per-day settings
- [ ] Test class days scheduled change (class_days_next execution)
- [ ] Test payment calculations (should use weekly_count, not timeSlots)
- [ ] Test backward compatibility (existing API clients still work)

---

## Related Documentation

- **Full Report**: [per-day-timeslot.report.md](./per-day-timeslot.report.md)
- **Design Doc**: [per-day-timeslot.design.md](../02-design/features/per-day-timeslot.design.md)
- **Plan Doc**: [per-day-timeslot.plan.md](../01-plan/features/per-day-timeslot.plan.md)
- **Gap Analysis**: [per-day-timeslot.analysis.md](../03-analysis/per-day-timeslot.analysis.md)

---

## Quick Command Reference

```bash
# Find all parseClassDaysWithSlots usage:
grep -r "parseClassDaysWithSlots" ~/pacapro/backend ~/pacapro/src

# Find all JSON_CONTAINS with class_days:
grep -r "class_days" ~/pacapro/backend --include="*.js" | grep JSON_CONTAINS

# Test a student's class_days:
mysql -u paca -p -e "SELECT id, name, class_days, time_slot FROM students WHERE id = 1"

# Check if class_days are legacy (numbers):
mysql -u paca -p -e "SELECT id, class_days, JSON_TYPE(JSON_EXTRACT(class_days, '$[0]')) as type FROM students LIMIT 5"
```

---

**Last Updated**: 2026-02-24
**Maintained By**: P-ACA Development Team
**Questions?**: Refer to completion report or contact team member
