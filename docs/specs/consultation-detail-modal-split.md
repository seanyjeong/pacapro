# Consultation Detail Modal Split

## Scope

- Keep the public import path `src/components/students/consultation-detail-modal.tsx`.
- Move the modal implementation into `src/features/student-consultations`.
- Separate html2canvas/jsPDF inline styles from modal behavior.
- Preserve PDF download, score table, physical records, target university, memo, and footer rendering.
- Keep all runtime files under 500 lines.

## Acceptance Criteria

- Student consultation timeline can still open the consultation detail modal.
- PDF 저장 still renders the same printable content and calls html2canvas/jsPDF.
- Mock score and physical record parsing avoids `any`.
- Focused lint, TypeScript, production build, and browser smoke checks pass.
