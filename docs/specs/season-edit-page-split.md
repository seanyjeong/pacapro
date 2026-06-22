# Season Edit Page Split

## Scope
- Route: `/seasons/:id/edit`
- Wrapper: `src/app/seasons/[id]/edit/page.tsx`
- Feature: `src/features/season-edit/*`

## API Contract
- `GET /seasons/:id`
- `PUT /seasons/:id`
- Update payload includes the backend-supported season fields, including `status`, `allows_continuous`, and `continuous_to_season_type`.

## UX Contract
- Load and save failures use fixed Korean messages.
- Backend/CORS/stack trace text must not be visible.
- Desktop and mobile layouts must not horizontally overflow.
