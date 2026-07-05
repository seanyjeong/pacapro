# Credit Payment Edit Preserve Credit Spec

## Problem
When a monthly payment already has a rest credit applied, editing amount fields
recalculates `final_amount` without subtracting the existing `carryover_amount`.
The credit remains marked as applied, but the payment amount visually loses the
credit reduction.

## Scope
### In
- Preserve applied credit reduction when editing payment amount fields.
- Keep existing payment API response shape.
- Add regression coverage for credit-applied payment edits.

### Out
- New credit reversal UI.
- Production DB repair execution.

## Acceptance Criteria
- Editing `base_amount`, `discount_amount`, or `additional_amount` keeps the
  existing `carryover_amount` reflected in `final_amount`.
- `final_amount` never becomes negative.
- Non-credit payment edit behavior remains unchanged.
- Academy isolation and payment permission behavior remain unchanged.

## API Contract
`PUT /paca/payments/:id` keeps returning `{ message, payment }`.

## Test Plan
- Unit route test for normal amount recalculation.
- Unit route test for amount recalculation with `carryover_amount`.
- Existing payment CRUD tests remain passing.

## Rollback Notes
Rollback is code-only. If production data has already drifted, repair affected
payment rows from `base_amount`, `discount_amount`, `additional_amount`, and
`carryover_amount`.
