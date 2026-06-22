# Payment Editor Pages Split

## Scope

- Routes:
  - `/payments/new`
  - `/payments/[id]/edit`
- Preserve contracts:
  - `GET /students?status=active`
  - `POST /payments`
  - `GET /payments/:id`
  - `PUT /payments/:id`

## UX Requirements

- Use the Operations Desk form style for create/edit.
- Keep student tuition auto-fill for monthly charges.
- Edit mode keeps student selection locked.
- User-facing API failures use fixed Korean messages.
- Do not expose backend messages, status codes, stack traces, CORS text, or code terms.

## Verification

- Focused ESLint and TypeScript.
- Production build.
- Browser smoke for create, edit, student-load failure, and payment-load failure.
