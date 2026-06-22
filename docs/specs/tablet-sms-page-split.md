# Tablet SMS Page Split

## Scope

- Tablet `/tablet/sms` route is now a thin app-router wrapper.
- The tablet screen reuses the shared SMS state hook, payload builder, sender-number loader, and Korean error UX.
- The layout keeps a single-column portrait flow and switches to compose/log split view in landscape.

## UX Rules

- SMS API failures use fixed Korean messages from the shared SMS hook.
- Temporary image previews are rendered by shared CSS background previews.
- Recent logs use the shared responsive log component instead of a duplicated tablet table.

## Verification

- Focused ESLint and TypeScript checks.
- Production build.
- Playwright smoke with tablet viewport for first-failure and retry-success SMS send.
