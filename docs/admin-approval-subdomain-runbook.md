# PACA Admin Approval Subdomain Runbook

## Goal
Expose a mobile-friendly approval shortcut for PACA owner signup requests:

```text
https://paca-approval.etlab.kr -> mobile-only signup approval page
```

The subdomain must not proxy the full PACA app. It serves only the mobile
approval page and calls the PACA API with a normal admin JWT. It must never
expose pending users without a valid system-admin token.

## Runtime Pieces
- Static page source: `ops/paca-approval-mobile/index.html`
- etserver document root: `/home/et/paca-approval-mobile`
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
    root * /home/et/paca-approval-mobile
    encode zstd gzip
    try_files {path} /index.html
    file_server
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
- Confirm it shows only the mobile approval login, not the full PACA app.
- Log in with a system admin account.
- Confirm pending users load without CORS or raw HTTP error text.
- Submit a test signup and confirm Telegram alert arrives with the approval URL.

## Rollback
1. Remove the `paca-approval.etlab.kr` Caddy block or restore the previous
   `/etc/caddy/Caddyfile` backup.
2. Validate and reload Caddy.
3. Set `PACA_APPROVAL_ADMIN_URL` back to the normal PACA approval route if the
   mobile page is unavailable.
4. Keep `/admin/users` available through the normal PACA app.
