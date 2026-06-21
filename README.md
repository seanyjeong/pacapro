# P-ACA Redesign Lab

Isolated private workspace for redesigning the P-ACA frontend without changing the production repository history.

## Scope

- Source snapshot: `/Users/etlab/projects/pacapro` at `eb28d4f`
- Git history: intentionally not copied
- Database dumps, env files, runtime logs, server runbooks, and local automation folders: intentionally excluded
- Production deploy target: none

## Safety Rules

- Do not commit `.env*`, DB dumps, logs, generated builds, or server credentials.
- Prefer local Next.js dev ports and Vercel Preview URLs for review.
- Use production APIs only through an explicit local proxy or allowlisted localhost origin.
- Avoid write/delete/payment/notification actions against production data while doing visual work.
- Back-port only reviewed UI changes to the original product repo.

## Next Step

Start with the shared product UI system, then pilot the refreshed UI on consultation and student-management workflows.
