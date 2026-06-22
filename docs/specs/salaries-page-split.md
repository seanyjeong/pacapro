# Salaries Page Split

## Scope

- Route: `/salaries`
- Preserve backend contracts:
  - `GET /settings/academy`
  - `GET /instructors?status=active`
  - `GET /salaries`
  - `GET /salaries/:id` for PDF export details
  - `POST /salaries/bulk-pay`
  - `GET /exports/salaries` for Excel export
- Keep the existing password confirmation modal before bulk pay.

## UX Notes

- Summary, filters, and the salary ledger are separated into scan-friendly operational sections.
- Export and bulk-pay errors use fixed Korean messages instead of raw API text.
- Mobile uses stacked sections and the salary table scrolls inside its panel.

## Verification

- Focused ESLint on route, feature files, and salary list.
- TypeScript check.
- Production build.
- Playwright smoke with mocked API for load, filtering, Excel export, bulk pay, error UX, and responsive overflow.
