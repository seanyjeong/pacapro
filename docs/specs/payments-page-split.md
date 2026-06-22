# Payments Page Split

## Scope

The P-ACA payments screen was moved from a single route component into a feature slice. The page shell, filters, summary, error handling, notification send, quick payment, and credit-modal orchestration now live under `src/features/payments`.

## Preserved API Contract

- `GET /payments` with `year`, `month`, `payment_status`, `payment_type`, and `include_previous_unpaid`
- `GET /students/class-days`
- `GET /students/:id` for credit modal context
- `POST /notifications/send-unpaid` with `{ year, month }`
- `POST /payments/:id/pay` with quick payment payload

## UX Contract

- View-only users still see only unpaid rows.
- Owner users still see collected/expected amount in the payment-rate card.
- Quick payment and unpaid notification failures show fixed Korean user messages, never raw server status, storage, CORS, stack, or backend text.
- The page keeps the existing payment table, credit modal, and proration calculator behavior.

## Verification

- Focused lint, TypeScript, production build, and Playwright browser smoke must pass before this slice is complete.
