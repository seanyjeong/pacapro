# PACA Dashboard Redesign Spec

## Problem

The current dashboard shows the right backend data, but layout and visual weight make urgent daily work compete with decorative metric cards. The first redesign slice must keep the existing API behavior while moving dashboard functions into the selected Operations Desk structure.

## Users And Jobs

Desk staff and academy owners need to open PACA and immediately see what needs action today: unpaid fees, rest-ended students, instructor schedule coverage, confirmed consultations, and this month's operating numbers.

## Scope

### In

- Redesign the root dashboard in the isolated `paca-redesign-lab` repo.
- Keep existing backend calls:
  - `GET /paca/reports/dashboard`
  - `GET /paca/schedules/date/:date/instructor-attendance`
  - `GET /paca/consultations`
  - `GET /paca/students/rest-ended`
- Split the oversized dashboard route into focused feature files.
- Replace technical error leakage with plain Korean UI copy.
- Preserve navigation and modal behavior from the original dashboard.
- Hide dashboard money amounts by default and reveal them only after password confirmation.

### Out

- Backend schema changes.
- Production `pacapro` edits.
- Global sidebar redesign.
- Mobile `/m` dashboard redesign.

## Acceptance Criteria

- The dashboard still renders from backend data through the existing API clients.
- Unpaid, rest-ended, schedule, and consultation actions remain reachable.
- Finance data is only shown when existing permission checks allow it.
- Money values are hidden by default, can be revealed through login password confirmation, and can be hidden again manually.
- Password confirmation errors use Korean plain-language copy and do not expose server messages.
- Loading, empty, partial-error, full-error, and success states are visible in Korean.
- `src/app/page.tsx` stays thin and all touched runtime files are under 500 lines.
- Desktop and mobile viewport checks show no overlapping text or controls.

## API Contract

`dashboardAPI.getStats()` returns `DashboardStats` with `students`, `instructors`, `current_month`, `unpaid_payments`, and optional `rest_ended_students`.

Supplemental dashboard calls return today's instructor slots, confirmed consultations, and rest-ended student rows. Supplemental failures should not block the main dashboard if `reports/dashboard` succeeds.

`authAPI.verifyPassword()` calls `POST /auth/verify-password` before revealing dashboard money amounts. A failed password check must stay in the modal and must not clear the current login session.

## UI Contract

- Left column: today's work queue.
- Main top: compact KPI strip.
- Main bottom: monthly operating summary.
- Rest-ended students: inline queue action opens the existing resume flow.
- Amount privacy: dashboard header shows a compact money visibility control.
- Hidden money values: show labels such as `금액 숨김` or `••••`, never the real amount text.
- Revealed money values: stay visible only for a short current-tab unlock window or until the operator hides them.
- Errors: Korean plain-language messages only.
- Dashboard API failures suppress raw backend toast messages and render through the dashboard error state.

## Test Plan

- Typecheck/build the Next app.
- Run lint for touched frontend code.
- Start local dev server.
- Use Playwright desktop and mobile screenshots.
- In browser console/network, verify no unexpected frontend errors.
- Use Playwright to verify hidden amounts, password-modal failure copy, and successful reveal through the existing auth contract.

## Implementation Tasks

- [x] T1: Confirm dashboard API contract and original behavior.
- [x] T2: Extract dashboard data loading into a feature hook.
- [x] T3: Build Operations Desk dashboard components.
- [x] T4: Add dashboard amount privacy mode with password confirmation.
- [x] T5: Verify frontend/API contract and visual layout.
