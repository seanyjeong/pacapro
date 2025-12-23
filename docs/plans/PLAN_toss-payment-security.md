# Implementation Plan: 토스 결제 보안 최적화

**Status**: ⏳ Pending
**Started**: 2025-12-23
**Last Updated**: 2025-12-23

---

**⚠️ CRITICAL INSTRUCTIONS**: After completing each phase:
1. ✅ Check off completed task checkboxes
2. 🧪 Run all quality gate validation commands
3. ⚠️ Verify ALL quality gate items pass
4. 📅 Update "Last Updated" date above
5. 📝 Document learnings in Notes section
6. ➡️ Only then proceed to next phase

⛔ **DO NOT skip quality gates or proceed with failing checks**

---

## 📋 Overview

### Feature Description
토스 결제 콜백 API의 보안 취약점을 수정합니다:
1. **콜백 서명/타임스탬프 미검증**: 서명 헤더 없으면 그냥 통과 → 강제 검증
2. **학원 ID 기본값 문제**: `academyId || 1` → 신뢰 가능한 소스에서 추출
3. **비밀키 평문 저장**: 평문 저장/비교 → 암호화/해시 적용
4. **대기열 API 학원 스코프 없음**: checkAcademyAccess 추가

### Success Criteria
- [ ] 서명 또는 타임스탬프 없는 콜백 요청 거부
- [ ] 환경변수 미설정 시 서버 기동 실패
- [ ] 비밀키 DB 저장 시 암호화 적용
- [ ] 모든 대기열 API에 학원 스코프 검증 추가
- [ ] 기존 정상 결제 흐름 유지

### User Impact
- 외부 공격자의 위조 결제 콜백 차단
- 멀티테넌시 환경에서 학원 간 데이터 격리 강화
- 비밀키 유출 시 피해 최소화

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| 서명 필수화 + Shared Secret 헤더 추가 | 이중 검증으로 보안 강화 | 토스 프론트 플러그인 업데이트 필요 |
| orderId에서 학원 ID 추출 | 메타데이터 조작 방지, DB 조회로 검증 | 추가 DB 조회 오버헤드 |
| 비밀키 AES 암호화 (기존 유틸 활용) | 해시보다 복호화 가능하여 운영 유연성 | 암호화 키 관리 필요 |
| checkAcademyAccess 미들웨어 추가 | 일관된 보안 패턴 유지 | 코드 변경 최소화 |

---

## 📦 Dependencies

### Required Before Starting
- [ ] 현재 토스 연동이 정상 동작하는지 확인
- [ ] 환경변수 설정 가능한지 확인 (TOSS_PLUGIN_API_KEY, TOSS_CALLBACK_SECRET)

### External Dependencies
- 기존 encryption.js 유틸리티 활용
- 기존 auth.js 미들웨어 활용

### ⚠️ 제약사항
- **기존 DB 스키마 변경 불가**: 새 컬럼 추가만 가능
- **기존 API 시그니처 유지**: 하위 호환성 필수

---

## 🚀 Implementation Phases

### Phase 1: 콜백 서명/타임스탬프 강제 검증
**Goal**: 서명 또는 타임스탬프 없는 요청 즉시 거부
**Status**: ⏳ Pending

#### 현재 문제 (toss.js:88-138)
```javascript
// 현재: 서명 없으면 그냥 통과
if (signature && academyId) {
    // 검증...
}
next(); // 서명 없어도 통과!
```

#### Tasks

**Task 1.1**: verifyCallbackSignature 미들웨어 강화
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] 타임스탬프 필수화 (없으면 403 반환)
  - [ ] 타임스탬프 만료 시 거부 (현재는 경고만)
  - [ ] 서명 필수화 (서명 없으면 403 반환)
  - [ ] Shared Secret 헤더 추가 검증 (`X-Toss-Callback-Secret`)

**Task 1.2**: 환경변수 필수화
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] `TOSS_CALLBACK_SECRET` 환경변수 추가
  - [ ] 환경변수 없으면 서버 기동 시 에러 (개발 환경 예외)

#### 예상 코드
```javascript
const verifyCallbackSignature = async (req, res, next) => {
    const signature = req.headers['x-toss-signature'];
    const timestamp = req.headers['x-toss-timestamp'];
    const callbackSecret = req.headers['x-toss-callback-secret'];

    // 1. 타임스탬프 필수 검증
    if (!timestamp) {
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '타임스탬프가 필요합니다.'
        });
    }

    // 2. 타임스탬프 만료 검증
    const requestTime = parseInt(timestamp);
    const now = Date.now();
    if (Math.abs(now - requestTime) > CALLBACK_TIMESTAMP_TOLERANCE) {
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '타임스탬프가 만료되었습니다.'
        });
    }

    // 3. Shared Secret 검증
    if (!callbackSecret || callbackSecret !== TOSS_CALLBACK_SECRET) {
        return res.status(403).json({
            success: false,
            error: 'Forbidden',
            message: '콜백 시크릿이 유효하지 않습니다.'
        });
    }

    // 4. 서명 검증 (선택적 - 학원별 설정 있을 때)
    // ... 기존 서명 검증 로직 ...

    next();
};
```

#### Quality Gate ✋
- [ ] 서명 없는 콜백 요청 → 403 반환 확인
- [ ] 타임스탬프 없는 요청 → 403 반환 확인
- [ ] 만료된 타임스탬프 → 403 반환 확인
- [ ] 잘못된 Shared Secret → 403 반환 확인
- [ ] 정상 요청 → 처리 성공 확인
- [ ] 서버 재시작 후 정상 동작 확인

---

### Phase 2: 학원 ID 기본값 제거
**Goal**: 메타데이터 조작으로 다른 학원에 결제 누적 불가
**Status**: ⏳ Pending

#### 현재 문제 (toss.js:329, 536)
```javascript
// 현재: 메타데이터 없으면 무조건 academy 1
const academyId = metadata?.academyId || 1;
```

#### Tasks

**Task 2.1**: orderId에서 학원 ID 추출 로직 추가
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] 주문번호 형식 변경: `PACA-{academy_id}-{payment_id}-{timestamp}`
  - [ ] orderId 파싱으로 학원 ID 추출
  - [ ] student_payments 테이블과 교차 검증

**Task 2.2**: 기본값 1 제거
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] payment-callback에서 기본값 제거
  - [ ] cancel-callback에서 기본값 제거
  - [ ] 학원 ID 추출 실패 시 대기열에 추가 (수동 확인)

#### 예상 코드
```javascript
// 주문번호 파싱: PACA-{academy_id}-{payment_id}-{timestamp}
const orderIdMatch = orderId.match(/^PACA-(\d+)-(\d+)-(\d+)$/);

if (!orderIdMatch) {
    // 대기열 추가 (수동 확인 필요)
    await connection.query(
        `INSERT INTO toss_payment_queue (..., error_reason) VALUES (..., ?)`,
        ['주문번호 형식 불일치 - 학원 ID 확인 불가']
    );
    return res.json({ success: true, matched: false, queueReason: 'ORDER_ID_FORMAT' });
}

const academyIdFromOrder = parseInt(orderIdMatch[1]);
const paymentId = parseInt(orderIdMatch[2]);

// DB에서 결제 레코드 조회 (학원 ID 교차 검증)
const [existingPayment] = await connection.query(
    `SELECT * FROM student_payments WHERE id = ? AND academy_id = ?`,
    [paymentId, academyIdFromOrder]
);

if (existingPayment.length === 0) {
    // 대기열 추가 (학원 ID 불일치 또는 결제 없음)
    // ...
}
```

#### Quality Gate ✋
- [ ] 새 주문번호 형식으로 결제 생성/처리 성공
- [ ] 구 형식 주문번호 → 대기열 추가 확인
- [ ] 학원 ID 조작된 메타데이터 → 거부 확인
- [ ] 정상 결제 흐름 유지

---

### Phase 3: 비밀키 암호화/해시 처리
**Goal**: 비밀키 평문 저장 제거, 환경변수 필수화
**Status**: ⏳ Pending

#### 현재 문제 (toss.js:23, 1096-1133)
```javascript
// 현재: 환경변수 없으면 알려진 기본값 사용
const TOSS_PLUGIN_API_KEY = process.env.TOSS_PLUGIN_API_KEY || 'paca-toss-plugin-key-2024';

// DB에 평문 저장
await db.query('INSERT INTO toss_settings (..., plugin_api_key, callback_secret) VALUES (..., ?, ?)', [plugin_api_key, callback_secret]);
```

#### Tasks

**Task 3.1**: 환경변수 필수화
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] `TOSS_PLUGIN_API_KEY` 환경변수 필수
  - [ ] 환경변수 없으면 서버 시작 시 에러 로그 + 기능 비활성화
  - [ ] 개발 환경(`NODE_ENV=development`)에서만 기본값 허용

**Task 3.2**: 비밀키 암호화 저장
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] toss_settings 저장 시 encrypt() 적용
  - [ ] toss_settings 조회 시 decrypt() 적용
  - [ ] 기존 평문 데이터 마이그레이션 (별도 스크립트)

**Task 3.3**: 비밀키 비교 로직 수정
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] verifyTossPlugin에서 복호화 후 비교
  - [ ] verifyCallbackSignature에서 복호화 후 서명 검증

#### 예상 코드
```javascript
// 서버 시작 시 환경변수 검증
const TOSS_PLUGIN_API_KEY = process.env.TOSS_PLUGIN_API_KEY;
const NODE_ENV = process.env.NODE_ENV || 'production';

if (!TOSS_PLUGIN_API_KEY) {
    if (NODE_ENV === 'production') {
        console.error('[FATAL] TOSS_PLUGIN_API_KEY is required in production');
        // 토스 라우터 비활성화 또는 서버 시작 거부
    } else {
        console.warn('[WARN] Using default TOSS_PLUGIN_API_KEY in development');
        TOSS_PLUGIN_API_KEY = 'dev-only-key';
    }
}

// 저장 시 암호화
await db.query(
    `INSERT INTO toss_settings (..., plugin_api_key, callback_secret) VALUES (..., ?, ?)`,
    [encrypt(plugin_api_key), encrypt(callback_secret)]
);

// 비교 시 복호화
const decryptedApiKey = decrypt(settings[0].plugin_api_key);
if (apiKey === decryptedApiKey) {
    // 인증 성공
}
```

#### Quality Gate ✋
- [ ] 환경변수 없이 프로덕션 시작 → 에러 로그 확인
- [ ] 개발 환경에서 기본값으로 동작 확인
- [ ] 새 비밀키 저장 → 암호화 확인 (DB에서 ENC: 접두사)
- [ ] 암호화된 비밀키로 인증 성공 확인
- [ ] 기존 평문 비밀키 마이그레이션 스크립트 동작

---

### Phase 4: 대기열 API 학원 스코프 추가
**Goal**: 다른 학원의 대기열 항목 조작 불가
**Status**: ⏳ Pending

#### 현재 문제 (toss.js:943-975)
```javascript
// 현재: checkAcademyAccess 미들웨어 없음
router.post('/queue/:id/ignore', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    // ID만 보고 업데이트 - 다른 학원 것도 가능!
    await db.query('UPDATE toss_payment_queue SET match_status = ? WHERE id = ?', ['ignored', queueId]);
});
```

#### Tasks

**Task 4.1**: checkAcademyAccess 미들웨어 추가
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] `/queue/:id/ignore` 라우트에 checkAcademyAccess 추가
  - [ ] 쿼리에 academy_id 조건 추가

**Task 4.2**: 학원 소속 검증 로직 추가
- File: `backend/routes/toss.js`
- 변경사항:
  - [ ] 대기열 항목 조회 시 학원 ID 검증
  - [ ] 다른 학원 항목 접근 시 403 반환

#### 예상 코드
```javascript
router.post('/queue/:id/ignore', verifyToken, checkPermission('payments', 'edit'), checkAcademyAccess, async (req, res) => {
    try {
        const queueId = parseInt(req.params.id);
        const academyId = req.user.academy_id;
        const { reason } = req.body;

        // 학원 소속 검증
        const [queueItem] = await db.query(
            'SELECT * FROM toss_payment_queue WHERE id = ? AND academy_id = ?',
            [queueId, academyId]
        );

        if (queueItem.length === 0) {
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: '대기열 항목을 찾을 수 없습니다.'
            });
        }

        await db.query(
            `UPDATE toss_payment_queue SET
                match_status = 'ignored',
                error_reason = ?,
                matched_by = ?,
                matched_at = NOW()
            WHERE id = ? AND academy_id = ?`,
            [reason || '관리자 무시 처리', req.user.id, queueId, academyId]
        );

        res.json({ success: true, message: '무시 처리 완료' });
    } catch (error) {
        // ...
    }
});
```

#### Quality Gate ✋
- [ ] 자기 학원 대기열 → 정상 처리
- [ ] 다른 학원 대기열 → 404 반환 확인
- [ ] queue/match API도 동일하게 보호 확인

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation Strategy |
|------|-------------|--------|---------------------|
| 기존 토스 플러그인 호환성 문제 | Medium | High | 점진적 배포, 롤백 준비 |
| 기존 주문번호 형식 변경 | Low | Medium | 구 형식도 대기열 처리로 폴백 |
| 암호화 키 분실 시 비밀키 복구 불가 | Low | High | 키 백업, 재발급 절차 문서화 |
| 콜백 URL 변경 필요 시 | Low | Medium | 토스 프론트 설정 업데이트 안내 |

---

## 🔄 Rollback Strategy

### If Phase 1 Fails
- `verifyCallbackSignature` 원복
- 환경변수 필수화 조건 제거

### If Phase 2 Fails
- orderId 파싱 로직 원복
- 기본값 1 복원 (임시)

### If Phase 3 Fails
- 암호화 저장 로직 원복
- 기존 평문 데이터 유지

### If Phase 4 Fails
- checkAcademyAccess 제거
- 기존 쿼리 복원

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1**: ⏳ 0%
- **Phase 2**: ⏳ 0%
- **Phase 3**: ⏳ 0%
- **Phase 4**: ⏳ 0%

**Overall Progress**: 0% complete

---

## 📝 Notes & Learnings

### Implementation Notes
- (작업 중 추가)

### Improvements for Future Plans
- (완료 후 추가)

---

## 📚 References

### 관련 파일
- `backend/routes/toss.js` - 토스 결제 라우터
- `backend/utils/encryption.js` - 암호화 유틸리티
- `backend/middleware/auth.js` - 인증 미들웨어

### 관련 테이블
- `toss_settings` - 학원별 토스 설정
- `toss_payment_history` - 결제 이력
- `toss_payment_queue` - 수동 매칭 대기열

---

## ✅ Final Checklist

**Before marking plan as COMPLETE**:
- [ ] All phases completed with quality gates passed
- [ ] 기존 결제 흐름 정상 동작 확인
- [ ] 보안 취약점 모두 해결 확인
- [ ] 환경변수 설정 문서 업데이트
- [ ] CLAUDE.md 버전 정보 업데이트

---

**Plan Status**: ⏳ Pending
**Next Action**: Phase 1 시작 (콜백 서명/타임스탬프 강제 검증)
**Blocked By**: 사용자 승인
