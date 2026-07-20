# PACA Deployment

## Release Target
| Role | Target | Notes |
|---|---|---|
| Backend primary | Vultr systemd | PACA backend behind `https://supermax.kr/paca/*` |
| Frontend primary | Vercel | `pacapro` production project from the reviewed refactor source |

PACA 운영 서버, 운영 DB, 스케줄러, Google Drive 백업의 기준 호스트는
Vultr 하나뿐이다. 폐기된 N100은 배포, 검증, 롤백, 데이터 비교 대상으로 사용하지 않는다.

Canonical backend:

```text
https://supermax.kr/paca/*
https://supermax.kr/paca-health
```

`chejump.com` is a legacy compatibility bridge only. Do not use it as a new
frontend, backend, smoke, or env default.

## Scoped Hotfix Gate
A PACA-only hotfix may use this gate instead of the full cutover gate when all
of the following are true:

- the diff changes PACA application code, tests, smoke scripts, or this runbook only;
- no environment, dependency, auth middleware, scheduler, migration, database,
  Caddy, domain/API base, Vercel, Next.js, or GitHub workflow file changes;
- backend tests, lint, type checks, production build, and the relevant browser
  smoke pass;
- a Git rollback tag and a checksum-verified backup of every changed Vultr
  runtime file exist before deployment;
- `ET_ALLOW_PRODUCTION=1` has explicit approval in the active conversation.

Run the executable scope gate and its tests before committing:

```bash
node --test scripts/release/hotfix-scope.test.mjs
node scripts/release/hotfix-preflight.mjs
cd backend && npm run test:ci
cd .. && npm run lint && npm run build
```

The hotfix gate must score `100/100`. After committing, rerun it with the
rollback tag as `--base`. Deploy only the changed backend runtime files, prove
local/remote checksum parity, restart only `paca-failover.service`, and verify
the public health and CORS paths. Push `main` only after the backend is healthy;
then wait for the matching Vercel Production deployment and run the relevant
browser smoke.

If any excluded surface changes, or the hotfix changes data ownership, routing,
credentials, scheduler ownership, or DB state, stop and use the full cutover
gate below.

## Full Cutover Gate
Do not deploy or restart full production cutover paths until the
approval-gated cutover command pack passes. The minimum local proof set is:

```bash
cd /Users/etlab/projects/paca-peak-platform-map
python3 scripts/source_contract_audit.py
python3 scripts/frontend_release_manifest_audit.py
python3 scripts/backend_release_manifest_audit.py
python3 scripts/operator_release_docs_audit.py
python3 scripts/phase1_vercel_preflight_audit.py
python3 scripts/release_orchestration_audit.py --skip-network --skip-remote
```

Production approval is still required for Vercel binding/env cleanup, Vultr
backend deployment, scheduler handoff, DB-primary changes, and bridge removal.

## Frontend
- Source: this refactor worktree, branch `main`.
- Target: Vercel `pacapro` production project after GitHub binding approval.
- Browser API base: `https://supermax.kr/paca`.
- Do not depend on public `NEXT_PUBLIC_API_URL`,
  `NEXT_PUBLIC_FALLBACK_API_URL`, or `NEXT_PUBLIC_SOCKET_URL` fallbacks.
- Mobile signup approval shortcut: see
  `docs/admin-approval-subdomain-runbook.md` before adding the etserver Caddy
  subdomain or Telegram signup notification env keys.

## Backend
- Source of truth: reviewed local backend files in this worktree.
- Target: Vultr PACA service directory after backup.
- Preserve remote `.env*` files; do not copy env values into this repo or the
  map workspace.
- MAX LINK family reads require a dedicated `MAXLINK_READ_API_KEY`. The same
  value is configured as `PACA_SOURCE_API_KEY` only in the MAX LINK API. It is
  accepted solely for the allowlisted academy-scoped GET routes.
- Restart only the approved PACA systemd service after file parity proof.

## Scheduler
PACA 알림 스케줄러는 Vultr에서만 실행한다. 배포 전후로 Vultr의 내부
스케줄러 상태와 중복 실행 여부를 확인한다.

## Database
Vultr의 `paca` 데이터베이스가 유일한 운영 쓰기 원본이다. 데이터 변경 전에는
Vultr에서 대상 행을 별도 백업하고, 트랜잭션 범위와 변경 행 수를 검증한다.

## Production Database Backups

PACA and Peak production backups run on Vultr because the active databases are
local to that host. Google Drive backup evidence must come from the Vultr timer
and its local staging files.

- Script: `/usr/local/sbin/et-db-drive-backup`
- Service: `et-db-drive-backup.service`
- Timer: daily at `03:00 Asia/Seoul`, with missed-run persistence
- Local staging: `/root/backups/google-drive-db/{paca,peak}`
- Remote: the existing `gdrive:server-backups/{paca,peak}` rclone target
- Retention: 30 days locally and remotely
- Integrity: gzip validation plus a SHA-256 sidecar before upload

Before enabling the timer, run the service once and restore the Drive copy into
a uniquely named isolated database. Compare critical row counts with production
while reporting normal writes that occurred after the snapshot separately. Drop
only the isolated verification database. Never test a restore directly against
`paca` or `peak`.

Rollback:

1. Disable `et-db-drive-backup.timer` on Vultr.
2. Restore the timestamped Vultr systemd/script/config backup.
3. Repair and verify the Vultr backup service before re-enabling its timer.

## Smoke
```bash
curl -s https://supermax.kr/paca-health
curl -s https://supermax.kr/jungsi/public/schools/2027
```

Browser-facing CORS proof must be collected through:

```bash
cd /Users/etlab/projects/paca-peak-platform-map
python3 scripts/cors_preflight_evidence_writer.py
python3 scripts/cors_preflight_evidence_audit.py
```

## Rollback
Rollback must use the phase-specific Vultr runbook and timestamped Vultr backups.
Do not introduce another PACA primary host as part of an application rollback.
