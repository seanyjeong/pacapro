# PACA Deployment

## Release Target
| Role | Target | Notes |
|---|---|---|
| Backend primary | Vultr systemd | PACA backend behind `https://supermax.kr/paca/*` |
| Frontend primary | Vercel | `pacapro` production project from the reviewed refactor source |
| Legacy reference | n100 | Rollback/data-reference only after cutover approval |

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
PACA notification scheduling moves to the internal scheduler on Vultr only
after `scripts/scheduler_handoff_evidence_writer.py` proves:

- the six PACA n8n notification workflows are inactive;
- the Vultr PACA internal scheduler is enabled;
- the n100 PACA internal scheduler is disabled.

## Database
Do not treat Vultr as write-primary until DB-primary preflight proof exists:

- fresh n100 and Vultr `paca` dumps;
- checksums and row-count parity for critical tables;
- rollback from pre-change dumps;
- n100-to-Vultr sync disabled or redesigned.

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
Rollback must use the phase-specific runbook. Do not re-enable n100 as primary
unless the rollback decision includes DB direction, scheduler ownership, and
consumer-route proof.
