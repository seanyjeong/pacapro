# SMS Permission Bug Report

**Generated:** 2026-01-28

## Bug Summary

Staff members (강사) with SMS permissions (`sms: { view: true, edit: true }`) cannot send SMS messages. The system incorrectly requires `settings` permission instead of `sms` permission.

## Root Cause

**ALL SMS routes in `/backend/routes/sms.js` use `checkPermission('settings', 'edit')` instead of `checkPermission('sms', 'edit')`**

## Affected Routes

### File: `/home/sean/pacapro/backend/routes/sms.js`

| Line | Route | Current (WRONG) | Should Be |
|------|-------|-----------------|-----------|
| 40 | `POST /sms/send` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 567 | `POST /sms/sender-numbers` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 637 | `PUT /sms/sender-numbers/:id` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 695 | `DELETE /sms/sender-numbers/:id` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |

### File: `/home/sean/pacapro/backend/routes/notifications.js`

Similar issue - notification routes also use 'settings' permission:

| Line | Route | Current (WRONG) | Should Be |
|------|-------|-----------------|-----------|
| 48 | `GET /notifications/settings` | `checkPermission('settings', 'view')` | OK (this is settings) |
| 203 | `PUT /notifications/settings` | `checkPermission('settings', 'edit')` | OK (this is settings) |
| 576 | `POST /notifications/test` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 728 | `POST /notifications/send-unpaid` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 956 | `POST /notifications/send-individual` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 1137 | `GET /notifications/logs` | `checkPermission('settings', 'view')` | `checkPermission('sms', 'view')` |
| 1466 | `POST /notifications/test-consultation` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 1610 | `POST /notifications/test-trial` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 1759 | `POST /notifications/test-overdue` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 2152 | `GET /notifications/stats` | `checkPermission('settings', 'view')` | `checkPermission('sms', 'view')` |
| 2196 | `POST /notifications/test-sens-consultation` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 2318 | `POST /notifications/test-sens-trial` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 2432 | `POST /notifications/test-sens-overdue` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 2916 | `POST /notifications/test-reminder` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |
| 3045 | `POST /notifications/test-sens-reminder` | `checkPermission('settings', 'edit')` | `checkPermission('sms', 'edit')` |

## Error Message

When staff tries to access SMS without 'settings' permission, they see:

```json
{
  "error": "Permission Denied",
  "message": "설정 수정 권한이 없습니다.",
  "permission_required": { "page": "settings", "action": "edit" }
}
```

**Source:** `/home/sean/pacapro/backend/middleware/auth.js` lines 237-243

## How Permission System Works

### Middleware: `checkPermission(page, action)`
Location: `/home/sean/pacapro/backend/middleware/auth.js`

```javascript
const checkPermission = (page, action) => {
    return (req, res, next) => {
        // owner/admin always pass
        if (req.user.role === 'owner' || req.user.role === 'admin') {
            return next();
        }

        // Check staff permissions
        const permissions = req.user.permissions || {};
        const pagePermission = permissions[page] || { view: false, edit: false };

        if (!pagePermission[action]) {
            const pageLabel = PAGE_LABELS[page] || page;
            const actionLabel = ACTION_LABELS[action] || action;
            return res.status(403).json({
                error: 'Permission Denied',
                message: `${pageLabel} ${actionLabel} 권한이 없습니다.`,
                permission_required: { page, action }
            });
        }
        next();
    };
};
```

### Page Labels
```javascript
const PAGE_LABELS = {
    students: '학생 관리',
    instructors: '강사 관리',
    payments: '학원비',
    salaries: '급여 관리',
    schedules: '스케줄',
    reports: '리포트',
    expenses: '지출 관리',
    incomes: '기타수입',
    seasons: '시즌 관리',
    settings: '설정',
    staff: '직원 관리',
    // ... more
};
```

**NOTE:** `sms` is NOT in PAGE_LABELS, so it should be added.

## Frontend Impact

### SMS Page
- **File:** `/home/sean/pacapro/src/app/sms/page.tsx`
- **No frontend permission checks found** - relies entirely on backend
- Line 77: Calls `/notifications/settings` which requires 'settings' permission

### API Client
- **File:** `/home/sean/pacapro/src/lib/api/sms.ts`
- Calls SMS routes that all check 'settings' permission

## Fix Required

### 1. Update `/backend/routes/sms.js`
Replace all `checkPermission('settings', 'edit')` with `checkPermission('sms', 'edit')`:

```bash
# Lines to fix: 40, 567, 637, 695
sed -i "s/checkPermission('settings', 'edit')/checkPermission('sms', 'edit')/g" /home/sean/pacapro/backend/routes/sms.js
```

### 2. Update `/backend/routes/notifications.js`
Replace SMS-related routes (NOT settings routes):

Lines to change:
- 576, 728, 956: POST routes (send notifications)
- 1466, 1610, 1759: test routes
- 2196, 2318, 2432, 2916, 3045: SENS test routes
- 1137, 2152: GET logs/stats (use 'sms', 'view')

Keep as-is:
- 48, 203: GET/PUT `/settings` (these ARE settings)

### 3. Update `/backend/middleware/auth.js`
Add 'sms' to PAGE_LABELS:

```javascript
const PAGE_LABELS = {
    students: '학생 관리',
    instructors: '강사 관리',
    payments: '학원비',
    salaries: '급여 관리',
    schedules: '스케줄',
    reports: '리포트',
    expenses: '지출 관리',
    incomes: '기타수입',
    seasons: '시즌 관리',
    settings: '설정',
    sms: 'SMS',  // ADD THIS
    staff: '직원 관리',
    // ...
};
```

## Testing

After fix, test with staff account that has:
```json
{
  "permissions": {
    "sms": { "view": true, "edit": true },
    "settings": { "view": false, "edit": false }
  }
}
```

Expected: Staff can send SMS successfully.

## Related Files

- `/home/sean/pacapro/backend/routes/sms.js` - SMS routes
- `/home/sean/pacapro/backend/routes/notifications.js` - Notification/SMS routes
- `/home/sean/pacapro/backend/middleware/auth.js` - Permission middleware
- `/home/sean/pacapro/src/app/sms/page.tsx` - SMS frontend
- `/home/sean/pacapro/src/lib/api/sms.ts` - SMS API client
