# SMS Page Split

## Scope

- PC `/sms` route is now a thin app-router wrapper.
- SMS state/API orchestration lives in `src/features/sms/use-sms-page-state.ts`.
- UI is split into target selection, recipient filters, sender number, message content, image attachment, and recent logs components.

## UX Rules

- Failed SMS API calls show fixed Korean plain-language messages.
- Transport, storage, status-code, and stack details are not surfaced to the operator.
- Image previews use CSS background rendering to avoid the Next image warning for temporary object URLs.

## Verification

- Focused ESLint and TypeScript checks.
- Production build.
- Playwright smoke for direct phone sending with first-failure and retry-success API mocks.
