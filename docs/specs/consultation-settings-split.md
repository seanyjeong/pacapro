# Consultation Settings Split

## Goal
- Keep `/consultations/settings` behavior stable while splitting the 1170-line route into feature-owned sections.
- Make consultation weekly hours easier to inspect because branch-level time availability depends on this setting path.

## Scope
- Route wrapper only in `src/app/consultations/settings/page.tsx`.
- State/API orchestration in `src/features/consultation-settings/use-consultation-settings-state.ts`.
- UI sections split by reservation link, page settings, weekly hours, blocked slots, referral sources, checklist, and dialogs.

## Acceptance
- All touched runtime files stay under 500 lines.
- Existing API contracts remain: settings info GET/PUT, weekly-hours PUT, blocked-slots POST/DELETE, public slug check.
- Browser smoke covers load, settings save, weekly-hours save, blocked date add/remove, Korean error/success UX, and mobile overflow.
