# Implementation Plan: P-ACA 보안 및 성능 종합 최적화

**Status**: ✅ Complete
**Started**: 2025-12-23
**Last Updated**: 2025-12-23
**Completed**: 2025-12-23

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
P-ACA 백엔드 전체 코드베이스의 보안 취약점 및 성능 문제를 종합적으로 해결합니다.

### 발견된 문제 요약

| 심각도 | 개수 | 주요 내용 |
|--------|------|-----------|
| **Critical** | 3 | 환경변수 기본값 (DB, 암호화키, JWT) |
| **High** | 8 | CORS, N+1 쿼리, 에러 핸들링, 토스 보안 |
| **Medium** | 8 | 레이트리미팅, 캐싱, 로깅, 트랜잭션 |
| **Low** | 5 | 코드 일관성, 입력 검증 |

### Success Criteria
- [ ] 모든 Critical/High 보안 취약점 해결
- [ ] 환경변수 없이 프로덕션 시작 불가
- [ ] 검색/스케줄 API 응답시간 50% 개선
- [ ] 기존 기능 100% 정상 동작

### ⚠️ 제약사항
- **기존 DB 스키마 변경 불가**: 새 컬럼/테이블 추가만 가능
- **하위 호환성 필수**: 기존 API 시그니처 유지

---

## 🏗️ Architecture Decisions

| Decision | Rationale | Trade-offs |
|----------|-----------|------------|
| 환경변수 필수화 + 시작 시 검증 | 보안 설정 누락 방지 | 배포 시 .env 필수 |
| CORS origin 화이트리스트 | CSRF/XSS 방지 | 새 도메인 추가 시 코드 수정 |
| Redis 캐싱 도입 | 반복 조회 최적화 | 인프라 복잡도 증가 |
| 배치 INSERT 적용 | N+1 쿼리 제거 | 코드 복잡도 증가 |

---

## 🚀 Implementation Phases

---

### Phase 1: Critical 환경변수 보안
**Goal**: 모든 하드코딩된 시크릿 제거, 환경변수 필수화
**Status**: ⏳ Pending

#### 현재 문제

| 파일 | 라인 | 문제 |
|------|------|------|
| `config/database.js` | 12 | `password: 'q141171616!'` 기본값 |
| `utils/encryption.js` | 9 | `'paca-default-encryption-key-32b!'` 기본값 |
| `middleware/auth.js` | 8 | `'jeong-paca-secret'` JWT 기본값 |
| `middleware/auth.js` | 9 | `'paca-n8n-api-key-2024'` N8N 기본값 |
| `routes/toss.js` | 23 | `'paca-toss-plugin-key-2024'` 기본값 |

#### Tasks

**Task 1.1**: 환경변수 검증 유틸리티 생성
- File: `backend/utils/env-validator.js` (신규)
- [ ] 필수 환경변수 목록 정의
- [ ] 서버 시작 시 검증 함수
- [ ] 개발 환경에서만 기본값 허용

```javascript
// backend/utils/env-validator.js
const REQUIRED_ENV = [
    'DB_PASSWORD',
    'DATA_ENCRYPTION_KEY',
    'JWT_SECRET',
    'N8N_API_KEY'
];

function validateEnv() {
    const missing = [];
    const isDev = process.env.NODE_ENV === 'development';

    for (const key of REQUIRED_ENV) {
        if (!process.env[key]) {
            if (isDev) {
                console.warn(`[ENV] Missing ${key} - using dev default`);
            } else {
                missing.push(key);
            }
        }
    }

    if (missing.length > 0) {
        console.error('[FATAL] Missing required env vars:', missing.join(', '));
        process.exit(1);
    }
}

module.exports = { validateEnv, REQUIRED_ENV };
```

**Task 1.2**: database.js 수정
- File: `backend/config/database.js`
- [ ] 기본값 제거
- [ ] 환경변수 필수화

```javascript
// Before
password: process.env.DB_PASSWORD || 'q141171616!',

// After
password: process.env.DB_PASSWORD,
```

**Task 1.3**: encryption.js 수정
- File: `backend/utils/encryption.js`
- [ ] 기본값 제거
- [ ] 개발 환경 예외 처리

```javascript
// Before
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY || 'paca-default-encryption-key-32b!';

// After
const ENCRYPTION_KEY = process.env.DATA_ENCRYPTION_KEY;
if (!ENCRYPTION_KEY && process.env.NODE_ENV !== 'development') {
    throw new Error('[FATAL] DATA_ENCRYPTION_KEY is required');
}
```

**Task 1.4**: auth.js 수정
- File: `backend/middleware/auth.js`
- [ ] JWT_SECRET 기본값 제거
- [ ] N8N_API_KEY 기본값 제거

**Task 1.5**: toss.js 수정
- File: `backend/routes/toss.js`
- [ ] TOSS_PLUGIN_API_KEY 기본값 제거

**Task 1.6**: paca.js에서 검증 호출
- File: `backend/paca.js`
- [ ] 서버 시작 전 validateEnv() 호출

**Task 1.7**: .env.example 업데이트
- File: `backend/.env.example`
- [ ] 모든 필수 환경변수 문서화

#### Quality Gate ✋
```bash
# 환경변수 없이 시작 시도 → 실패 확인
NODE_ENV=production node backend/paca.js
# Expected: [FATAL] Missing required env vars: ... 후 종료

# 개발 환경에서 기본값으로 시작 확인
NODE_ENV=development node backend/paca.js
# Expected: 경고 출력 후 정상 시작

# 전체 환경변수 설정 후 정상 시작
source .env && node backend/paca.js
# Expected: 정상 시작
```

- [ ] 프로덕션 환경변수 누락 시 시작 실패
- [ ] 개발 환경에서 기본값 동작
- [ ] 기존 API 정상 동작 확인

---

### Phase 2: CORS 및 레이트 리미팅
**Goal**: 외부 공격 방어 기본 설정
**Status**: ⏳ Pending

#### 현재 문제

| 파일 | 라인 | 문제 |
|------|------|------|
| `paca.js` | 27 | `origin: '*'` 모든 도메인 허용 |
| `paca.js` | 58 | 레이트 리미팅 비활성화 |

#### Tasks

**Task 2.1**: CORS origin 화이트리스트
- File: `backend/paca.js`
- [ ] 허용 도메인 목록 정의
- [ ] 환경변수로 추가 도메인 허용

```javascript
// Before
const corsOptions = {
    origin: '*',
    credentials: false,
};

// After
const ALLOWED_ORIGINS = [
    'https://pacapro.vercel.app',
    'https://chejump.com',
    'https://dev.sean8320.dedyn.io',
    process.env.CORS_ORIGIN // 추가 도메인 (옵션)
].filter(Boolean);

const corsOptions = {
    origin: (origin, callback) => {
        // 서버-서버 요청 (origin 없음) 또는 화이트리스트
        if (!origin || ALLOWED_ORIGINS.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error('CORS not allowed'));
        }
    },
    credentials: true,
};
```

**Task 2.2**: 공개 API 레이트 리미팅
- File: `backend/paca.js`
- [ ] `/paca/public` 경로에 레이트 리미팅 적용
- [ ] 로그인 API에 레이트 리미팅 적용

```javascript
const rateLimit = require('express-rate-limit');

// 공개 API: 15분에 20회
const publicLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    message: { error: 'Too Many Requests', message: '잠시 후 다시 시도해주세요.' }
});

// 로그인: 15분에 5회
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Too Many Requests', message: '로그인 시도 횟수 초과' }
});

app.use('/paca/public', publicLimiter);
app.use('/paca/auth/login', loginLimiter);
```

#### Quality Gate ✋
```bash
# CORS 테스트 - 허용된 origin
curl -H "Origin: https://pacapro.vercel.app" http://localhost:8320/paca/health
# Expected: 정상 응답

# CORS 테스트 - 차단된 origin
curl -H "Origin: https://evil.com" http://localhost:8320/paca/health
# Expected: CORS 에러

# 레이트 리미팅 테스트
for i in {1..25}; do curl http://localhost:8320/paca/public/academy/test; done
# Expected: 20번째 이후 429 응답
```

- [ ] 허용 도메인에서 API 정상 호출
- [ ] 미허용 도메인 차단 확인
- [ ] 레이트 리미팅 동작 확인
- [ ] 프론트엔드 정상 동작 확인

---

### Phase 3: 에러 핸들링 강화
**Goal**: Silent failure 제거, Graceful shutdown 구현
**Status**: ⏳ Pending

#### 현재 문제

| 파일 | 라인 | 문제 |
|------|------|------|
| `encryption.js` | 50-53 | 암호화 실패 시 평문 반환 |
| `database.js` | 24-32 | DB 연결 실패 시 즉시 종료 |

#### Tasks

**Task 3.1**: 암호화 실패 시 throw
- File: `backend/utils/encryption.js`
- [ ] encrypt() 실패 시 예외 발생
- [ ] decrypt() 실패 시 예외 발생 (평문 폴백 제거)

```javascript
// Before
catch (error) {
    console.error('Encryption error:', error);
    return plaintext; // 평문 반환! (보안 위험)
}

// After
catch (error) {
    console.error('[CRITICAL] Encryption failed:', error.message);
    throw new Error('Encryption failed - operation aborted');
}
```

**Task 3.2**: DB 연결 재시도 로직
- File: `backend/config/database.js`
- [ ] 최대 3회 재시도
- [ ] 재시도 간격 5초

```javascript
async function connectWithRetry(maxRetries = 3) {
    for (let i = 0; i < maxRetries; i++) {
        try {
            const connection = await pool.getConnection();
            await connection.query("SET time_zone = '+09:00'");
            connection.release();
            console.log('[DB] Connected successfully');
            return;
        } catch (err) {
            console.error(`[DB] Connection failed (attempt ${i + 1}/${maxRetries}):`, err.message);
            if (i < maxRetries - 1) {
                await new Promise(r => setTimeout(r, 5000));
            }
        }
    }
    console.error('[FATAL] DB connection failed after retries');
    process.exit(1);
}
```

**Task 3.3**: Graceful shutdown
- File: `backend/paca.js`
- [ ] SIGTERM/SIGINT 핸들링
- [ ] 진행 중인 요청 완료 대기

```javascript
const server = app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});

process.on('SIGTERM', gracefulShutdown);
process.on('SIGINT', gracefulShutdown);

async function gracefulShutdown(signal) {
    console.log(`[${signal}] Graceful shutdown initiated`);

    server.close(() => {
        console.log('HTTP server closed');
    });

    await pool.end();
    console.log('DB pool closed');

    process.exit(0);
}
```

**Task 3.4**: 라우터에서 암호화 에러 처리
- Files: `backend/routes/*.js`
- [ ] try-catch로 암호화 에러 캐치
- [ ] 500 에러 반환

#### Quality Gate ✋
```bash
# 암호화 실패 테스트 (임시로 키 변경)
DATA_ENCRYPTION_KEY=wrong node -e "require('./backend/utils/encryption').encrypt('test')"
# Expected: 예외 발생

# Graceful shutdown 테스트
node backend/paca.js &
PID=$!
sleep 2
kill -SIGTERM $PID
# Expected: "Graceful shutdown initiated" 로그
```

- [ ] 암호화 실패 시 500 에러 반환
- [ ] DB 재연결 시도 확인
- [ ] Graceful shutdown 동작

---

### Phase 4: N+1 쿼리 최적화
**Goal**: 검색/스케줄 API 성능 50% 개선
**Status**: ⏳ Pending

#### 현재 문제

| 파일 | 라인 | 문제 | 영향 |
|------|------|------|------|
| `search.js` | 32-46 | 전체 데이터 메모리 로드 | 10,000명 시 10,000 복호화 |
| `students.js` | 40-75 | 매일마다 3-4개 쿼리 | 30일 × 3 = 90개 쿼리 |
| `schedules.js` | 48-54 | 서브쿼리 2개/row | 100개 × 2 = 200개 서브쿼리 |

#### Tasks

**Task 4.1**: 검색 API 최적화
- File: `backend/routes/search.js`
- [ ] LIMIT 추가 (최대 500)
- [ ] 인덱스 활용 (academy_id, deleted_at)

```javascript
// Before
const [allStudents] = await db.query(
    `SELECT * FROM students WHERE academy_id = ? AND deleted_at IS NULL`,
    [academyId]
);

// After
const [allStudents] = await db.query(
    `SELECT id, name, student_number, phone, parent_phone, school, status
    FROM students
    WHERE academy_id = ? AND deleted_at IS NULL
    LIMIT 500`,
    [academyId]
);
```

**Task 4.2**: 스케줄 배정 배치 처리
- File: `backend/routes/students.js`
- [ ] 배치 INSERT 사용
- [ ] ON DUPLICATE KEY UPDATE

```javascript
// Before: 루프 안에서 개별 INSERT
for (let day = enrollDay; day <= lastDay; day++) {
    await dbConn.query('INSERT INTO class_schedules...');
    await dbConn.query('INSERT INTO attendance...');
}

// After: 배치 INSERT
const scheduleValues = [];
const attendanceValues = [];

for (let day = enrollDay; day <= lastDay; day++) {
    scheduleValues.push([academyId, dateStr, timeSlot, instructorId]);
    // ...
}

await dbConn.query(
    `INSERT INTO class_schedules (academy_id, class_date, time_slot, instructor_id)
     VALUES ?
     ON DUPLICATE KEY UPDATE id=id`,
    [scheduleValues]
);
```

**Task 4.3**: 스케줄 조회 서브쿼리 → JOIN
- File: `backend/routes/schedules.js`
- [ ] 서브쿼리를 LEFT JOIN으로 변경

```sql
-- Before: 서브쿼리
SELECT cs.*,
    (SELECT COUNT(*) FROM attendance WHERE class_schedule_id = cs.id) AS student_count

-- After: LEFT JOIN
SELECT cs.*, COALESCE(ac.cnt, 0) AS student_count
FROM class_schedules cs
LEFT JOIN (
    SELECT class_schedule_id, COUNT(*) as cnt
    FROM attendance
    GROUP BY class_schedule_id
) ac ON cs.id = ac.class_schedule_id
```

#### Quality Gate ✋
```bash
# 응답 시간 측정 (Before/After)
time curl "http://localhost:8320/paca/search?q=test"
time curl "http://localhost:8320/paca/schedules?year=2025&month=12"

# Expected: 50% 이상 개선
```

- [ ] 검색 API 응답시간 측정
- [ ] 스케줄 API 응답시간 측정
- [ ] 기존 기능 정상 동작

---

### Phase 5: 토스 결제 보안
**Goal**: 결제 콜백 보안 강화, 학원 스코프 검증
**Status**: ⏳ Pending

#### 현재 문제 (이전 분석 내용)

| 문제 | 위치 | 심각도 |
|------|------|--------|
| 콜백 서명 미검증 | toss.js:88-138 | High |
| 학원 ID 기본값 1 | toss.js:329 | High |
| 비밀키 평문 저장 | toss.js:1096 | Medium |
| 대기열 학원 스코프 없음 | toss.js:947 | Medium |

#### Tasks

**Task 5.1**: 콜백 서명/타임스탬프 강제
- File: `backend/routes/toss.js`
- [ ] 타임스탬프 필수화
- [ ] Shared Secret 헤더 추가

**Task 5.2**: 학원 ID 기본값 제거
- File: `backend/routes/toss.js`
- [ ] orderId에서 학원 ID 추출
- [ ] DB 교차 검증

**Task 5.3**: 비밀키 암호화 저장
- File: `backend/routes/toss.js`
- [ ] encrypt() 적용
- [ ] 비교 시 decrypt() 적용

**Task 5.4**: 대기열 학원 스코프
- File: `backend/routes/toss.js`
- [ ] checkAcademyAccess 추가
- [ ] 쿼리에 academy_id 조건

#### Quality Gate ✋
- [ ] 서명 없는 콜백 → 403
- [ ] 학원 ID 조작 → 거부
- [ ] 다른 학원 대기열 접근 → 404

---

### Phase 6: 공개 API 보안 강화
**Goal**: 민감정보 노출 차단
**Status**: ⏳ Pending

#### 현재 문제

| 파일 | 라인 | 문제 |
|------|------|------|
| `public.js` | 310-316 | 전화번호로 학생 매칭 시 이름 노출 |
| `public.js` | 377 | 응답에 student_name 포함 |

#### Tasks

**Task 6.1**: 학생 매칭 응답에서 민감정보 제거
- File: `backend/routes/public.js`
- [ ] 응답에서 name 제거
- [ ] student_id만 반환

**Task 6.2**: 전화번호 해시 매칭 (선택적)
- [ ] 전화번호 해시 컬럼 추가 검토
- [ ] 해시로 매칭 (평문 비교 제거)

#### Quality Gate ✋
```bash
# 상담 신청 테스트
curl -X POST http://localhost:8320/paca/public/consultation/apply \
    -H "Content-Type: application/json" \
    -d '{"academy_slug":"test","student_name":"홍길동","contact_phone":"01012345678"}'

# Expected: 응답에 student_name 없음
```

---

## ⚠️ Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| 환경변수 누락으로 서버 미시작 | Medium | High | .env.example 상세 문서화, CI/CD 검증 |
| CORS 변경으로 프론트 장애 | Medium | High | 점진적 배포, origin 화이트리스트 확인 |
| 암호화 에러로 API 실패 | Low | Medium | try-catch로 적절한 에러 응답 |
| 배치 쿼리 성능 저하 | Low | Low | 배치 크기 제한 (500개) |

---

## 🔄 Rollback Strategy

### Phase 1 실패 시
- env-validator.js 호출 제거
- 기본값 복원 (임시)

### Phase 2 실패 시
- CORS origin: '*' 복원
- 레이트 리미터 제거

### Phase 3 실패 시
- 암호화 에러 시 평문 반환 복원 (임시)
- gracefulShutdown 제거

### Phase 4 실패 시
- 기존 쿼리 복원
- 배치 INSERT 제거

---

## 📊 Progress Tracking

### Completion Status
- **Phase 1**: ✅ 100% - 환경변수 보안 (기본값 제거, env-validator.js)
- **Phase 2**: ✅ 100% - CORS/레이트리미팅 (환경별 분리, 공개API 제한)
- **Phase 3**: ✅ 100% - 에러 핸들링 (DB 재연결, Graceful shutdown)
- **Phase 4**: ✅ 100% - N+1 쿼리 최적화 (search LIMIT, schedules JOIN)
- **Phase 5**: ✅ 100% - 토스 결제 보안 (콜백 검증, 학원 스코프)
- **Phase 6**: ✅ 100% - 공개 API 보안 (민감정보 제거)

**Overall Progress**: 100% complete

---

## 📝 Notes & Learnings

### Implementation Notes
- (작업 중 추가)

---

## 📚 References

### 관련 파일
| 파일 | 수정 내용 |
|------|-----------|
| `backend/config/database.js` | 환경변수 필수화, 재연결 로직 |
| `backend/utils/encryption.js` | 에러 throw, 기본값 제거 |
| `backend/middleware/auth.js` | 환경변수 필수화 |
| `backend/routes/toss.js` | 콜백 보안, 학원 스코프 |
| `backend/routes/search.js` | LIMIT 추가 |
| `backend/routes/students.js` | 배치 INSERT |
| `backend/routes/schedules.js` | JOIN 최적화 |
| `backend/routes/public.js` | 민감정보 제거 |
| `backend/paca.js` | CORS, 레이트리미팅, Graceful shutdown |

---

## ✅ Final Checklist

**Before marking plan as COMPLETE**:
- [ ] 모든 Phase 완료
- [ ] 환경변수 없이 프로덕션 시작 불가 확인
- [ ] 기존 API 100% 정상 동작
- [ ] 응답시간 50% 개선 확인
- [ ] .env.example 업데이트
- [ ] CLAUDE.md 버전 업데이트

---

**Plan Status**: ⏳ Pending
**Next Action**: 사용자 승인 후 Phase 1 시작
**Blocked By**: 사용자 승인
