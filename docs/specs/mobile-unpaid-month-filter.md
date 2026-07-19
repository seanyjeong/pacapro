# Mobile Monthly Unpaid Filter

## Scope

- Route: `/m/unpaid`
- Default view: students with class today who have unpaid charges.
- Monthly view: every unpaid charge in the academy for the selected billing month.
- The selected month defaults to the current local month.

## API Contract

- Today view uses `GET /payments/unpaid-today`.
- Monthly view uses `GET /payments/unpaid`, then filters its existing `year_month` response field on the client.
- Both requests keep the existing bearer authentication and payments-view permission contract.
- No backend response or database change is required.

## User States

- `오늘 수업` and `월 전체` controls switch the lookup scope.
- Monthly view exposes a native month selector and updates the heading, summary, list, and empty state.
- Load and payment failures remain plain Korean messages without technical response details.
- Search, phone calls, permission checks, and full-payment processing remain available in both scopes.

## Verification

- Unit coverage: exact month filtering and Korean month labels.
- Browser coverage: mobile and desktop viewports, API switching, authorization header, search, payment, error copy, and horizontal overflow.
