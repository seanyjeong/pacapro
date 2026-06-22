# Season List Page Split

## Scope

- Route: `/seasons`
- The runtime route is a wrapper. State, API calls, filters, summary, table/mobile list, loading, empty, and error states live under `src/features/season-list/`.
- Toss payment management remains on hold and untouched.

## Preserved API Contract

- `GET /seasons`
- `GET /seasons?year=:year&season_type=:type&status=:status`
- `DELETE /seasons/:id`

## UX Contract

- Season list load and delete failures show fixed Korean plain-language messages.
- Raw HTTP, CORS, DB, stack trace, or API error text is not shown to the operator.
- Mobile uses a stacked list instead of forcing the full table into a narrow viewport.

## Verification

- `npm run smoke:season-list` covers desktop, mobile, filtering, delete path, load error, raw technical text leakage, and horizontal overflow.
