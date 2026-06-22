# Settings Page Split

## Scope

- Replace the 723-line `src/app/settings/page.tsx` route with a feature wrapper.
- Move settings data loading, save, reset, and UI sections into `src/features/settings`.
- Preserve the existing backend contracts:
  - `GET /auth/me`
  - `GET /settings/academy`
  - `GET /settings`
  - `PUT /settings/academy`
  - `PUT /settings`
  - `POST /settings/reset-database`

## UX Contract

- Save and reset failures show fixed Korean messages.
- Server status codes, network policy words, call traces, and storage terms are not shown to users.
- Owner-only destructive reset remains gated by typing `초기화` and browser confirmation.

## Verification

- Focused ESLint for settings files.
- TypeScript compile.
- Production build.
- Playwright smoke for load, save failure copy, save success payloads, reset failure copy, and responsive overflow.
