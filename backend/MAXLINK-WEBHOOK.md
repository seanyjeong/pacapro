# PACA → MAX LINK Student Status Webhook

PACA is the source of truth for student status. A MySQL trigger writes only a
terminal student event to `maxlink_webhook_outbox` in the same transaction as
the PACA change:

- `active` → `withdrawn`: queue `withdrawn` once.
- hard delete: queue `deleted` before the student row is removed.
- all other statuses: no event.

The PACA scheduler checks due events every five seconds, signs the exact JSON
body with HMAC SHA-256, and posts it to MAX LINK. Failed deliveries stay in the
outbox and retry after 5 seconds, 30 seconds, 2 minutes, 10 minutes, then hourly.
No name, phone number, school, score, or other student information is sent.

## Required environment

```dotenv
MAXLINK_WEBHOOK_URL=https://api.maxlink.supermax.kr/v1/source-events/paca
MAXLINK_WEBHOOK_SECRET=<shared-random-secret-of-at-least-32-bytes>
```

The signing secret is dedicated to this webhook and must not reuse PACA JWT,
encryption, notification, or MAX LINK service credentials.

## Migration

Apply `migrations/20260715_maxlink_webhook_outbox.mysql` after a PACA database
backup. Rollback uses `migrations/20260715_maxlink_webhook_outbox_down.mysql`.
The rollback removes only the two triggers and the outbox table; it never
changes a student row.

When packaging on macOS, use `COPYFILE_DISABLE=1` and bsdtar's
`--no-mac-metadata` option. PACA auto-loads every `.js` file in `scheduler/`, so
AppleDouble `._*.js` metadata must never be included in a deployment archive.

## Verification

- Focused Jest tests cover configuration, exact-body signing, dispatch retry,
  safe error storage, and repository queries.
- The optional MySQL integration test requires an isolated database whose name
  ends in `_test`:

```bash
PACA_WEBHOOK_TEST_DATABASE_URL=mysql://.../paca_webhook_test \
  npx jest --runInBand __tests__/integration/maxlinkWebhookOutbox.mysql.test.js
```
