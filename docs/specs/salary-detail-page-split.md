# Salary Detail Page Split

## Scope

- Route: `/salaries/[id]`
- Preserve backend contracts:
  - `GET /salaries/:id`
  - `POST /salaries/:id/pay`
  - `POST /salaries/:id/recalculate`
  - `PUT /salaries/:id`
- Keep password confirmation before payment.

## UX Notes

- Detail, rates, attendance, calculation, paid state, and actions are separate focused sections.
- Raw backend errors are not shown to users; action failures use fixed Korean messages.
- Print styles are preserved for salary statements.

## Verification

- Focused ESLint on route and `src/features/salary-detail`.
- TypeScript check.
- Production build.
- Playwright smoke for load, incentive edit, recalculation, password payment, error UX, and responsive overflow.
