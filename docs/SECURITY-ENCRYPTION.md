# P-ACA 데이터 암호화 설계 문서

> **상태**: 계획 단계 (미구현)
> **작성일**: 2025-12-06
> **목적**: 다중 학원 사용 시 개인정보 보호

---

## 현재 상태

- 모든 데이터 **암호화 없이** DB에 저장
- admin (개발자)이 모든 학원 데이터 열람 가능
- `academy_id`로 학원 구분하지만 DB 접근 시 제한 없음

---

## 문제점

1. **개발자 접근**: DB 직접 접근 시 모든 학원 민감 정보 열람 가능
2. **신뢰 문제**: "개발자가 내 데이터 본다" = 사용자 불신
3. **법적 이슈**: 개인정보보호법 위반 가능성
4. **해킹 시**: DB 털리면 전체 데이터 유출

---

## 암호화 방식 비교

### 1. 서버 환경변수에 키 저장 (쉬움, 보안 낮음)

```javascript
// .env
ENCRYPTION_KEY=my-secret-key-123

// 암호화
const encrypted = encrypt(data, process.env.ENCRYPTION_KEY);
```

| 장점 | 단점 |
|------|------|
| 구현 쉬움 | 개발자가 키 볼 수 있음 |
| DB 털려도 복호화 어려움 | 키 하나 털리면 전체 유출 |

**결론**: DB 해킹은 막지만, 개발자 접근은 못 막음

---

### 2. 학원별 암호화 키 (중간, 보안 중간)

```javascript
// 각 학원마다 다른 키
academy_1_key = "abc123..."
academy_2_key = "xyz789..."

// 학원 A 데이터는 학원 A 키로만 복호화
```

| 장점 | 단점 |
|------|------|
| 하나 털려도 다른 학원 안전 | 키 관리 복잡 |
| 학원별 분리 | 개발자가 서버에서 키 볼 수 있음 |

**결론**: 부분적 보안, 개발자 접근은 여전히 가능

---

### 3. 사용자 비밀번호 기반 키 (어려움, 보안 높음) ⭐ 추천

```javascript
// 사용자 비밀번호로 키 생성 (PBKDF2)
const key = pbkdf2(password, salt, 100000, 256, 'sha256');

// 이 키로 데이터 암호화
const encrypted = encrypt(data, key);

// 서버에는 암호화된 데이터만 저장
// 키는 어디에도 저장 안 됨!
```

| 장점 | 단점 |
|------|------|
| 개발자도 못 봄 (Zero-knowledge) | 구현 복잡 |
| 진짜 End-to-End 암호화 | 비밀번호 잃으면 데이터 복구 불가 |

---

## 추천 구조: 마스터 키 + 래핑 키

```
┌─────────────────────────────────────────────────────────────┐
│                        가입 시                               │
├─────────────────────────────────────────────────────────────┤
│  1. 마스터 키 랜덤 생성 (256bit)                             │
│     → 이 키로 모든 민감 데이터 암호화                        │
│                                                              │
│  2. 사용자 비밀번호 → PBKDF2 → 래핑 키 생성                  │
│     → 래핑 키로 마스터 키 암호화 → DB 저장                   │
│                                                              │
│  3. 복구 키 생성 (12단어 니모닉)                             │
│     → 복구 키로 마스터 키 암호화 → DB 저장                   │
│     → 복구 키는 사용자에게만 보여줌 (저장 안 함)             │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                       로그인 시                              │
├─────────────────────────────────────────────────────────────┤
│  1. 비밀번호 입력                                            │
│  2. PBKDF2 → 래핑 키 생성                                    │
│  3. 래핑 키로 마스터 키 복호화                               │
│  4. 마스터 키로 데이터 복호화                                │
│  5. 마스터 키는 메모리에만 (세션 동안)                       │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    비밀번호 변경 시                          │
├─────────────────────────────────────────────────────────────┤
│  1. 기존 비밀번호로 마스터 키 복호화                         │
│  2. 새 비밀번호로 래핑 키 생성                               │
│  3. 새 래핑 키로 마스터 키 다시 암호화                       │
│  4. 데이터는 그대로 (마스터 키 안 바뀜)                      │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│                    비밀번호 분실 시                          │
├─────────────────────────────────────────────────────────────┤
│  1. 복구 키 (12단어) 입력                                    │
│  2. 복구 키로 마스터 키 복호화                               │
│  3. 새 비밀번호로 래핑 키 생성                               │
│  4. 새 래핑 키로 마스터 키 다시 암호화                       │
│                                                              │
│  ⚠️ 복구 키도 잃어버리면 → 데이터 복구 불가                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 암호화 대상 필드

| 테이블 | 필드 | 민감도 |
|--------|------|--------|
| students | name, phone, parent_phone, address | 높음 |
| instructors | name, phone, address | 높음 |
| payments | - | 낮음 (금액은 분석 필요) |
| consultations | notes | 중간 |

---

## DB 스키마 변경

```sql
-- 암호화 키 저장 테이블
CREATE TABLE academy_keys (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    wrapped_master_key TEXT NOT NULL,      -- 비밀번호로 암호화된 마스터 키
    wrapped_recovery_key TEXT NOT NULL,    -- 복구 키로 암호화된 마스터 키
    salt VARCHAR(64) NOT NULL,             -- PBKDF2 salt
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (academy_id) REFERENCES academies(id)
);

-- 기존 테이블 변경
ALTER TABLE students
    MODIFY name VARCHAR(255),      -- 암호화된 데이터는 길어짐
    MODIFY phone VARCHAR(255),
    MODIFY parent_phone VARCHAR(255);
```

---

## 구현 코드 예시

### 키 생성 (가입 시)

```javascript
const crypto = require('crypto');

// 마스터 키 생성
function generateMasterKey() {
    return crypto.randomBytes(32); // 256bit
}

// 비밀번호로 래핑 키 생성
function deriveWrappingKey(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 100000, 32, 'sha256');
}

// 마스터 키 암호화 (래핑)
function wrapMasterKey(masterKey, wrappingKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', wrappingKey, iv);
    const encrypted = Buffer.concat([cipher.update(masterKey), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// 마스터 키 복호화
function unwrapMasterKey(wrappedKey, wrappingKey) {
    const data = Buffer.from(wrappedKey, 'base64');
    const iv = data.slice(0, 16);
    const authTag = data.slice(16, 32);
    const encrypted = data.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', wrappingKey, iv);
    decipher.setAuthTag(authTag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]);
}
```

### 데이터 암호화/복호화

```javascript
// 데이터 암호화
function encryptField(data, masterKey) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', masterKey, iv);
    const encrypted = Buffer.concat([cipher.update(data, 'utf8'), cipher.final()]);
    const authTag = cipher.getAuthTag();
    return Buffer.concat([iv, authTag, encrypted]).toString('base64');
}

// 데이터 복호화
function decryptField(encryptedData, masterKey) {
    const data = Buffer.from(encryptedData, 'base64');
    const iv = data.slice(0, 16);
    const authTag = data.slice(16, 32);
    const encrypted = data.slice(32);
    const decipher = crypto.createDecipheriv('aes-256-gcm', masterKey, iv);
    decipher.setAuthTag(authTag);
    return decipher.update(encrypted) + decipher.final('utf8');
}
```

### 복구 키 생성 (BIP39 니모닉)

```javascript
const bip39 = require('bip39');

// 복구 키 생성 (12단어)
function generateRecoveryPhrase() {
    return bip39.generateMnemonic(128); // 12 words
}

// 복구 키 → 래핑 키
function recoveryPhraseToKey(phrase) {
    const seed = bip39.mnemonicToSeedSync(phrase);
    return seed.slice(0, 32); // 256bit
}
```

---

## 대기업 해킹 사례 & 교훈

| 회사 | 년도 | 원인 | 교훈 |
|------|------|------|------|
| 야놀자 | 2023 | 직원 계정 탈취 | 접근 권한 관리 필요 |
| 인터파크 | 2016 | 직원 PC 해킹 | 네트워크 분리 필요 |
| 빗썸 | 2019 | 악성코드 | 엔드포인트 보안 |
| 알라딘 | 2023 | 취약점 공격 | 보안 패치 |

**공통점:**
- 암호화 안 했거나 키 관리 허술
- 내부자/직원 PC 경로가 많음
- DB 직접 접근 가능했음

---

## 구현 우선순위

### Phase 1: 기본 암호화 (당장)
- [ ] 민감 필드 암호화 (이름, 전화번호)
- [ ] 서버 환경변수에 암호화 키 저장
- [ ] 기존 데이터 마이그레이션

### Phase 2: 학원별 키 (유료화 시)
- [ ] 학원별 마스터 키 생성
- [ ] 비밀번호 기반 키 래핑
- [ ] 복구 키 발급

### Phase 3: Zero-Knowledge (확장 시)
- [ ] 클라이언트 사이드 암호화
- [ ] 복구 키 니모닉 (12단어)
- [ ] 감사 로그

---

## 참고 자료

- [Node.js Crypto 문서](https://nodejs.org/api/crypto.html)
- [PBKDF2 표준](https://tools.ietf.org/html/rfc2898)
- [AES-GCM 암호화](https://en.wikipedia.org/wiki/Galois/Counter_Mode)
- [BIP39 니모닉](https://github.com/bitcoin/bips/blob/master/bip-0039.mediawiki)

---

## 비용 비교

| 방법 | 월 비용 | 비고 |
|------|---------|------|
| 직접 구현 (AES-256) | 무료 | 추천 |
| AWS KMS | $1/키 + API 호출 | 감사 로그 있음 |
| HashiCorp Vault Free | 무료 | 25개 시크릿 제한 |
| HashiCorp Vault Standard | $0.50/시크릿/월 | |
| Infisical | 무료 200개 | Vault 대안 |

**P-ACA 규모**: 직접 구현이 가장 적합
