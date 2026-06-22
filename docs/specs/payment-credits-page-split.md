# Payment Credits Page Split

## Scope

- Route: `/payments/credits`
- Preserve backend contracts:
  - `GET /payments/credits`
  - `GET /payments/credits/summary`
- Replace raw API toasts with a fixed Korean user-facing failure message.

## UX Notes

- Main content uses a compact operations table so branch staff can scan student, type, period, amount, and status quickly.
- Summary figures remain at the top, followed by credit-holding student chips and filters.
- On mobile, the page itself does not overflow; the ledger table scrolls horizontally inside its section.

## Verification

- Focused ESLint on route and `src/features/payment-credits`.
- TypeScript check.
- Production build.
- Playwright smoke with mocked API responses for list, summary, filters, failure UX, and responsive overflow.
