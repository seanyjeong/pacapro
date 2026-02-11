---
name: verify-api-docs
description: API 문서(docs/API-ROUTES.md)와 실제 코드(backend/routes/*.js)의 일치 여부를 자동 검증
arguments:
  - name: route
    description: 특정 라우트만 검증 (예: students, payments). 생략 시 전체 검증
    required: false
  - name: fix
    description: true 시 docs/API-ROUTES.md를 실제 코드 기준으로 자동 업데이트
    required: false
---

# API 문서 검증 스킬

## 개요

`docs/API-ROUTES.md` 문서와 `backend/routes/*.js` 실제 코드를 비교하여 불일치를 찾아 보고합니다.

## 수행 절차

### Step 1: 라우트 프리픽스 매핑 수집

`backend/paca.js`에서 `app.use('/paca/X', XRoutes)` 패턴을 Grep으로 수집하여 **파일 → URL 프리픽스** 매핑 테이블을 만든다.

**URL 변환 규칙**: 코드의 `/paca/X`는 문서의 `/api/X`에 대응한다.

### Step 2: 실제 엔드포인트 추출

`backend/routes/*.js` 파일들에서 다음 패턴을 Grep으로 추출:

```
router.get|post|put|delete|patch('/path', ...middleware..., async (req, res) => {
```

{route} 인자가 있으면 해당 파일만 검사한다.

각 엔드포인트에서 추출할 정보:
- **Method**: GET/POST/PUT/DELETE/PATCH
- **Path**: 프리픽스 + 엔드포인트 경로
- **Permission**: 미들웨어에서 추출

### Step 3: 권한 추출 규칙

| 코드 패턴 | 문서 권한 표기 |
|-----------|--------------|
| `checkPermission('resource', 'action')` | `resource.action` |
| `requireRole('owner')` | `owner` |
| `requireRole('owner', 'admin')` | `owner, admin` |
| `requireRole('owner', 'admin', 'staff')` | `owner, admin, staff` |
| `verifyToken`만 있음 | `Token` |
| `verifyTossPlugin` | `Toss Plugin` |
| `verifyCallbackSignature` | `Callback` |
| 미들웨어 없음 | `Public` |

`checkAcademyAccess`는 권한이 아니므로 무시.

### Step 4: 문서 엔드포인트 추출

`docs/API-ROUTES.md`에서:
1. `**Base**: \`/api/X\`` 패턴으로 Base URL 파악
2. 테이블 행에서 Method, Endpoint, 권한 추출
3. 공개 API는 3컬럼 테이블 → 권한 = `Public`

### Step 5: 크로스 레퍼런스 비교

| 상태 | 의미 |
|------|------|
| **OK** | 코드+문서 일치, 권한도 일치 |
| **UNDOCUMENTED** | 코드에만 존재 |
| **STALE** | 문서에만 존재 |
| **PERMISSION_MISMATCH** | 엔드포인트 일치, 권한 불일치 |

### Step 6: 보고서 출력

요약 테이블 + 각 카테고리별 상세 테이블 출력.

### Step 7: 자동 수정 (fix=true)

보고서 출력 후 `docs/API-ROUTES.md` 업데이트:
- UNDOCUMENTED → 테이블에 행 추가
- STALE → 테이블에서 행 제거
- PERMISSION_MISMATCH → 권한 수정
- Last Updated 날짜 변경
