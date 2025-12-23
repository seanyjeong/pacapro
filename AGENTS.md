# Repository Guidelines

Contributor notes for the Next.js frontend and Express backend that power the P-ACA platform.

## Project Structure & Module Organization
- `src/app`, `src/components`, `src/lib/api|types|utils`: Next.js app router pages, shared UI, axios clients/types. Reuse primitives in `src/components/ui` before adding new atoms.
- `public/`, `landing/`, `docs/`: static assets, marketing pages, and internal notes (including Toss integration docs).
- `backend/`: Express API (`paca.js`) with `routes/`, `config/` (DB/env), `cron|scheduler/`, and `migrations/` for MySQL. `database/` stores SQL dumps; `n8n-workflows/` and `toss-plugin/` hold automation/integration code.

## Build, Test, and Development Commands
- Frontend: `npm install`, `npm run dev` (:3000), `npm run build`, `npm start`, `npm run lint`.
- Backend: `cd backend && npm install`, `npm run dev` (nodemon on :8320), `npm start`. Tests: `npm run test` (watch) or `npm run test:ci` (Jest/Supertest).
- Run frontend and backend dev servers together for end-to-end flows; check `.env.local` and `backend/.env` for required secrets.

## Coding Style & Naming Conventions
- TypeScript/React with four-space indentation; files kebab-case (`student-resume-modal.tsx`), components PascalCase. Co-locate page-specific pieces under their route folder when practical.
- Favor Tailwind utilities for styling; share tokens/components via `src/components/ui`. Keep API helpers typed in `src/lib/api` with DTOs in `src/lib/types`.
- Backend: async/await in routers, early validation with Joi, shared DB/helpers in `config/` and `utils/`. Keep comments concise (Korean is fine where clarifying).

## Testing Guidelines
- Frontend: linting is the baseline; add smoke/e2e checks for new flows if you introduce Playwright scripts under `tests/`.
- Backend: place Jest/Supertest specs under `backend/__tests__/` or next to routes (`routes/__tests__/foo.spec.js`). Mock external calls and add fixtures for DB-dependent logic.
- Cover new business rules (auth, payments, scheduling) and note manual steps in PRs when automation is missing.

## Commit & Pull Request Guidelines
- Use `type: summary` messages similar to history (`feat|fix|docs|chore`).
- PRs: include purpose/linked issue, short change log, screenshots or cURL examples for UI/API updates, test commands run, and notes on migrations or new env keys. Call out impacts to cron/schedulers or payment flows.

## Security & Configuration Tips
- Keep secrets in `.env.local` (frontend) and `backend/.env`; never commit them. Confirm MySQL connectivity via `backend/config/database.js` before running migrations.
- CORS/helmet live in `backend/paca.js`; adjust centrally. Record integration details in `docs/` to avoid drift.
