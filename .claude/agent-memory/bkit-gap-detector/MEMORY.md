# Gap Detector Agent Memory

## Project: P-ACA (pacapro)

### Key File Locations
- **Types**: `src/lib/types/student.ts` (ClassDaySlot, ClassDaysValue at top)
- **Frontend helpers**: `src/lib/utils/student-helpers.ts` (parseClassDaysWithSlots etc.)
- **Backend routes**: `backend/routes/students.js` (~3000+ lines, very large)
- **Cron**: `backend/cron/monthly-schedule-assign.js`
- **Scheduler**: `backend/scheduler/classDaysScheduler.js`
- **Design docs**: `docs/02-design/features/`
- **Analysis docs**: `docs/03-analysis/`

### Patterns Observed
- Backend utility functions (parseClassDaysWithSlots etc.) are duplicated across files (students.js, monthly-schedule-assign.js) -- no shared module
- JSON_CONTAINS dual-format pattern used for backward compat: `JSON_CONTAINS(col, CAST(? AS JSON)) OR JSON_CONTAINS(col, CAST(? AS JSON))` with params [number, {day: number}]
- Frontend always compensates for missing backend normalization via parseClassDaysWithSlots
- students.js is extremely large (3000+ lines) -- must read in chunks with offset/limit

### Common Gap Patterns
- Backend storage: raw JSON.stringify without normalization guard (relies on frontend sending correct format)
- Scheduler files may lag behind main route files in feature updates
- Design says "normalize on backend" but implementation often normalizes only at read-time (frontend)

### Analysis Methodology
- Read design doc fully first
- Read implementation files in parallel (chunk large files)
- Use Grep for specific patterns (JSON_CONTAINS, function names)
- Count items per phase, score Match/Partial/Gap
