# Admin Approval Notifications Spec

## Problem
PACA owner signup requests currently wait inside the admin approval page. ET needs a mobile-first approval path that sends a Telegram alert immediately after signup and opens a dedicated approval-only mobile page from outside the local network.

## Users And Jobs
- ET admin: receive a signup alert, open the approval page on mobile, approve or reject the requester.
- New academy owner: submit signup once and wait for approval without needing a manual follow-up.

## Scope
### In
- Send a Telegram alert after a signup transaction commits.
- Keep the existing approval APIs as the source of truth.
- Serve a mobile-only approval page that does not proxy the full PACA app.
- Allow the external approval subdomain as a browser origin.
- Document the Caddy subdomain and required env keys without storing secrets.

### Out
- One-tap approval directly inside Telegram.
- New database tables or schema changes.
- Public unauthenticated approval links.

## Acceptance Criteria
- Signup still returns `201` when the Telegram notifier is not configured or fails.
- Telegram message includes academy name, requester name/email, and approval page URL, but never password or token values.
- Approval list, approve, and reject APIs stay protected by system admin auth.
- Browser users see Korean plain-language load/action errors, not raw HTTP/CORS/stack text.
- A Caddy runbook exists for serving only the mobile approval page at `paca-approval.etlab.kr`.

## Domain Model
- Existing `users.approval_status = 'pending'` remains the pending approval state.
- Existing `academies.owner_user_id` links a new owner to a new academy.

## API Contract
- `POST /paca/auth/register` response surface remains compatible.
- `GET /paca/users/pending` remains `{ message, users }`.
- `POST /paca/users/approve/:id` and `POST /paca/users/reject/:id` remain `{ message, user }`.

## UI Contract
- `/admin/users` remains the full PACA admin approval page.
- `/admin/approvals` remains a full PACA alias for normal app navigation only.
- `ops/paca-approval-mobile/index.html` is the mobile-only external approval page.
- Login is still required before viewing requests or performing approval actions.

## Test Plan
- Backend route tests for successful signup, duplicate email, and non-blocking Telegram failure.
- Notifier unit tests for disabled config, message formatting, and sanitized failure handling.
- Existing admin users smoke test for desktop, mobile, error UX, and access denied.
- Mobile approval page smoke test for login, pending list, approval action, and safe Korean error copy.
- Build, lint, and CORS/runbook review before production deployment.

## Implementation Tasks
- [x] T1: Split signup handler out of the oversized auth route.
- [x] T2: Add best-effort Telegram signup approval notifier.
- [x] T3: Add approval subdomain CORS origin.
- [x] T4: Add `/admin/approvals` page alias.
- [x] T5: Add the mobile-only approval page and smoke test.
- [x] T6: Document Caddy/env deployment steps and rollback.
