# PACA Admin Approval Subdomain Runbook

## Goal
Expose a mobile-friendly approval shortcut for PACA owner signup requests:

```text
https://paca-approval.etlab.kr -> PACA admin approval page
```

The page still uses normal PACA admin login. It must never expose pending users without a valid admin token.

## Runtime Pieces
- Frontend page: `/admin/users`
- Frontend alias: `/admin/approvals`
- Backend approval APIs:
  - `GET /paca/users/pending`
  - `POST /paca/users/approve/:id`
  - `POST /paca/users/reject/:id`
- Telegram notifier env keys:
  - `PACA_SIGNUP_TELEGRAM_BOT_TOKEN`
  - `PACA_SIGNUP_TELEGRAM_CHAT_ID`
  - `PACA_APPROVAL_ADMIN_URL`
- CORS env key:
  - `PACA_APPROVAL_ORIGIN`

## Caddy Site Block
Add this on etserver Caddy after DNS points the subdomain to etserver:

```caddyfile
paca-approval.etlab.kr {
    @root path /
    rewrite @root /admin/approvals

    reverse_proxy https://pacapro.vercel.app {
        header_up Host pacapro.vercel.app
        header_up X-Forwarded-Host {host}
        header_up X-Forwarded-Proto {scheme}
    }
}
```

## Backend Env
Set these on the PACA backend runtime host without printing values:

```bash
PACA_APPROVAL_ORIGIN=https://paca-approval.etlab.kr
PACA_APPROVAL_ADMIN_URL=https://paca-approval.etlab.kr
PACA_SIGNUP_TELEGRAM_BOT_TOKEN=<secret>
PACA_SIGNUP_TELEGRAM_CHAT_ID=<secret>
```

Telegram is best-effort. Signup must keep succeeding even if Telegram is missing or Telegram API is temporarily down.

## Deploy Order
1. Deploy frontend and backend code.
2. Set backend env keys.
3. Restart PACA backend.
4. Add the Caddy site block on etserver.
5. Run Caddy validation:

```bash
sudo caddy validate --config /etc/caddy/Caddyfile
```

6. Reload Caddy:

```bash
sudo systemctl reload caddy
```

## Smoke Checks
```bash
curl -I https://paca-approval.etlab.kr
curl -s https://supermax.kr/paca-health
```

Browser checks:
- Open `https://paca-approval.etlab.kr` on mobile.
- Confirm it asks for login when not authenticated.
- Log in with a system admin account.
- Confirm pending users load without CORS or raw HTTP error text.
- Submit a test signup and confirm Telegram alert arrives with the approval URL.

## Rollback
1. Remove the `paca-approval.etlab.kr` Caddy block.
2. Validate and reload Caddy.
3. Unset or ignore the Telegram env keys.
4. Keep `/admin/users` available through the normal PACA app.
