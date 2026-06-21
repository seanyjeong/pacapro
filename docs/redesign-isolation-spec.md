# P-ACA Redesign Isolation Spec

## Problem

The production frontend feels dated, but direct redesign work in the production repo risks breaking live workflows.

## Scope

### In

- Isolated frontend/design refactoring workspace
- Existing source snapshot without git history
- Safe GitHub private repo
- Lab rules for local API/CORS usage

### Out

- Database dumps or migrations
- Production server edits
- Direct deployment from this lab repo
- Secrets, local env files, runtime logs, and private infrastructure notes

## Acceptance Criteria

- Lab repo is private under `etlab8320`.
- Source is available on the Mac mini under `/Users/etlab/projects/redesign-labs/paca-redesign-lab`.
- No `.env*`, DB dump, SQL, log, `.next`, `node_modules`, or operational runbook files are committed.
- Original production repo remains untouched.
- Future UI work uses branch/preview/review before back-porting.

## UI Contract

- Keep API contracts and route behavior unchanged unless a separate bugfix task approves it.
- Redesign should preserve dense operator workflows: students, consultations, schedules, payments.
- Empty/loading/error states must use plain Korean UX copy.

## Test Plan

- `npm install` only after the lab repo is created if dependencies are needed.
- `npm run build` before any preview push that changes runtime code.
- Playwright login smoke for dashboard, students, consultations, schedules, payments, tablet attendance.

## Risks

- Production API mutations during design review.
- Accidentally copying local secrets or server runbooks.
- Letting the lab repo diverge from the original product without a back-port plan.
