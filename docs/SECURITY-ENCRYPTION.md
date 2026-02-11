# P-ACA 데이터 암호화

> **상태**: Phase 1 완료 ✅ (2025-12-12)
> **최종 업데이트**: 2026-02-11

---

## 현재 구현 (Phase 1)

### 암호화 방식
- **알고리즘**: AES-256-GCM
- **키 저장**: 서버 ENV (`DATA_ENCRYPTION_KEY`)
- **데이터 형식**: `ENC:base64(iv + authTag + encrypted)`

### 암호화 대상

| 테이블 | 필드 |
|--------|------|
| students | name, phone, parent_phone, address |
| instructors | name, phone, address, resident_number, account_number, account_holder |
| consultations | student_name, student_phone, parent_name, parent_phone, notes |
| users | name, phone |

### 주요 파일

| 파일 | 설명 |
|------|------|
| `utils/encryption.js` | 암호화/복호화 함수 |
| `scripts/migrate-encrypt-data.js` | 기존 데이터 마이그레이션 |
| `.env` | DATA_ENCRYPTION_KEY |

### 동작 방식
1. **저장 시**: API에서 `encrypt()` 호출 → DB에 `ENC:...` 저장
2. **조회 시**: DB에서 조회 → `decrypt()` 호출 → 평문 반환
3. **이미 암호화된 데이터**: `ENC:` 접두사로 판별, 중복 암호화 방지

---

## 암호화 제외 항목

- **금액 데이터**: SUM, AVG 등 DB 집계 필요
- **대안**: API 권한으로 owner/admin만 조회 가능

---

## 향후 계획 (미구현)

| Phase | 내용 | 시기 |
|-------|------|------|
| Phase 2 | 학원별 개별 암호화 키 | 유료화 시 |
| Phase 3 | Zero-Knowledge (클라이언트 암호화) | 확장 시 |

---

## 마이그레이션 실행

```bash
# Dry-run (미리보기)
node scripts/migrate-encrypt-data.js --dry-run

# 실제 실행
node scripts/migrate-encrypt-data.js
```
