# PDCA Completion Changelog

> **Summary**: Documentation of completed PDCA cycles and feature releases
>
> **Project**: P-ACA (파카)
> **Last Updated**: 2026-02-24

---

## [2026-02-24] - Per-Day Time Slot Feature

### Added
- Per-day time slot support (morning/afternoon/evening per class day)
- `ClassDaySlot` interface for structured day + time slot data
- `parseClassDaysWithSlots()` utility function (backend + frontend) for backward-compatible parsing
- Per-day logic in `autoAssignStudentToSchedules()` and `reassignStudentSchedules()`
- Time slot selection UI in student form (day buttons + per-day dropdown)
- Class-days management page with per-day time slot editing
- Monthly cron support for per-day time slots (fixed hardcoded 'evening' bug)
- Class days scheduler support for per-day time slots
- Dual-format JSON_CONTAINS queries for legacy/new data format support
- Data normalization guards in POST/PUT endpoints
- Server-side format conversion for backward compatibility

### Changed
- `class_days` JSON structure from `[1,3,6]` to `[{day:1,timeSlot:"morning"}, ...]`
- Student form UI to show per-day time slot dropdowns
- Class-days management UI to support per-day time slot editing
- Monthly schedule assignment cron to use per-day time slots
- Class days scheduler to parse and apply per-day time slots
- API responses to normalize `class_days` to new format

### Fixed
- Monthly cron hardcoded 'evening' time slot (now uses per-day settings)
- Class days scheduler missing `time_slot` in SELECT query
- Missing server-side normalization for class_days POST/PUT endpoints
- Data format inconsistency between legacy and new formats
- Change detection logic to handle both day changes and time slot changes separately

### Notes
- **Backward Compatible**: Existing students with legacy [1,3,6] format continue to work
- **Design Match Rate**: 87% → 97% (after 1 iteration of fixes)
- **Files Modified**: 12 files (4 backend, 6 frontend, 2 type/utils)
- **Database Migration**: Deferred (parser handles both formats)
- **Deployment Ready**: ✅ Yes (requires version bump in 4 locations)

**Related Documents:**
- Plan: [per-day-timeslot.plan.md](../01-plan/features/per-day-timeslot.plan.md)
- Design: [per-day-timeslot.design.md](../02-design/features/per-day-timeslot.design.md)
- Analysis: [per-day-timeslot.analysis.md](../03-analysis/per-day-timeslot.analysis.md)
- Report: [per-day-timeslot.report.md](./per-day-timeslot.report.md)

---

## How to Use This Changelog

Add new entries at the top in this format when completing PDCA cycles:

```markdown
## [YYYY-MM-DD] - {Feature Name}

### Added
- New feature 1
- New feature 2

### Changed
- Changed behavior 1

### Fixed
- Bug fix 1

### Notes
- Important note 1
- Important note 2
```

Keep entries concise - detailed information is in the corresponding report documents.
