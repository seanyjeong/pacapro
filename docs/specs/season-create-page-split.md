# Season Create Page Split

## Scope
- Route: `/seasons/new`
- Wrapper: `src/app/seasons/new/page.tsx`
- Feature: `src/features/season-create/*`

## API Contract
- `POST /seasons`
- Request body keeps backend create fields:
  - `season_name`
  - `season_type`
  - `season_start_date`
  - `season_end_date`
  - `non_season_end_date`
  - `operating_days`
  - `grade_time_slots`
  - `default_season_fee`
  - `allows_continuous`
  - `continuous_to_season_type`
  - `continuous_discount_type`
  - `continuous_discount_rate`

## UX Contract
- Backend errors are hidden behind a fixed Korean message.
- Unsaved create-only fields that backend does not accept are not shown.
- Desktop and mobile layouts must not horizontally overflow.
