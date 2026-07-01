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

## Approval Gates
Do not deploy or restart production paths until the approval-gated cutover
command pack passes. The minimum local proof set is:

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

## Backend
- Source of truth: reviewed local backend files in this worktree.
- Target: Vultr PACA service directory after backup.
- Preserve remote `.env*` files; do not copy env values into this repo or the
  map workspace.
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
