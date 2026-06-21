# Class Days Page Split

## Scope

- Keep the route `src/app/students/class-days/page.tsx`.
- Move implementation into `src/features/class-days`.
- Split the class-days table from the page container.
- Preserve class-day loading, filtering, day toggles, time-slot changes, bulk save, and scheduled-change cancellation.
- Keep all runtime files under 500 lines.

## Acceptance Criteria

- `/students/class-days` still loads students from `studentsAPI.getClassDays`.
- Filtering by grade, weekly count, and search still works.
- Toggling a day or time slot marks the row as changed and enables save.
- Saving still calls `studentsAPI.bulkUpdateClassDays` with `effective_from` and changed students.
- Focused lint, TypeScript, production build, and browser smoke checks pass.
