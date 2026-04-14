# P-ACA 멀티지점 관리 기능 기획서 (v3 - 5에이전트 검수 반영)

## 개요

여러 원장(동업자)이 여러 학원 지점을 함께 관리할 수 있는 기능.
**접근 방식: 그룹 + 계정 연결(Account Linking)** - 기존 코드 최소 변경, 기존 단일지점 사용자 영향 없음.

### 대표 시나리오

```
원장A (개성점 메인 담당) -> 개성점 + 평양점 + 워싱턴점 전체 조회
원장B (평양점 메인 담당) -> 개성점 + 평양점 + 워싱턴점 전체 조회
원장C (워싱턴점 메인 담당) -> 개성점 + 평양점 + 워싱턴점 전체 조회

3명 모두 동일한 그룹에 속하며, 각자 메인 담당 지점만 다름.
통합 대시보드에서 전 지점 데이터 한눈에 확인 가능.
```

### 검수 이력

| 버전 | 날짜 | 내용 |
|------|------|------|
| v1 | 2026-01-28 | 초안 작성 |
| v2 | 2026-01-28 | 3에이전트 검수 (DB, 보안, API) - 치명적 9건 해결 |
| v3 | 2026-01-28 | 5에이전트 검수 (DB, 보안, API, UX, P-EAK 통합) - 치명적 10건, 중요 15건 반영 |

---

## 핵심 설계 결정 (v3 확정)

| 항목 | 결정 | 이유 |
|------|------|------|
| **로그인 시 지점 기준** | `user_academies.is_default` | 명확한 "기본 지점" 개념 분리 |
| **지점 전환 시** | 새 JWT 발급 (academyId+tokenVersion 포함) + `users.academy_id` UPDATE | P-EAK 하위호환 + 세션별 독립 |
| **is_default 변경** | 전환과 분리, 별도 API (Transaction 필수) | 전환할 때마다 기본값 바뀌는 문제 방지 |
| **verifyToken 추가 쿼리** | 안 함 (JWT 신뢰) + `token_version` 비교 | 성능 우선 + 즉시 무효화 가능 |
| **1유저 = 1그룹** | 강제 | `users.group_id` 컬럼으로 제약 |
| **초대 이메일 검증** | 필수 + 이메일 정규화 | `.toLowerCase().trim().normalize('NFC')` 비교 |
| **초대 토큰** | `crypto.randomBytes(32).toString('hex')` (256bit) | 예측 불가능 |
| **지점 전환 방식** | SPA 전환 (React Query 캐시 초기화) | 전체 새로고침 → 3~5초 로딩 방지 |
| **캐시 삭제** | API 캐시만 선택적 삭제 (정적 자산 유지) | 매 전환마다 전체 다운로드 방지 |
| **탭 동기화** | BroadcastChannel + 미저장 변경 보호 | storage 이벤트보다 빠르고 안정적 |
| **FK 삭제 전략** | ON DELETE RESTRICT (soft delete 일관성) | SET NULL/CASCADE → 고아 데이터 방지 |
| **초대 신규 가입** | 기존 원장 수동 승인 필요 | 토큰 유출 시 무단 계정 생성 방지 |

### JWT 라이프사이클 (v3 확정)

```
로그인:
  1. user_academies에서 is_default=1인 지점 조회
  2. JWT 생성: { userId, academyId: default지점, tokenVersion }
  3. 응답: token + user + academies 목록

지점 전환:
  1. user_academies에서 접근 권한 확인
  2. academies.deleted_at IS NULL 확인 (비활성 학원 차단)
  3. 새 JWT 생성: { userId, academyId: 선택한지점, tokenVersion }
  4. users.academy_id UPDATE (P-EAK 하위호환)
  5. is_default는 변경하지 않음
  6. 응답: 새 token + academy 정보 + user 최소 정보

verifyToken (매 요청):
  1. JWT 디코드
  2. DB에서 유저 조회 (기존과 동일, token_version 포함)
  3. token_version 불일치 → 401 (즉시 무효화)
  4. JWT에 academyId 있음 → 그대로 사용 (추가 쿼리 없음)
  5. JWT에 academyId 없음 → users.academy_id 사용 (하위호환)
  6. req.user.academyId 설정

권한 박탈:
  → user_academies에서 제거 + token_version++ → 기존 JWT 즉시 무효화
  → 긴급 시 users.is_active=false → 전체 차단

JWT 만료:
  → 프론트에서 401 받음 → 로그인 페이지 이동 → is_default 지점으로 재로그인
```

---

## 현재 구조 (AS-IS)

- `users.academy_id` → 유저 1명 = 학원 1개 (1:1)
- `academies.owner_user_id` → 학원 1개 = 원장 1명
- JWT에는 `userId`만 포함, `verifyToken`이 매 요청마다 DB에서 `academy_id` 조회
- 19개 라우트 파일, 326곳에서 `req.user.academyId`로 데이터 필터링

---

## 변경 구조 (TO-BE)

```
academy_groups (신규)       → 지점 그룹 ("점프맥스 그룹")
academies.group_id (추가)   → 어느 그룹에 속하는지
users.group_id (추가)       → 유저가 속한 그룹 (1유저=1그룹 강제)
users.token_version (추가)  → JWT 즉시 무효화용 (v3 신규)
user_academies (신규)       → 유저가 접근 가능한 지점 목록 (N:N)
group_invitations (신규)    → 원장 초대
JWT { userId, academyId, tokenVersion }  → 현재 활성 지점 (세션별 독립)
users.academy_id (유지)     → P-EAK 하위호환 + 마지막 활성 지점
```

**핵심: 기존 200+ API 엔드포인트는 변경 없음** → `req.user.academyId`가 그대로 작동

---

## Phase 1: 데이터베이스

### 1.1 신규 테이블: `academy_groups`

```sql
CREATE TABLE academy_groups (
  id INT AUTO_INCREMENT PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  created_by INT NULL,                 -- 최초 생성한 원장 (삭제 시 NULL 유지)
  deleted_at TIMESTAMP NULL,           -- 소프트 삭제 (실제 DELETE 금지)
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL
);
```

### 1.2 `academies` 테이블 수정

```sql
ALTER TABLE academies ADD COLUMN group_id INT DEFAULT NULL;
-- v3: ON DELETE RESTRICT (soft delete만 허용, 실수 방지)
ALTER TABLE academies ADD FOREIGN KEY (group_id) REFERENCES academy_groups(id) ON DELETE RESTRICT;
ALTER TABLE academies ADD INDEX idx_group_id (group_id);
```

### 1.3 `users` 테이블 수정

```sql
-- 1유저=1그룹 강제
ALTER TABLE users ADD COLUMN group_id INT DEFAULT NULL;
ALTER TABLE users ADD FOREIGN KEY (group_id) REFERENCES academy_groups(id) ON DELETE RESTRICT;
ALTER TABLE users ADD INDEX idx_user_group_id (group_id);

-- v3: JWT 즉시 무효화용
ALTER TABLE users ADD COLUMN token_version INT NOT NULL DEFAULT 0;
```

### 1.4 신규 테이블: `user_academies`

```sql
CREATE TABLE user_academies (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  academy_id INT NOT NULL,
  -- v3: Phase 1은 owner/admin만 허용. staff/teacher 멀티지점은 향후 확장
  role ENUM('owner','admin') NOT NULL DEFAULT 'owner',
  is_primary TINYINT(1) NOT NULL DEFAULT 0,   -- 이 유저의 메인 담당 지점
  is_default TINYINT(1) NOT NULL DEFAULT 0,   -- 로그인 시 기본 접속 지점
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_user_academy (user_id, academy_id),
  INDEX idx_user_id (user_id),
  INDEX idx_academy_id (academy_id),
  -- v3: 복합 인덱스 추가 (WHERE user_id=? AND is_primary=1 빈번)
  INDEX idx_user_primary (user_id, is_primary),
  INDEX idx_user_default (user_id, is_default),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  -- v3: ON DELETE RESTRICT (학원 삭제 시 연결 자동 삭제 방지)
  FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE RESTRICT
);
```

### 1.5 is_primary / is_default 무결성 보장 (v3 신규)

```sql
-- MySQL 8.0+: TRIGGER로 user_id당 is_primary=1, is_default=1이 최대 1개 강제
DELIMITER $$

CREATE TRIGGER trg_user_academies_before_insert
BEFORE INSERT ON user_academies
FOR EACH ROW
BEGIN
  IF NEW.is_primary = 1 THEN
    UPDATE user_academies SET is_primary = 0
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  IF NEW.is_default = 1 THEN
    UPDATE user_academies SET is_default = 0
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
END$$

CREATE TRIGGER trg_user_academies_before_update
BEFORE UPDATE ON user_academies
FOR EACH ROW
BEGIN
  IF NEW.is_primary = 1 AND OLD.is_primary = 0 THEN
    UPDATE user_academies SET is_primary = 0
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
  IF NEW.is_default = 1 AND OLD.is_default = 0 THEN
    UPDATE user_academies SET is_default = 0
    WHERE user_id = NEW.user_id AND id != NEW.id;
  END IF;
END$$

DELIMITER ;
```

### 1.6 신규 테이블: `group_invitations`

```sql
CREATE TABLE group_invitations (
  id INT AUTO_INCREMENT PRIMARY KEY,
  group_id INT NOT NULL,
  invited_email VARCHAR(255) NOT NULL,     -- 정규화된 이메일 (lowercase, trimmed)
  invited_by INT NULL,
  -- v3: 초대자 정보 비정규화 (삭제돼도 기록 유지)
  invited_by_name VARCHAR(255) NULL,
  invited_by_email VARCHAR(255) NULL,
  role ENUM('owner','admin') DEFAULT 'owner',
  token CHAR(64) NOT NULL UNIQUE,          -- crypto.randomBytes(32).toString('hex')
  status ENUM('pending','accepted','expired','canceled') DEFAULT 'pending',
  primary_academy_id INT DEFAULT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NOT NULL,           -- 7일 후 만료
  accepted_at TIMESTAMP NULL,
  -- v3: ON DELETE RESTRICT (soft delete 일관성)
  FOREIGN KEY (group_id) REFERENCES academy_groups(id) ON DELETE RESTRICT,
  FOREIGN KEY (invited_by) REFERENCES users(id) ON DELETE SET NULL,
  FOREIGN KEY (primary_academy_id) REFERENCES academies(id) ON DELETE SET NULL,
  INDEX idx_token (token),
  INDEX idx_email_status (invited_email, status),
  INDEX idx_expires (expires_at)
);
```

### 1.7 만료 초대 자동 정리 (v3 신규)

```sql
-- MySQL Event Scheduler로 1시간마다 만료 처리
SET GLOBAL event_scheduler = ON;

CREATE EVENT evt_expire_invitations
ON SCHEDULE EVERY 1 HOUR
DO
  UPDATE group_invitations
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < NOW();
```

### 1.8 유저 승인 시 user_academies 자동 생성 (v3 신규)

> 마이그레이션에서 `approval_status = 'approved'` 조건으로 필터했으므로,
> 나중에 승인되는 유저도 자동으로 user_academies에 추가되어야 함.
> → **승인 API에서 명시적으로 처리** (TRIGGER 대신 앱 레벨)

```javascript
// backend/routes/settings.js - 유저 승인 API에 추가
// 승인 완료 후:
await db.query(
  `INSERT IGNORE INTO user_academies (user_id, academy_id, role, is_primary, is_default)
   VALUES (?, ?, ?, 1, 1)`,
  [userId, user.academy_id, user.role === 'owner' ? 'owner' : 'admin']
);
```

### 1.9 마이그레이션 (기존 데이터)

```sql
-- 멱등 마이그레이션: 이미 실행된 경우 안전하게 스킵
INSERT IGNORE INTO user_academies (user_id, academy_id, role, is_primary, is_default)
SELECT u.id, u.academy_id,
  CASE WHEN u.role IN ('owner','admin') THEN u.role ELSE 'admin' END,
  1, 1
FROM users u
WHERE u.academy_id IS NOT NULL
  AND u.deleted_at IS NULL
  AND u.approval_status = 'approved'
  AND u.role IN ('owner','admin','staff','teacher');
```

> 기존 단일지점 유저: `group_id = NULL`, `user_academies` 1개 행. 기존과 동일 동작.

### 1.10 DB 구조 다이어그램

```
academy_groups (그룹) [soft delete]
  ├── academies (group_id FK, ON DELETE RESTRICT)
  │     ├── 개성점 (group_id=1)
  │     ├── 평양점 (group_id=1)
  │     └── 워싱턴점 (group_id=1)
  └── group_invitations (group_id FK, ON DELETE RESTRICT)

users (group_id FK, ON DELETE RESTRICT)
  ├── 원장A (group_id=1, token_version=0)
  ├── 원장B (group_id=1, token_version=0)
  └── 원장C (group_id=1, token_version=0)

user_academies (N:N 연결)
  ├── 원장A → 개성점(primary,default), 평양점, 워싱턴점
  ├── 원장B → 개성점, 평양점(primary,default), 워싱턴점
  └── 원장C → 개성점, 평양점, 워싱턴점(primary,default)

TRIGGER: is_primary/is_default 각 user_id당 최대 1개 강제
EVENT: 만료 초대 1시간마다 자동 expired 처리
```

### 1.11 마이그레이션 실행 순서

```sql
-- 반드시 이 순서로 실행
1. CREATE TABLE academy_groups
2. ALTER TABLE academies ADD group_id (+ FK RESTRICT)
3. ALTER TABLE users ADD group_id (+ FK RESTRICT)
4. ALTER TABLE users ADD token_version
5. CREATE TABLE user_academies (+ TRIGGER)
6. CREATE TABLE group_invitations
7. INSERT IGNORE INTO user_academies (마이그레이션)
8. CREATE EVENT evt_expire_invitations
```

---

## Phase 2: 백엔드

### 2.1 인증 미들웨어 수정

**파일**: `backend/middleware/auth.js`

- `generateToken(userId, expiresIn, academyId, tokenVersion)` → academyId, tokenVersion 추가
- `verifyToken` → JWT academyId + token_version 검증

```javascript
// verifyToken 변경 (의사코드)
const decoded = jwt.verify(token, JWT_SECRET);
const [users] = await db.query(
  'SELECT id, email, name, role, academy_id, token_version, ... FROM users WHERE id = ?',
  [decoded.userId]
);

// v3: token_version 불일치 → 즉시 무효화 (추가 쿼리 없음, 기존 쿼리에 컬럼만 추가)
if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.token_version) {
  return res.status(401).json({ error: 'Token expired', message: '세션이 만료되었습니다. 다시 로그인해주세요.' });
}

// JWT에 academyId가 있으면 그대로 사용 (신뢰, 추가 쿼리 없음)
// JWT에 academyId가 없으면 기존대로 users.academy_id 사용
const activeAcademyId = decoded.academyId || user.academy_id;

req.user = {
  ...user,
  academyId: activeAcademyId,
  academy_id: activeAcademyId
};
```

> **성능**: 기존과 동일 (1 query/request). token_version은 이미 가져오는 users SELECT에 컬럼만 추가.
> **보안**: JWT 서명 + token_version 이중 검증. 권한 박탈 즉시 반영 가능.

### 2.2 신규 API 엔드포인트

**파일**: `backend/routes/auth.js`

| 엔드포인트 | 설명 |
|-----------|------|
| `GET /paca/auth/my-academies` | 내 지점 목록 실시간 조회 (프론트 갱신용) |
| `POST /paca/auth/switch-academy` | 지점 전환 (아래 상세) |

**파일**: `backend/routes/settings.js`

| 엔드포인트 | 설명 | 방어 로직 |
|-----------|------|----------|
| `POST /paca/settings/create-group` | 그룹 생성 | 기존 group_id 있으면 400 |
| `POST /paca/settings/create-branch` | 새 지점 생성 | 그룹 원장 자동 연결 (명시적 에러 처리) |
| `POST /paca/settings/invite-owner` | 원장 초대 | 중복 pending 초대 → 기존 재사용 |
| `GET /paca/settings/group-invitations` | 보낸 초대 목록 | |
| `DELETE /paca/settings/invitations/:id` | 초대 취소 | status → 'canceled' |
| `PUT /paca/settings/set-default-academy` | 기본 지점 변경 | Transaction 필수 |

**파일**: `backend/routes/invite.js` (신규)

| 엔드포인트 | 설명 | 보안 |
|-----------|------|------|
| `GET /paca/invite/:token` | 초대 정보 조회 | rate limit 10req/15min/IP, 이메일 마스킹 |
| `POST /paca/invite/:token/accept` | 초대 수락 (기존 계정) | 이메일 정규화 비교 필수 |
| `POST /paca/invite/:token/register` | 초대 수락 + 신규 가입 | **v3: 기존 원장 수동 승인 필요** |

### 2.3 switch-academy 상세 (v3 보강)

```javascript
// POST /paca/auth/switch-academy
// Request: { academyId: number }

// 1. user_academies 접근 권한 확인
const [access] = await db.query(
  `SELECT ua.role FROM user_academies ua
   JOIN academies a ON ua.academy_id = a.id
   WHERE ua.user_id = ? AND ua.academy_id = ?
     AND a.deleted_at IS NULL`,  // v3: 비활성 학원 차단
  [req.user.id, academyId]
);
if (access.length === 0) {
  return res.status(403).json({ error: 'Forbidden', message: '접근 권한이 없는 지점입니다.' });
}

// 2. 새 JWT 발급 (token_version 포함)
const token = generateToken(req.user.id, '24h', academyId, req.user.token_version);

// 3. users.academy_id UPDATE (P-EAK 하위호환)
await db.query('UPDATE users SET academy_id = ? WHERE id = ?', [academyId, req.user.id]);

// 4. v3: 응답 형식 (로그인과 일관성)
const [academy] = await db.query('SELECT id, name FROM academies WHERE id = ?', [academyId]);
res.json({
  token,
  user: {
    id: req.user.id,
    academyId,
    academy: academy[0]
  }
  // academies 목록은 미포함 (변경 없음, 프론트에 이미 있음)
});
```

### 2.4 로그인 응답 수정

**파일**: `backend/routes/auth.js` (기존 login 라우트)

```javascript
// 로그인 시 is_default 지점으로 접속
const [defaultAcademy] = await db.query(
  `SELECT ua.academy_id FROM user_academies ua
   WHERE ua.user_id = ? AND ua.is_default = 1`,
  [user.id]
);
const loginAcademyId = defaultAcademy[0]?.academy_id || user.academy_id;

// v3: JWT에 tokenVersion 포함
const token = generateToken(user.id, '24h', loginAcademyId, user.token_version);

// academies 목록 조회 (LIMIT 20으로 비현실적 시나리오 방지)
const [userAcademies] = await db.query(
  `SELECT ua.academy_id, a.name as academy_name, ua.role, ua.is_primary, ua.is_default
   FROM user_academies ua
   JOIN academies a ON ua.academy_id = a.id
   WHERE ua.user_id = ? AND a.deleted_at IS NULL
   ORDER BY ua.is_primary DESC, a.name ASC
   LIMIT 20`,
  [user.id]
);

// 그룹 정보
const [group] = user.group_id ? await db.query(
  `SELECT ag.id, ag.name FROM academy_groups ag WHERE ag.id = ? AND ag.deleted_at IS NULL`,
  [user.group_id]
) : [[]];
```

응답:

```json
{
  "token": "...(JWT에 academyId + tokenVersion 포함)...",
  "user": {
    "id": 1,
    "academyId": 5,
    "academy": { "id": 5, "name": "개성점" },
    "academies": [
      { "academy_id": 5, "academy_name": "개성점", "role": "owner", "is_primary": true, "is_default": true },
      { "academy_id": 6, "academy_name": "평양점", "role": "owner", "is_primary": false, "is_default": false },
      { "academy_id": 7, "academy_name": "워싱턴점", "role": "owner", "is_primary": false, "is_default": false }
    ],
    "group": { "id": 1, "name": "점프맥스 그룹" }
  }
}
```

> 단일지점 유저: `academies` 1개, `group` null → 기존과 동일 동작

### 2.5 초대 수락 상세 (v3 보강)

**이메일 정규화 + 비교 함수:**

```javascript
const normalizeEmail = (email) => email.toLowerCase().trim().normalize('NFC');

const emailsMatch = (a, b) => normalizeEmail(a) === normalizeEmail(b);
```

**`POST /paca/invite/:token/accept` (기존 계정):**

```javascript
// 1. token 유효성 + 만료일 확인
// 2. 이메일 정규화 비교 (v3)
if (!emailsMatch(req.user.email, invitation.invited_email)) {
  return res.status(403).json({
    error: 'Email Mismatch',
    message: '이 초대는 다른 이메일로 발송되었습니다.',
    invited_email: maskEmail(invitation.invited_email)
  });
}
// 3. 유저가 이미 다른 그룹에 속해있는지 확인
if (req.user.group_id && req.user.group_id !== invitation.group_id) {
  return res.status(400).json({
    error: 'Group Conflict',
    message: '이미 다른 그룹에 소속되어 있습니다.',
    action: '새 그룹에 참여하려면 기존 그룹을 먼저 탈퇴해야 합니다.'
  });
}
// v3: 기존 학원이 그룹 미소속인 경우 (다른 학원 운영 중)
if (req.user.academy_id) {
  const [currentAcademy] = await db.query(
    'SELECT group_id FROM academies WHERE id = ?', [req.user.academy_id]
  );
  if (currentAcademy[0]?.group_id === null && !req.user.group_id) {
    return res.status(400).json({
      error: 'Academy Conflict',
      message: '이미 다른 학원을 운영 중입니다.',
      action: '기존 학원을 그룹에 병합하려면 별도 절차가 필요합니다.'
    });
  }
}
// 4. Transaction 시작 (race condition 방지)
//    SELECT ... FOR UPDATE (invitation 잠금)
//    innodb_lock_wait_timeout = 10 (데드락 방지)
//    invitation.status !== 'pending' → 에러
// 5. user.group_id = invitation.group_id
// 6. 그룹 내 모든 지점 user_academies 연결
// 7. is_primary = primary_academy_id에 해당하는 지점
// 8. is_default = primary_academy_id에 해당하는 지점
// 9. invitation.status = 'accepted', accepted_at = NOW()
// 10. Transaction 커밋
```

**`POST /paca/invite/:token/register` (신규 가입) - v3 변경:**

```javascript
// 1. token 유효성 + 만료일 확인
// 2. 요청 이메일 정규화 비교 (v3)
if (!emailsMatch(req.body.email, invitation.invited_email)) {
  return res.status(403).json({ error: 'Email Mismatch', message: '초대 이메일과 일치하지 않습니다.' });
}
// 3. Transaction + SELECT FOR UPDATE
// 4. 유저 생성
//    v3 변경: approval_status = 'pending_invite' (자동 승인 아님!)
//    → 기존 원장에게 알림 → 수동 승인 후 활성화
// 5. 그룹 내 모든 지점 user_academies 연결
// 6. users.academy_id = primary_academy_id
// 7. invitation.status = 'accepted'
// 8. 응답: { message: '가입 완료. 기존 원장의 승인 후 이용 가능합니다.' }
//    → 승인 후 JWT 발급 (로그인 시)
```

> **v3 변경 이유**: 초대 토큰이 카카오톡으로 공유되므로 유출 가능성 존재.
> 토큰만으로 자동 승인 + 전 지점 데이터 접근은 위험.
> 기존 원장이 "이 사람 맞다"고 승인하는 단계 추가.

### 2.6 지점 추가 시 기존 원장 자동 연결 (v3 보강)

```javascript
// POST /paca/settings/create-branch
const groupId = currentAcademy.group_id;

// 같은 그룹의 모든 원장 조회
const [groupOwners] = await db.query(
  `SELECT DISTINCT ua.user_id
   FROM user_academies ua
   JOIN academies a ON ua.academy_id = a.id
   WHERE a.group_id = ? AND ua.role = 'owner'`,
  [groupId]
);

// v3: INSERT IGNORE 대신 명시적 에러 처리
const failedLinks = [];
for (const owner of groupOwners) {
  try {
    await db.query(
      `INSERT INTO user_academies (user_id, academy_id, role, is_primary, is_default)
       VALUES (?, ?, 'owner', 0, 0)`,
      [owner.user_id, newAcademyId]
    );
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') continue; // 이미 연결됨
    failedLinks.push({ userId: owner.user_id, error: error.message });
    console.error(`[create-branch] Failed to link owner ${owner.user_id}:`, error);
  }
}

if (failedLinks.length > 0) {
  console.warn(`[create-branch] ${failedLinks.length}명 연결 실패`, failedLinks);
  // 지점 생성은 성공, 연결 실패는 로깅만 (부분 실패 허용)
}
```

### 2.7 중복 초대 처리 (v3 신규)

```javascript
// POST /paca/settings/invite-owner
const normalizedEmail = normalizeEmail(req.body.email);

// v3: 같은 그룹 + 같은 이메일 + pending 초대 확인
const [existing] = await db.query(
  `SELECT id, token, expires_at FROM group_invitations
   WHERE group_id = ? AND invited_email = ? AND status = 'pending' AND expires_at > NOW()`,
  [groupId, normalizedEmail]
);

if (existing.length > 0) {
  // 기존 초대 재사용
  return res.json({
    message: '이미 초대가 발송되어 있습니다.',
    invitation: {
      inviteLink: `${FRONTEND_URL}/invite/${existing[0].token}`,
      expiresAt: existing[0].expires_at
    }
  });
}

// 신규 초대 생성...
```

### 2.8 set-default-academy Transaction (v3 신규)

```javascript
// PUT /paca/settings/set-default-academy
const connection = await db.getConnection();
try {
  await connection.beginTransaction();

  await connection.query(
    'UPDATE user_academies SET is_default = 0 WHERE user_id = ?',
    [req.user.id]
  );

  const [result] = await connection.query(
    'UPDATE user_academies SET is_default = 1 WHERE user_id = ? AND academy_id = ?',
    [req.user.id, req.body.academyId]
  );

  if (result.affectedRows === 0) {
    throw new Error('접근 권한이 없는 지점입니다.');
  }

  await connection.commit();
  res.json({ message: '기본 지점이 변경되었습니다.' });
} catch (error) {
  await connection.rollback();
  res.status(400).json({ error: 'Update Failed', message: error.message });
} finally {
  connection.release();
}
```

### 2.9 create-group 방어 로직 (v3 신규)

```javascript
// POST /paca/settings/create-group
if (req.user.group_id) {
  return res.status(400).json({
    error: 'Already in Group',
    message: '이미 그룹에 속해 있습니다.'
  });
}

const [academy] = await db.query(
  'SELECT group_id FROM academies WHERE id = ?',
  [req.user.academyId]
);
if (academy[0]?.group_id) {
  return res.status(400).json({
    error: 'Academy in Group',
    message: '현재 학원이 이미 다른 그룹에 속해 있습니다.'
  });
}
```

### 2.10 consolidated-dashboard 권한 (v3 신규)

```javascript
// GET /paca/reports/consolidated-dashboard
// v3: 반드시 서버에서 접근 가능한 지점 목록 결정 (클라이언트 입력 불허)
const [myAcademies] = await db.query(
  `SELECT a.id, a.name
   FROM user_academies ua
   JOIN academies a ON ua.academy_id = a.id
   WHERE ua.user_id = ? AND a.deleted_at IS NULL`,
  [req.user.id]
);

if (myAcademies.length < 2) {
  return res.status(403).json({ error: 'Insufficient', message: '2개 이상 지점이 필요합니다.' });
}

// 각 지점별 집계 (암호화 필드는 COUNT, SUM만 사용)
const stats = [];
for (const academy of myAcademies) {
  const [studentCount] = await db.query(
    `SELECT COUNT(*) as count FROM students WHERE academy_id = ? AND status = 'active'`,
    [academy.id]
  );
  // ... 매출, 미납 등 집계
  stats.push({ academy, students: studentCount[0].count, /* ... */ });
}
```

### 2.11 에러 응답 형식 표준화 (v3 신규)

기존 P-ACA API 패턴 유지:

```javascript
// 에러: 2필드 (기존 패턴)
{ error: 'Category', message: '상세 메시지' }

// 성공: message + data (기존 패턴)
{ message: '성공', data: { ... } }

// v3 추가: action 필드 (사용자 다음 단계 안내)
{ error: 'Group Conflict', message: '이미 다른 그룹에 소속', action: '기존 그룹 탈퇴 후 재시도' }
```

### 2.12 invite 라우트 rate limiting (v3 명시)

```javascript
// backend/paca.js
const inviteLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too Many Requests', message: '너무 많은 요청입니다. 잠시 후 다시 시도해주세요.' },
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/paca/invite', inviteLimiter);
```

### 2.13 Referrer-Policy (v3 신규)

```javascript
// next.config.js
headers: [
  {
    source: '/invite/:path*',
    headers: [
      { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' }
    ]
  }
]
```

---

## Phase 3: 프론트엔드

### 3.1 타입/API 추가

**파일**: `src/lib/api/auth.ts`

```typescript
export interface UserAcademy {
  academy_id: number;
  academy_name: string;
  role: string;
  is_primary: boolean;
  is_default: boolean;
}

export interface AcademyGroup {
  id: number;
  name: string;
}

// LoginResponse에 추가 (하위호환 처리)
academies?: UserAcademy[];   // 없으면 현재 academy 1개로 fallback
group?: AcademyGroup | null;
```

**하위호환**: 프론트 먼저 배포되어도 `academies`가 없으면 기존 `academy` 1개로 fallback:

```typescript
const academies = response.user.academies || [{
  academy_id: response.user.academyId,
  academy_name: response.user.academy?.name || '',
  role: response.user.role,
  is_primary: true,
  is_default: true
}];

if (!response.user.academies) {
  console.warn('[Fallback] 서버가 academies를 반환하지 않음');
}
```

### 3.2 지점 스위처 컴포넌트 (v3 대폭 변경)

**신규**: `src/components/layout/academy-switcher.tsx`

**v3 변경: SPA 전환 (전체 새로고침 제거)**

```typescript
const switchAcademy = async (academyId: number) => {
  try {
    const response = await authAPI.switchAcademy(academyId);

    // 1. 토큰 + 유저 정보 업데이트
    localStorage.setItem('token', response.token);
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    user.academyId = academyId;
    user.academy = response.user.academy;
    localStorage.setItem('user', JSON.stringify(user));

    // 2. React Query 캐시만 초기화 (정적 자산 유지)
    queryClient.invalidateQueries();

    // 3. API 캐시만 선택적 삭제 (v3)
    if ('caches' in window) {
      const cacheNames = await caches.keys();
      const apiCaches = cacheNames.filter(name =>
        name.includes('api-') || name.includes('data-') || name.includes('runtime')
      );
      await Promise.all(apiCaches.map(name => caches.delete(name)));
    }

    // 4. 전역 상태 업데이트 → 현재 페이지 유지
    setCurrentAcademy(response.user.academy);
    toast.success(`${response.user.academy.name}으로 전환되었습니다`);

    // 5. BroadcastChannel로 다른 탭에 알림 (v3)
    academyChannel.postMessage({ type: 'ACADEMY_SWITCHED', academyId });

  } catch (error) {
    if (error.response?.status === 403) {
      // v3: 권한 박탈된 경우 서버에서 최신 목록 갱신
      const fresh = await authAPI.getMyAcademies();
      // localStorage 업데이트 + 목록 갱신
      toast.error('이 지점에 대한 접근 권한이 없습니다.');
    }
  }
};
```

**조건**: `academies.length > 1` 일 때만 드롭다운 표시

**v3: 모바일 대응 (bottom sheet)**

```typescript
// 데스크탑: DropdownMenu
// 모바일: Sheet (bottom sheet)
const isMobile = useMediaQuery('(max-width: 768px)');

{isMobile ? (
  <Sheet>
    <SheetTrigger className="w-full h-14 px-4 flex items-center justify-between">
      <span>{currentAcademy.name}</span>
      <ChevronDown className="w-4 h-4" />
    </SheetTrigger>
    <SheetContent side="bottom">
      {academies.map(a => (
        <button key={a.academy_id}
          className="w-full h-14 text-left px-4 border-b"  // 56px 터치 영역
          onClick={() => switchAcademy(a.academy_id)}>
          {a.academy_name}
          {a.is_primary && <Badge variant="outline">메인</Badge>}
        </button>
      ))}
    </SheetContent>
  </Sheet>
) : (
  <DropdownMenu>...</DropdownMenu>
)}
```

**수정**: `src/components/layout/sidebar.tsx`
- 학원 이름 표시 부분을 `<AcademySwitcher />` 로 교체

### 3.3 현재 지점 항상 표시 (v3 신규)

**수정**: `src/components/layout/top-nav.tsx` 또는 헤더 영역

```typescript
// 멀티지점 유저에게 현재 지점 배지 표시
{academies.length > 1 && (
  <Badge variant="outline" className="flex items-center gap-1">
    <Building2 className="w-3 h-3" />
    {currentAcademy.name}
  </Badge>
)}
```

> 사이드바 collapsed 상태에서도 현재 지점이 보여야 함

### 3.4 통합 대시보드 페이지 (v3 보강)

**신규**: `src/app/reports/consolidated/page.tsx`

**v3 변경: alert 우선 표시 + 증감 포함**

```
┌─────────────────────────────────────────────────────┐
│ [!] 주의 필요                                        │
│ - 평양점: 이번 달 퇴원 5명 (전월 대비 +250%)         │
│ - 워싱턴점: 미납 금액 300만원 (30일 이상)             │
└─────────────────────────────────────────────────────┘

┌──────────┐ ┌──────────┐ ┌──────────┐
│ 총 학생수 │ │ 총 매출   │ │ 총 미납   │
│ 150명     │ │ 1,500만  │ │ 200만    │
│ ↑5 전월비 │ │ ↑12%     │ │ ↓3%     │
└──────────┘ └──────────┘ └──────────┘

┌─────────────────────────────────────────────────────┐
│ 지점명    │ 재원생      │ 매출         │ 미납       │
│ 개성점    │ 50명 ↑3    │ 500만 ↑12%  │ 50만 ↓10% │
│ 평양점    │ 60명 ↓2    │ 600만 ↑8%   │ 100만 ↑5% │
│ 워싱턴점  │ 40명 ±0    │ 400만 ↑15%  │ 50만 ↓20% │
└─────────────────────────────────────────────────────┘
```

- owner만 접근 가능, 2개 이상 지점 필요
- **v3**: 접근 권한 변경 시 `/`로 리다이렉트 + toast 안내
- **암호화 필드**: 집계에만 사용 (COUNT, SUM), 개인정보 직접 노출 안 함
- **v3**: 데이터는 서버에서 user_academies 기반 조회 (클라이언트 academyId 입력 불허)

### 3.5 지점 관리 페이지 (v3 용어 변경)

**신규**: `src/app/settings/branches/page.tsx` (설정 페이지와 분리)

**v3 변경: "그룹" 용어 제거, 자연스러운 표현으로**

```
┌─────────────────────────────────────────────────────┐
│ 여러 지점 관리하기                                   │
│                                                     │
│ 본점, 분점을 하나의 계정으로 관리하고                 │
│ 다른 원장님과 공동 운영할 수 있습니다                 │
│                                                     │
│ [지점 추가하기]                                      │
└─────────────────────────────────────────────────────┘

(그룹 생성 후)
┌─────────────────────────────────────────────────────┐
│ 점프맥스 (3개 지점)                                  │
│                                                     │
│ ● 개성점 (메인) [전환] [기본 지점으로 설정]           │
│ ○ 평양점        [전환]                              │
│ ○ 워싱턴점      [전환]                              │
│                                                     │
│ [+ 새 지점 추가]  [원장 초대]                        │
│                                                     │
│ ─── 보낸 초대 ───                                   │
│ park@example.com  원장  대기중  [취소]               │
│ lee@example.com   원장  수락됨                      │
└─────────────────────────────────────────────────────┘
```

- "새 지점 추가" 모달: 지점명, 주소, 전화번호, "본점 설정 복사" 체크박스
- 사이드바 드롭다운 하단에도 "지점 관리" 링크 추가 (1클릭 접근)

### 3.6 원장 초대 모달

```
┌─────────────────────────────────────────┐
│  원장 초대                               │
│                                         │
│  이메일: [park@example.com        ]     │
│  권한:   (●) 원장(전체 권한)             │
│          ( ) 관리자(운영 권한)            │
│                                         │
│  [초대 링크 생성]                        │
├─────────────────────────────────────────┤
│  초대 링크가 생성되었습니다               │
│  https://paca.chejump.com/invite/abc123 │
│  유효기간: 7일                           │
│                                         │
│  [링크 복사]  [카카오톡 공유]             │
└─────────────────────────────────────────┘
```

### 3.7 초대 수락 페이지 (v3 간소화)

**신규**: `src/app/invite/[token]/page.tsx`

**v3 변경: 3단계 → 2단계로 간소화 (메인 지점 pre-select)**

```
Step 1: 초대 정보 + 로그인/가입 통합 화면
┌─────────────────────────────────────────┐
│  점프맥스에 초대되었습니다                │
│  초대자: 원장A                           │
│  지점: 개성점, 평양점, 워싱턴점 (3곳)    │
│  권한: 원장                              │
│                                         │
│  메인 담당 지점: [개성점 v] (추천)       │  ← Step3을 Step1로 이동
│                                         │
│  ━━━ 기존 계정으로 참여 ━━━             │
│  이메일: [p***@example.com] (고정)      │
│  비밀번호: [            ]               │
│  [로그인하여 참여]                       │
│                                         │
│  ━━━ 또는 새로 가입 ━━━                 │
│  [새 계정으로 가입하기 >]                │
└─────────────────────────────────────────┘

Step 2 (새로 가입 선택 시만):
┌─────────────────────────────────────────┐
│  이름: [            ]                    │
│  이메일: [p***@example.com] (고정)      │
│  전화번호: [            ]                │
│  비밀번호: [            ]                │
│  [가입 신청하기]                         │
│                                         │
│  * 기존 원장의 승인 후 이용 가능합니다    │
└─────────────────────────────────────────┘
```

**v3 변경점:**
- Step3(메인 지점 선택)을 Step1에 통합 → 클릭 2회로 완료
- 초대 시 `primary_academy_id` 지정되어 있으면 pre-select
- 신규 가입은 "승인 필요" 안내 표시

**에러 상태 (v3 보강: 다음 단계 명시):**

```typescript
// 만료
{ title: '초대 링크가 만료되었습니다',
  detail: '7일이 지나 링크가 만료되었습니다.',
  action: '원장님에게 새 초대를 요청하세요.' }

// 이미 수락
{ title: '이미 수락된 초대입니다',
  detail: '이 초대는 이미 수락되었습니다.',
  action: '로그인하여 이용하세요.',
  loginButton: true }

// 다른 그룹 소속
{ title: '참여할 수 없습니다',
  detail: '이미 "서울점프 그룹"에 소속되어 있습니다.',
  action: '새 그룹에 참여하려면 기존 그룹을 먼저 탈퇴해야 합니다.' }

// 기존 학원 운영 중
{ title: '참여할 수 없습니다',
  detail: '이미 다른 학원을 운영 중입니다.',
  action: '기존 학원을 그룹에 병합하려면 설정 > 지점 관리에서 진행하세요.' }

// 이메일 불일치
{ title: '다른 이메일로 초대됨',
  detail: 'p***@example.com으로 발송된 초대입니다.',
  action: '해당 이메일 계정으로 로그인해주세요.' }
```

### 3.8 로그인 페이지

**수정**: `src/app/login/page.tsx`
- localStorage에 `academies`, `group` 저장 (하위호환 fallback 포함)

### 3.9 탭 간 동기화 (v3 대폭 변경)

**수정**: `src/components/layout/layout-wrapper.tsx`

**v3 변경: BroadcastChannel + 미저장 변경 보호**

```typescript
// BroadcastChannel API (storage 이벤트보다 빠르고 안정적)
const academyChannel = new BroadcastChannel('paca_academy_switch');

useEffect(() => {
  academyChannel.onmessage = (event) => {
    if (event.data.type === 'ACADEMY_SWITCHED') {
      const hasUnsavedChanges = document.querySelector('[data-unsaved="true"]');

      if (hasUnsavedChanges) {
        // 미저장 변경이 있으면 확인 모달
        setShowSyncDialog(true);
      } else {
        // 즉시 갱신 (지연 없음)
        window.location.reload();
      }
    }
  };

  return () => academyChannel.close();
}, []);

// 확인 모달
<AlertDialog open={showSyncDialog}>
  <AlertDialogContent>
    <AlertDialogHeader>
      <AlertDialogTitle>다른 탭에서 지점이 전환되었습니다</AlertDialogTitle>
      <AlertDialogDescription>
        저장하지 않은 내용이 있습니다. 지금 새로고침하시겠습니까?
      </AlertDialogDescription>
    </AlertDialogHeader>
    <AlertDialogFooter>
      <AlertDialogCancel onClick={() => {
        setShowSyncDialog(false);
        // 다음 페이지 이동 시 자동 reload
        sessionStorage.setItem('pending_reload', 'true');
      }}>나중에</AlertDialogCancel>
      <AlertDialogAction onClick={() => window.location.reload()}>
        지금 새로고침
      </AlertDialogAction>
    </AlertDialogFooter>
  </AlertDialogContent>
</AlertDialog>
```

### 3.10 오프라인 방어 (v3 신규)

```typescript
// 지점 전환 시 네트워크 확인
const switchAcademy = async (academyId: number) => {
  if (!navigator.onLine) {
    toast.error('지점 전환은 인터넷 연결이 필요합니다.');
    return;
  }
  // ...
};
```

---

## Phase 4: 원장 온보딩 플로우

### 최초 원장 (그룹 생성자)

```
1. P-ACA 일반 가입 (기존 그대로)
   → 원장A 계정 + "개성점" 학원 생성

2. 설정 > 지점 관리 > "여러 지점 관리하기"
   → 그룹명 입력 ("점프맥스")                     ← v3: "그룹 만들기" → "여러 지점 관리하기"
   → academy_groups 생성
   → 개성점에 group_id 연결
   → 원장A에 group_id 연결

3. 지점 관리 > "새 지점 추가"
   → "평양점", "워싱턴점" 생성 → 같은 group_id
   → 원장A의 user_academies에 자동 연결
   → 그룹 내 다른 원장이 있으면 자동 연결

4. 지점 관리 > "원장 초대"
   → 원장B 이메일 입력 → 초대 링크 생성 → 카톡으로 공유
   → 원장C 이메일 입력 → 초대 링크 생성 → 카톡으로 공유
```

### 초대받은 원장 (B, C)

```
1. 카톡으로 초대 링크 받음

2-A. 이미 P-ACA 계정 있는 경우:
   → 초대 페이지에서 메인 지점 선택 + 로그인 (이메일 정규화 비교)
   → 그룹 합류 + 전 지점 user_academies 연결
   → 대시보드로 이동

2-B. 계정 없는 경우:
   → 초대 페이지에서 메인 지점 선택 + 가입 (초대 이메일 고정)
   → v3: 가입 완료 → 기존 원장에게 승인 알림 발송
   → 기존 원장이 승인 → 계정 활성화 + 그룹 합류
   → 승인 후 로그인 → 대시보드로 이동
```

---

## Phase 5: P-EAK (피크) 연동

### 현재 연동 구조

```
P-EAK 로그인 → P-ACA users 테이블 직접 조회 (DB, HTTP 아님)
P-EAK 학생  → P-ACA students에서 동기화 (bulk upsert)
P-EAK JWT   → { userId } - P-ACA 기준, JWT_SECRET 동일
P-EAK DB    → 별도 `peak` DB, 같은 MySQL 서버
P-EAK Socket.IO → academy별 room 분리
```

### 멀티지점 시 P-EAK 변경

**P-EAK `verifyToken`** (`~/ilsanmaxtraining/backend/middleware/auth.js`) 수정:

```javascript
// v3: JWT에 academyId가 있으면 그대로 사용 (P-ACA와 동일 로직)
const decoded = jwt.verify(token, JWT_SECRET);
const [users] = await pacaPool.query('SELECT ... token_version ... WHERE id = ?', [decoded.userId]);

// v3: token_version 검증 (P-ACA와 동일)
if (decoded.tokenVersion !== undefined && decoded.tokenVersion !== user.token_version) {
  return res.status(401).json({ error: 'Token expired' });
}

const activeAcademyId = decoded.academyId || user.academy_id;
req.user = { ...user, academyId: activeAcademyId };
```

> JWT를 신뢰하는 방식이라 P-EAK에서도 `user_academies` 조회 불필요. 추가 쿼리 없음.
> token_version만 기존 users SELECT에 컬럼 추가.

**P-EAK 로그인** (`~/ilsanmaxtraining/backend/routes/auth.js`):
- academies 목록 반환 추가 (P-ACA 로그인과 동일)

**P-EAK Socket.IO** (`~/ilsanmaxtraining/backend/peak.js`):
- v3: P-ACA에서 지점 전환 시 P-EAK 프론트가 socket disconnect → reconnect
- P-EAK 프론트에 storage/BroadcastChannel 리스너 추가

**P-EAK 헤더**:
- v3 최소: 현재 지점명 읽기 전용 표시
- v3 권장: P-ACA와 동일한 지점 스위처

### P-EAK 수정 파일

- `~/ilsanmaxtraining/backend/middleware/auth.js` - JWT academyId + tokenVersion 사용
- `~/ilsanmaxtraining/backend/routes/auth.js` - 로그인 응답에 academies 추가
- `~/ilsanmaxtraining/frontend` - socket 재연결 + 지점명 표시

### P-EAK 배포 순서

```
1. P-ACA 백엔드 배포 (JWT에 academyId + tokenVersion 추가)
2. P-ACA 프론트 배포
3. P-EAK 백엔드 배포 (1시간 이내)
   - 중간 상태: P-EAK verifyToken이 decoded.academyId 무시 → users.academy_id 사용 → 문제 없음
4. P-EAK 프론트 배포
```

---

## 보안 경고 (v3 신규)

### JWT_SECRET 하드코딩 제거 필수

P-EAK에 다음 코드가 있음 (`~/ilsanmaxtraining/backend/routes/auth.js`):
```javascript
// 위험! 소스코드 유출 시 JWT 위조 가능
const JWT_SECRET = process.env.JWT_SECRET || 'jeong-paca-secret';
const password = process.env.PACA_DB_PASSWORD || 'q141171616!';
```

**조치 필요**:
1. 폴백 값 제거 → 환경변수 필수화
2. 현재 운영에서 해당 폴백값이 실제 사용되는지 확인
3. 사용 중이면 즉시 시크릿 변경

### N8N API Key 주의

`backend/middleware/auth.js`에서 N8N 인증 시:
```javascript
const academyId = req.query.academy_id || req.body.academy_id || null;
```
N8N API Key 유출 시 임의의 academyId로 모든 학원 데이터 접근 가능. 키 보안 수준이 JWT_SECRET과 동등.

---

## 알려진 리스크 & 대응 (v3 업데이트)

### 심각

| 문제 | 대응 |
|------|------|
| 서비스워커 캐시 교차 노출 | v3: API 캐시만 선택적 삭제 + React Query invalidate |
| 초대 링크 보안 | `crypto.randomBytes(32)` + rate limit + 이메일 정규화 비교 + Referrer-Policy |
| 초대 수락 race condition | Transaction + SELECT FOR UPDATE + innodb_lock_wait_timeout=10 |
| 초대 토큰 유출 시 무단 가입 | v3: 신규 가입은 기존 원장 수동 승인 필요 |
| JWT_SECRET 하드코딩 | v3: 환경변수 필수화, 폴백 제거 |

### 중요

| 문제 | 대응 |
|------|------|
| 권한 박탈 24h 지연 | v3: token_version으로 즉시 무효화 가능 |
| 권한이 유저 단위 | 1차: owner만 멀티지점, staff 멀티지점은 추후 |
| P-EAK Socket.IO room 불일치 | v3: 전환 시 socket disconnect → reconnect |
| 탭 간 지점 불일치 | v3: BroadcastChannel + 미저장 변경 보호 |
| 로그인 응답 하위호환 | 프론트에서 academies 없으면 기존 academy 1개로 fallback |
| 그룹 삭제 시 일관성 | soft delete + ON DELETE RESTRICT |
| 비활성 학원 전환 | v3: switch-academy에서 deleted_at IS NULL 체크 |
| localStorage stale 데이터 | v3: 403 에러 시 서버에서 최신 목록 자동 갱신 |
| 이메일 대소문자 문제 | v3: 저장/비교 모두 toLowerCase().trim().normalize('NFC') |
| is_primary/is_default 무결성 | v3: TRIGGER로 DB 레벨 강제 |
| 중복 초대 | v3: 기존 pending 초대 재사용 |
| 기존 학원 운영 중 초대 수락 | v3: "학원 그룹 병합" 별도 경로 안내 |
| 통합 대시보드 권한 | v3: 서버에서 user_academies 기반 조회 (클라이언트 입력 불허) |

### 보통

| 문제 | 대응 |
|------|------|
| PWA 앱 이름 혼란 | 앱 내 splash screen에 현재 지점 표시 |
| 새 지점 초기 데이터 | "본점 설정 복사" 체크박스 제공 |
| 만료 초대 정리 | v3: MySQL Event Scheduler 1시간마다 |
| "그룹" 용어 이해도 | v3: "여러 지점 관리하기"로 변경 |
| 초대 링크 Referrer 노출 | v3: strict-origin-when-cross-origin |
| 오프라인 전환 | v3: navigator.onLine 체크 |
| N8N 알림 중복 | academy 단위 설정이라 문제 없음 |

---

## 수정 파일 목록

### P-ACA 백엔드

| 파일 | 변경 내용 |
|------|----------|
| `backend/middleware/auth.js` | generateToken (academyId, tokenVersion), verifyToken (token_version 비교) |
| `backend/routes/auth.js` | 로그인 응답 수정 + switch-academy + my-academies |
| `backend/routes/settings.js` | create-group (방어로직), create-branch (명시적 에러), invite-owner (중복처리), set-default-academy (Transaction) |
| `backend/routes/invite.js` | **신규** 초대 수락/가입 (rate limiting, 이메일 정규화, 수동 승인) |
| `backend/routes/reports.js` | consolidated-dashboard (서버사이드 권한) |
| `backend/paca.js` | invite 라우트 등록 + rate limiter |

### P-ACA 프론트엔드

| 파일 | 변경 내용 |
|------|----------|
| `src/lib/api/auth.ts` | 타입, switchAcademy, getMyAcademies (하위호환 fallback) |
| `src/lib/api/settings.ts` | createGroup, createBranch, inviteOwner 등 |
| `src/lib/api/dashboard.ts` | getConsolidatedStats |
| `src/components/layout/academy-switcher.tsx` | **신규** SPA 전환 + 선택적 캐시삭제 + 모바일 bottom sheet |
| `src/components/layout/sidebar.tsx` | 학원 이름 → AcademySwitcher 교체 |
| `src/components/layout/layout-wrapper.tsx` | BroadcastChannel 탭 동기화 + 미저장 보호 |
| `src/components/layout/top-nav.tsx` | 현재 지점 배지 표시 |
| `src/app/reports/consolidated/page.tsx` | **신규** 통합 대시보드 (alert + 증감) |
| `src/app/settings/branches/page.tsx` | **신규** 지점 관리 (용어 변경) |
| `src/app/invite/[token]/page.tsx` | **신규** 초대 수락/가입 (2단계 간소화) |
| `src/app/login/page.tsx` | academies, group 저장 (하위호환) |
| `next.config.js` | Referrer-Policy 헤더 |

### P-EAK

| 파일 | 변경 내용 |
|------|----------|
| `~/ilsanmaxtraining/backend/middleware/auth.js` | JWT academyId + tokenVersion 사용 |
| `~/ilsanmaxtraining/backend/routes/auth.js` | 로그인 응답에 academies 추가 + **JWT_SECRET 하드코딩 제거** |
| `~/ilsanmaxtraining/frontend` | socket 재연결 + 지점명 표시 |

### 데이터베이스

| 항목 | 내용 |
|------|------|
| 신규 테이블 | `academy_groups`, `user_academies`, `group_invitations` |
| 수정 테이블 | `academies` (+group_id), `users` (+group_id, +token_version) |
| TRIGGER | is_primary/is_default 무결성 (INSERT/UPDATE) |
| EVENT | 만료 초대 1시간마다 자동 처리 |
| 마이그레이션 | 기존 user-academy 관계 복사 (멱등, INSERT IGNORE) |

### 버전 (PWA 필수)
- P-ACA: `package.json`, `version-checker.tsx`, `sidebar.tsx`, `settings/page.tsx`
- P-EAK: 해당 버전 파일들

---

## 구현 순서

```
0단계: 보안 사전 조치
  → P-EAK JWT_SECRET/DB 비번 하드코딩 제거
  → rate limiting 미들웨어 준비
  → crypto, email 정규화 유틸 작성

1단계: DB
  → 테이블 생성 (순서 준수 1.11절)
  → TRIGGER 생성
  → EVENT 생성
  → 마이그레이션

2단계: 백엔드 코어
  → auth 미들웨어 (generateToken + verifyToken + token_version)
  → switch-academy (비활성 학원 차단)
  → my-academies
  → 로그인 응답 수정

3단계: 백엔드 그룹
  → create-group (방어 로직)
  → create-branch (명시적 에러 처리)
  → invite API (중복 처리, 이메일 정규화, 수동 승인)
  → set-default-academy (Transaction)
  → consolidated-dashboard (서버사이드 권한)

4단계: 프론트 코어
  → 타입/API 추가 (하위호환 fallback)
  → 지점 스위처 (SPA 전환 + 선택적 캐시 + 모바일 bottom sheet)
  → 현재 지점 배지 (TopNav)
  → BroadcastChannel 탭 동기화

5단계: 프론트 관리
  → /settings/branches (용어 변경)
  → 통합 대시보드 (alert + 증감)

6단계: 프론트 초대
  → 초대 생성 UI
  → 초대 수락 페이지 (2단계 간소화, 수동 승인 안내)
  → Referrer-Policy 설정

7단계: P-EAK
  → verifyToken (academyId + tokenVersion)
  → 로그인 응답 수정
  → 프론트 socket 재연결 + 지점명 표시

8단계: 테스트
  → 아래 검증 항목
```

---

## 검증 방법

### 기본 동작
1. 기존 단일지점 원장 로그인 → 기존과 동일한 UI/동작 확인
2. staff 계정 로그인 → 멀티지점 UI 미표시 확인
3. 프론트만 먼저 배포 → academies 없어도 정상 동작 (하위호환)

### 멀티지점
4. 그룹 생성 + 지점 추가 → 정상 생성 + 그룹 원장 자동 연결 확인
5. 사이드바 지점 스위처 → SPA 전환 시 데이터 변경 + 페이지 유지 확인
6. 통합 대시보드 → 전 지점 합산 + alert + 증감 표시 확인
7. 탭 2개에서 다른 지점 → 각각 독립 동작 확인
8. 다른 탭에서 전환 → BroadcastChannel + 미저장 보호 확인
9. v3: 현재 지점 배지 → TopNav에 항상 표시 확인
10. v3: 모바일 → bottom sheet 지점 선택 확인

### 원장 초대
11. 초대 링크 생성 → 유효한 링크 (64자 hex) 확인
12. 기존 계정으로 수락 → 이메일 정규화 비교 + 그룹 합류 확인
13. 다른 이메일로 수락 시도 → 403 + 마스킹된 이메일 표시 확인
14. 대소문자 다른 이메일 → 정규화 후 일치 확인
15. 신규 가입으로 수락 → v3: pending_invite 상태 + 기존 원장 승인 후 활성화 확인
16. 만료 링크 → 에러 + 다음 단계 안내 확인
17. 이미 다른 그룹 소속 → 차단 + 탈퇴 안내 확인
18. 기존 학원 운영 중 → 차단 + 병합 안내 확인
19. 동시에 2명 수락 시도 → 1명만 성공 확인 (SELECT FOR UPDATE)
20. v3: 같은 이메일 중복 초대 → 기존 초대 재사용 확인
21. v3: 초대 취소 → status = 'canceled' 확인

### 보안
22. rate limiting → 11번째 요청 429 확인
23. JWT academyId 위조 불가 확인 (서명 검증)
24. v3: token_version 변경 후 기존 JWT → 401 확인
25. v3: 비활성 학원으로 전환 시도 → 403 확인
26. v3: 통합 대시보드 academyId 조작 → 서버에서 무시 확인
27. v3: Referrer-Policy 헤더 확인

### P-EAK
28. P-EAK 로그인 → 현재 활성 지점 기준 정상 작동 확인
29. P-ACA에서 전환 → P-EAK 재접속 시 반영 확인
30. v3: P-EAK token_version 검증 확인
31. v3: P-ACA 지점 전환 후 P-EAK Socket.IO 재연결 확인

### 캐시/PWA
32. 지점 전환 후 → API 캐시만 삭제 + 정적 자산 유지 확인
33. PWA 앱에서 전환 → 정상 동작 확인
34. v3: 오프라인 상태에서 전환 시도 → 에러 메시지 확인

### DB 무결성
35. v3: is_primary=1 2개 설정 시도 → TRIGGER가 기존 것 0으로 변경 확인
36. v3: is_default=1 2개 설정 시도 → TRIGGER가 기존 것 0으로 변경 확인
37. v3: academy_groups DELETE 시도 → RESTRICT로 차단 확인

---

## 향후 확장 (추후 구현)

| 기능 | 설명 |
|------|------|
| 동업자 세부 권한 | 동업자별 재무 열람 범위 설정 (매출만/급여포함 등) |
| staff 멀티지점 | 강사/직원이 여러 지점에 소속 (user_academies ENUM 확장) |
| 기존 학원 연결 | 이미 운영 중인 별도 학원을 그룹에 합류 (소유권 이전) |
| 지점별 알림 설정 | 유저가 지점별로 알림 on/off |
| 지점 간 학생 이동 | A지점 학생을 B지점으로 전학 처리 |
| 지점 전환 감사 로그 | 누가 언제 어디서 전환했는지 기록 |
| 통합 대시보드 차트 | 지점별 재원생 추이 (line chart), 매출 비율 (pie chart) |
| 지점별 테마 색상 | 각 지점 고유 색상으로 구분 (5개 이상 지점에 유용) |
| 지점 간 비교 모드 | split view로 2개 지점 동시 표시 |
