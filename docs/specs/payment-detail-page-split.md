# Payment Detail Page Split

## Scope

- Route: `/payments/[id]`
- Preserve contracts:
  - `GET /payments/:id`
  - `POST /payments/:id/pay`
  - `PUT /payments/:id` for `paid_date`
  - `DELETE /payments/:id`
- Keep the existing payment record modal contract.

## UX Requirements

- Dense Operations Desk layout with a thin route wrapper and feature slice files.
- Loading, empty/error, normal, mobile, record-payment, paid-date update, and delete paths covered.
- User-facing API failures must use fixed Korean plain-language messages.
- Do not show raw backend messages, status codes, stack traces, CORS text, or code terms.

## Verification

- Focused ESLint and TypeScript.
- Production build.
- Browser smoke with mocked API routes for normal, mutation, delete, and load-error paths.
