# Design: split-notifications-route

> **Date**: 2026-02-26
> **Feature**: notifications.js 3,538 lines → 6 domain-based files
> **Type**: Refactoring (zero logic change)
> **Based on**: Plan document (`docs/01-plan/features/split-notifications-route.plan.md`)

---

## 1. Target Structure

```
backend/routes/notifications/
├── index.js        # router delegation hub (~15 lines)
├── _utils.js       # shared helpers: decryptStudentInfo, decryptStudentArray, ENCRYPTION_KEY (~30 lines)
├── settings.js     # GET/PUT /settings (2 routes, L48-570)
├── send.js         # 8 send routes: manual + auto, Solapi + SENS (L728-950, L956-1131, L1206-1463, L1902-2149, L2559-2757, L2764-2916, L3185-3358, L3364-3536)
├── test.js         # 9 test routes: Solapi + SENS (L576-722, L1469-1607, L1613-1756, L1762-1895, L2199-2315, L2321-2429, L2435-2548, L2922-3045, L3051-3179)
└── logs.js         # GET /logs, GET /stats (2 routes, L1137-1199, L2155-2189)
```

## 2. File Specifications

### 2.1 `_utils.js` — Shared Helpers

**Source**: Lines 1-42 (imports + helpers + ENCRYPTION_KEY)

```javascript
// Exports:
module.exports = {
    db,                    // require('../../config/database')
    verifyToken,           // from ../../middleware/auth
    checkPermission,       // from ../../middleware/auth
    encryptApiKey,         // from ../../utils/naverSens
    decryptApiKey,         // from ../../utils/naverSens
    sendAlimtalk,          // from ../../utils/naverSens
    createUnpaidNotificationMessage, // from ../../utils/naverSens
    isValidPhoneNumber,    // from ../../utils/naverSens
    decrypt,               // from ../../utils/encryption
    logger,                // from ../../utils/logger
    sendAlimtalkSolapi,    // from ../../utils/solapi
    getBalanceSolapi,      // from ../../utils/solapi
    decryptStudentInfo,    // local function
    decryptStudentArray,   // local function
    ENCRYPTION_KEY         // process.env.ENCRYPTION_KEY
};
```

### 2.2 `settings.js` — Settings CRUD (2 routes, ~530 lines)

| Method | Path | Source Lines |
|--------|------|-------------|
| GET | /settings | L48-197 |
| PUT | /settings | L203-570 |

**Dependencies from `_utils.js`**: db, verifyToken, checkPermission, encryptApiKey, decryptApiKey, logger, ENCRYPTION_KEY, getBalanceSolapi

### 2.3 `send.js` — Send Routes (8 routes, ~1,400 lines)

| Method | Path | Source Lines | Type |
|--------|------|-------------|------|
| POST | /send-unpaid | L728-950 | Solapi manual bulk |
| POST | /send-individual | L956-1131 | Solapi manual individual |
| POST | /send-unpaid-today-auto | L1206-1463 | Solapi auto (n8n) |
| POST | /send-trial-today-auto | L1902-2149 | Solapi auto (n8n) |
| POST | /send-unpaid-today-auto-sens | L2559-2757 | SENS auto (n8n) |
| POST | /send-trial-today-auto-sens | L2764-2916 | SENS auto (n8n) |
| POST | /send-reminder-auto | L3185-3358 | Solapi reminder auto |
| POST | /send-reminder-auto-sens | L3364-3536 | SENS reminder auto |

**Dependencies from `_utils.js`**: db, verifyToken, checkPermission, decryptApiKey, sendAlimtalk, sendAlimtalkSolapi, isValidPhoneNumber, decrypt, logger, decryptStudentInfo, decryptStudentArray, ENCRYPTION_KEY

**Note**: `send-trial-today-auto-sens` (L2827-2829) uses `decryptField` which is NOT imported — this is a pre-existing bug. Preserve as-is (zero logic change policy).

### 2.4 `test.js` — Test Send Routes (9 routes, ~1,300 lines)

| Method | Path | Source Lines | Type |
|--------|------|-------------|------|
| POST | /test | L576-722 | Solapi unpaid test |
| POST | /test-consultation | L1469-1607 | Solapi consultation test |
| POST | /test-trial | L1613-1756 | Solapi trial test |
| POST | /test-overdue | L1762-1895 | Solapi overdue test |
| POST | /test-sens-consultation | L2199-2315 | SENS consultation test |
| POST | /test-sens-trial | L2321-2429 | SENS trial test |
| POST | /test-sens-overdue | L2435-2548 | SENS overdue test |
| POST | /test-reminder | L2922-3045 | Solapi reminder test |
| POST | /test-sens-reminder | L3051-3179 | SENS reminder test |

**Dependencies from `_utils.js`**: db, verifyToken, checkPermission, decryptApiKey, sendAlimtalk, sendAlimtalkSolapi, isValidPhoneNumber, logger, ENCRYPTION_KEY

### 2.5 `logs.js` — Logs & Stats (2 routes, ~110 lines)

| Method | Path | Source Lines |
|--------|------|-------------|
| GET | /logs | L1137-1199 |
| GET | /stats | L2155-2189 |

**Dependencies from `_utils.js`**: db, verifyToken, checkPermission, logger

### 2.6 `index.js` — Router Hub

```javascript
const express = require('express');
const router = express.Router();

require('./settings')(router);
require('./logs')(router);
require('./test')(router);
require('./send')(router);

module.exports = router;
```

**Route registration order**: Fixed paths only (no /:id wildcards), so order doesn't matter functionally. Group by domain for readability.

## 3. Pattern

Same delegation pattern as `students/` split:
```javascript
// Each file exports: module.exports = function(router) { ... }
// index.js calls: require('./filename')(router);
```

## 4. Safety

- `paca.js` change NOT required: `require('./routes/notifications')` → Node.js auto-resolves to `notifications/index.js`
- Zero logic change: cut-and-paste only
- Rollback: `git checkout` one command
