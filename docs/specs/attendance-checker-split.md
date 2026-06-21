# Attendance Checker Split

## Scope

- Keep the existing `AttendanceChecker` import path stable for schedule attendance pages.
- Move editor state, API helpers, statistics, student rows, makeup search, and absence reason UI into `src/features/attendance-checker`.
- Preserve the existing attendance submission contract: parent receives `AttendanceSubmission[]`.
- Use `suppressErrorToast` for attendance save and makeup add calls so server messages are not shown directly.

## Acceptance

- Runtime files stay below 500 lines.
- Attendance save and makeup add failures show fixed Korean plain-language messages.
- The `/schedules/[id]/attendance` browser path can load mocked schedule data, change statuses, save payloads, and handle a mocked makeup-add 500 without exposing raw server text.
