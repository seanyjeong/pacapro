# Schedules Page Split

## Scope

- Route: `/schedules`
- The runtime route is a wrapper. Page state, API calls, header, loading/error states, calendar/list shell, and instructor panel toggle live under `src/features/schedules/`.
- Existing schedule subcomponents remain reused.
- Toss payment management remains on hold and untouched.

## Preserved API Contract

- `GET /schedules?start_date=:start&end_date=:end`
- `DELETE /schedules/:id`
- `GET /schedules/instructor-schedules/month?year=:year&month=:month`
- `GET /consultations/calendar/events?startDate=:start&endDate=:end`
- `GET /instructors/overtime/pending` when the current user can view overtime approvals

## UX Contract

- Schedule load and delete failures show fixed Korean plain-language messages.
- Raw HTTP, CORS, DB, stack trace, or API error text is not shown to the operator.
- Calendar/list view, instructor attendance, slot detail, extra-day request, and approval modals remain available.

## Verification

- `npm run smoke:schedules` covers desktop, mobile, month API contract, stats and consultation requests, delete payload path, load error, raw technical text leakage, and horizontal overflow.
