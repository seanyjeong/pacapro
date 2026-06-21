# Manual Credit Modal Split

## Scope

- Keep the public import path `src/components/students/manual-credit-modal.tsx`.
- Move the modal implementation into `src/features/manual-credit-modal`.
- Preserve the existing create, list, edit, delete, and apply-credit API behavior.
- Keep all runtime files under 500 lines.

## Acceptance Criteria

- Student detail and payments pages can still open `ManualCreditModal`.
- Creating a manual credit validates reason, date/count/amount input, and calls `studentsAPI.createManualCredit`.
- The manage tab loads credits through `studentsAPI.getCredits`.
- Edit, delete, and apply actions call the same API methods and refresh parent data.
- Focused lint, TypeScript, production build, and browser smoke checks pass.
