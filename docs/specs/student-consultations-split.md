# Student Consultations Split Spec

## Problem
`src/components/students/student-consultations.tsx` exceeds the 500-line runtime file limit and mixes data loading, timeline building, two card renderers, parsing helpers, and modal wiring in one file. This blocks safe redesign work on the student detail page.

## Users And Jobs
Admins and directors open a student detail page, review enrolled-student consultations and initial consultations in one timeline, expand records, and open the enrolled consultation detail/PDF modal.

## Scope
### In
- Split the student consultation tab into cohesive feature files.
- Preserve the current API calls and response shapes.
- Preserve loading, empty, expanded, and detail-modal behaviors.
- Keep every touched runtime file under 500 lines.

### Out
- No visual redesign beyond structure-preserving responsive safety.
- No backend/API changes.
- No changes to consultation creation/editing flows.

## Acceptance Criteria
- Student detail consultation tab still loads `/student-consultations/:studentId`.
- Academy name still loads from `/settings/academy` for the detail modal.
- Enrolled and initial consultations render in date-descending order.
- Expand/collapse behavior still works independently for each timeline item.
- Enrolled consultation detail modal still opens from the eye action.
- Empty and loading states remain Korean plain-language UI.
- Focused lint/type/build and browser-facing smoke checks pass.

## Domain Model
- `StudentConsultation`: enrolled student consultation record.
- `InitialConsultation`: initial counseling/inquiry record linked to the student.
- `TimelineItem`: normalized timeline entry, either `student` or `initial`.

## API Contract
- `GET /student-consultations/:studentId`
  - Reads `{ consultations: StudentConsultation[], initialConsultations?: InitialConsultation[] }`.
- `GET /settings/academy`
  - Reads optional `settings.academy_name`.

## UI Contract
- Loading: spinner with Korean loading copy.
- Empty: guidance copy and link to `/consultations/enrolled`.
- Success: header with record count, add button, timeline cards, detail modal.
- Mobile: cards must remain readable without text overflow.
- Error: existing behavior is console-only; this split does not change user-visible error handling.

## Test Plan
- Focused ESLint on changed student consultation files.
- `npx tsc --noEmit`.
- `npm run build`.
- Playwright smoke with mocked API responses:
  - open `/students/:id`,
  - switch to `상담 기록`,
  - verify timeline order and initial/enrolled labels,
  - expand both record types,
  - open detail modal,
  - check mobile width has no horizontal overflow.

## Implementation Tasks
- [ ] T1: Extract shared types and pure helpers.
  - Files: `src/features/student-consultations/*`
  - Acceptance: no behavior change; types reusable by cards and container.
- [ ] T2: Extract enrolled consultation timeline card.
  - Files: `src/features/student-consultations/student-consultation-card.tsx`
  - Acceptance: expand and detail action still work.
- [ ] T3: Extract initial consultation timeline card.
  - Files: `src/features/student-consultations/initial-consultation-card.tsx`
  - Acceptance: inquiry/memo/scores/checklist sections still render.
- [ ] T4: Keep legacy import compatibility.
  - Files: `src/components/students/student-consultations.tsx`
  - Acceptance: existing student detail import remains valid.

## Risks
- Existing code uses loose JSON payloads from the backend. Use `unknown` parsing helpers rather than introducing narrow assumptions.
- Existing empty error behavior is weak but outside this structural split; redesign/error UX comes after oversized files are split.
