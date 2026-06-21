# Time Slot Detail Modal Split

## Scope

- Keep the existing `TimeSlotDetailModal` import path stable for PC and tablet schedule pages.
- Move the modal implementation into `src/features/time-slot-detail-modal`.
- Preserve the current schedule API contract for slot data, instructor attendance, student attendance, slot move, student search, and makeup add.

## Acceptance

- Runtime files stay below 500 lines.
- Student and instructor save failures use fixed Korean user-facing messages.
- Server messages, status codes, CORS text, and stack traces are not exposed in toasts.
- The `/schedules` browser path can open the modal and complete the main save/search actions against mocked APIs.
