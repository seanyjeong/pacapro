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
- frontend patch releases update `package.json`, `package-lock.json`, and
  `src/constants/release.json` together. Only the app version and release date
  may change; the preflight compares complete JSON content against the base and
  rejects dependency, script, lock resolution, or unrelated metadata changes;
- backend tests, lint, type checks, production build, and the relevant browser
  smoke pass;
- a Git rollback tag and a checksum-verified backup of every changed Vultr
  runtime file exist before deployment;
- `ET_ALLOW_PRODUCTION=1` has explicit approval in the active conversation.

Run the executable scope gate and its tests before committing:

```bash
node --test scripts/release/hotfix-scope.test.mjs
node --test scripts/release/hotfix-release-metadata.test.mjs
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


## MAX AI 개별 출결·수납 계약 수정 (2026-09-12)

Backend-only 후속 후보는 `GET /schedules/:id/attendance-state`로 실제 저장 출결과
적격학생을 저장 없이 반환한다. `POST /:id/attendance`의 `mode=individual`은 반 전체
마감·신규 알림을 생략하고 대상 학생만 정정한다. 기존 화면은 mode를 보내지 않으므로
기존 전체 제출을 유지한다. 출결 해제 시 보충일도 비운다.

단건 수납·취소는 수납 행을 `FOR UPDATE`로 잠그고 매출 장부와 같은 트랜잭션에 저장한다.
장부 오류를 무시하지 않으며 수납 변경도 롤백한다. 금액 계산·인증·결제업체 연동은 유지한다.
DB migration, 새 환경 변수, 프론트 배포는 없다. 이 원본을 먼저 활성화한 뒤 Academy
Operations를 반영해야 한다. 롤백은 Operations의 출결 변경을 먼저 중단한 후 PACA의
체크섬 백업을 복구한다. 이미 기록된 수납을 자동 취소하거나 기존 DB를 복원하지 않는다.

검증: backend Jest 1,104건, 임시 네이티브 MySQL 4건(동시 수납·수납/취소 장부 실패·
조회 무변경), 프론트 lint 오류 0건·빌드 통과. MySQL은 독립된 소켓 전용 임시 DB이며
운영 자료를 사용하지 않는다. 실행기는 MaxAIwithhermes의
`scripts/test-academy-operations-native-mysql.py --paca`다.
