# Expenses Page Split

## Scope

The P-ACA expenses screen was split from one route component into a feature slice while preserving backend contracts.

## Preserved API Contract

- `GET /expenses` with `start_date` and `end_date`
- `POST /expenses`
- `PUT /expenses/:id`
- `DELETE /expenses/:id`
- `POST /expenses/:id/complete-refund` with `{ payment_method }`
- `exportsApi.downloadExpenses()` without additional filters

## UX Contract

- Operators can switch list/calendar views, search visible rows, register/edit/delete regular expenses, and complete pending refunds.
- Salary-linked expenses remain read-only and show `급여 연동`.
- Frontend error messages are fixed Korean plain-language strings and do not expose server status codes, storage terms, stack traces, or raw backend messages.

## Verification

- Focused lint, TypeScript, production build, and Playwright browser smoke must pass before this slice is considered complete.
