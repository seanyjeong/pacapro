# PACA Frontend Refactor Roadmap

## Operating Rule

Work page by page in production menu order. For every page:

- Confirm the current user job and backend API contract before UI changes.
- Keep existing permissions, auth headers, and route behavior.
- Replace raw `fetch`, `alert`, `confirm`, and technical error copy when a safe local component/API path exists.
- Split any touched runtime file over 500 lines before feature changes.
- Verify focused type/lint/build checks plus one browser-facing smoke path.

## Page Order

### Dashboard

- Status: done.
- Notes: Operations Desk layout, real API clients, Korean error UX, amount privacy mode with password confirmation.

### Academy Operations

1. Students
   - First risk: several student components exceed 500 lines.
   - First API fix: route student Excel download through `exportsApi.downloadStudents()`.
   - Shell refactor: root route split into `src/features/students`, with Korean error UX and Operations Desk header/tabs/search structure.
   - Next slice: split oversized detail/modal components before changing student detail workflows.
2. Instructors
3. Schedules
4. Student Class Days
5. Academy Events
6. Seasons
7. Performance

### Finance

1. Payments
2. Payment Credits
3. Salaries
4. Expenses
5. Incomes
6. Reports

### Communication

1. New Inquiry Consultations
2. Enrolled Student Consultations
3. SMS
4. Notification Settings

### Admin

1. Staff
2. Settings
3. Admin User Approval

## Acceptance Per Page

- API calls are centralized in `src/lib/api` unless there is a clear exception.
- Loading, empty, error, partial-success, and success states use Korean plain-language copy.
- Desktop and mobile screenshots show no overlapping text or controls.
- Existing data mutations still refresh affected lists and summaries.
- No production `pacapro` files are edited from this redesign lab.
