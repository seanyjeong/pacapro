# Performance Page Split

## Scope

- Route: `/performance`
- The runtime route is a wrapper. State, API calls, tabs, Jungsi status, student list, and score cards live under `src/features/performance/`.
- Toss payment management remains on hold and untouched.

## Preserved API Contract

- `GET /jungsi/status`
- `GET /students?status=active,paused`
- `GET /jungsi/scores/:studentId?exam=:exam` for `3월`, `6월`, `9월`, `수능`

## UX Contract

- Status, student list, and score lookup failures show fixed Korean plain-language messages.
- The screen does not expose HTTP codes, CORS terms, DB details, stack traces, or raw API messages.
- The mock exam tab keeps the original behavior of fetching all four exams when a student row is expanded.

## Verification

- `npm run smoke:performance` covers desktop, mobile, Jungsi status error, student list error, score lookup error, score request URLs, raw technical text leakage, and horizontal overflow.
