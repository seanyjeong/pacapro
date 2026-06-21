# Instructor Form Split

## Scope

- Keep the public import path `src/components/instructors/instructor-form.tsx`.
- Move implementation into `src/features/instructor-form`.
- Split basic, salary, work settings, account, additional info, and form actions.
- Preserve create/edit form behavior and validation.
- Remove `any` from the form change and submit error paths.
- Keep all runtime files under 500 lines.

## Acceptance Criteria

- `/instructors/new` and `/instructors/[id]/edit` still render `InstructorForm`.
- Required name, phone, hire date, salary type, and salary fields still validate.
- Assistant hourly work settings still require work days and times.
- Submit still calls the parent `onSubmit` with `InstructorFormData`.
- Focused lint, TypeScript, production build, and browser smoke checks pass.
