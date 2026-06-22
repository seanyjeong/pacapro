# Consultation Booking Page Split

## Scope
- Route: `/c/:slug`
- Wrapper: `src/app/c/[slug]/page.tsx`
- Feature: `src/features/consultation-booking/*`

## API Contract
- `GET /public/consultation/:slug`
- `GET /public/consultation/:slug/slots?date=YYYY-MM-DD`
- `POST /public/consultation/:slug/apply`

## UX Contract
- Public page errors use fixed Korean messages.
- Backend/CORS/stack trace text must not be visible.
- Native selects replace custom dropdowns for reliable mobile/accessibility behavior.
- Desktop and mobile layouts must not horizontally overflow.
