# Gap Detector Memory

## Project: P-ACA (pacapro)

### Stack
- Backend: Express.js + MySQL (backend/)
- Frontend: Next.js 15 + TailwindCSS (separate repo on Vercel)
- Auth: verifyToken, requireRole, checkPermission middleware
- Encryption: name, phone, parent_phone, address fields are encrypted

### Key Paths
- Routes: `backend/routes/`
- Main app: `backend/paca.js`
- Tests: `npm test` from `backend/`
- Config: `backend/config/database.js`

### Analysis History
- **split-students-route** (2026-02-26): 98% match rate. PASSED.
  - 3,609-line God Object split into 8 domain files (24 routes)
  - Delegation pattern: `module.exports = function(router) { ... }`
  - Minor deviations: 2 extra _utils functions, 1 over-specified dependency
  - Report: `docs/03-analysis/split-students-route.analysis.md`

### Patterns Observed
- Route files use delegation pattern (receive router param, not create own)
- Registration order in index.js matters for Express path matching
- Fixed paths (/rest-ended, /class-days) must register before /:id wildcards
- Node.js auto-resolves `require('./routes/students')` to `students/index.js`
