# Incomes Page Split

## Scope

- Replace the 690-line `src/app/incomes/page.tsx` route with a feature wrapper.
- Move income loading, export, search, summary, CRUD form, list tables, and detail dialog into `src/features/incomes`.
- Preserve the existing backend contracts:
  - `GET /incomes?start_date&end_date`
  - `GET /payments?paid_year&paid_month&payment_status=paid`
  - `POST /incomes`
  - `PUT /incomes/:id`
  - `DELETE /incomes/:id`
  - `GET /exports/revenue`

## UX Contract

- Save, delete, load, and download failures show fixed Korean messages.
- Server status codes, CORS wording, call traces, and storage terms are not shown to users.
- Owner/staff edit permission still gates create/edit/delete controls.

## Verification

- Focused ESLint for income files.
- TypeScript compile.
- Production build.
- Playwright smoke for load, create failure copy, create success payload, delete failure copy, and responsive overflow.
