# Season Detail Page Split

## Scope

`/seasons/:id` keeps the existing season detail behavior while moving state, API calls, and view sections into a feature slice.

## Preserved API Contract

- `GET /seasons/:id`
- `GET /seasons/:id/students`
- `DELETE /seasons/:id`
- `DELETE /seasons/:seasonId/students/:studentId`
- `PUT /seasons/enrollments/:enrollmentId` with `{ time_slots: TimeSlot[] }`
- `POST /seasons/enrollments/:enrollmentId/refund-preview` with `{ cancellation_date, include_vat: false }`
- `POST /seasons/enrollments/:enrollmentId/cancel` with `{ cancellation_date, include_vat, final_refund_amount }`

## UX Contract

- Load failures show `시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.`
- Enrollment list, delete, cancel, refund, and time-slot failures show fixed Korean messages.
- Raw API messages, status codes, stack traces, DB wording, and CORS labels are not exposed in the page.
- The visual direction follows Operations Desk: compact header, summary strip, split information panels, and table-first enrolled student management.
