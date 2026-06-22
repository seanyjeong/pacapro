# Season Enroll Page Split

## Scope

- Route: `/seasons/[id]/enroll`
- Runtime route file is a wrapper. Season enroll state, API calls, layout, rows, and dialog live under `src/features/season-enroll/`.
- Toss payment management is intentionally out of scope and untouched.

## Preserved API Contract

- `GET /seasons/:id`
- `GET /students?grade_type=high`
- `POST /seasons/:id/enroll`

## UX Contract

- Loading, load failure, empty states, search, already-enrolled students, and submit failure use fixed Korean copy.
- The page does not expose HTTP codes, CORS terms, DB details, stack traces, or raw API messages to the operator.
- Time slot selection keeps at least one slot selected.
- Season registration payload preserves `student_id`, `season_fee`, `discount_amount`, and `time_slots`.

## Verification

- `npm run smoke:season-enroll` covers desktop, mobile, API payload, load error, submit error, raw technical text leakage, and horizontal overflow.
