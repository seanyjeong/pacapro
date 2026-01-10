# P-ACA 코드 검증 가이드

> 다른 AI 모델(GPT-4, Gemini, Claude 등)에게 이 프로젝트를 크로스체크 시킬 때 사용하는 프롬프트와 컨텍스트입니다.

---

## 프로젝트 개요

```
프로젝트: P-ACA (파카) - 체대입시 학원관리 시스템
스택: Next.js 15 + Express.js + MySQL
프론트엔드: src/ (약 100개 파일)
백엔드: backend/ (약 25,000 라인)
```

---

## 검증 프롬프트 템플릿

### 1. 보안 검증 (필수)

```markdown
# 역할
당신은 시니어 보안 엔지니어입니다. 이 프로젝트의 보안 취약점을 **실제 코드를 검증하며** 분석해주세요.

# 컨텍스트
- 프로젝트: Next.js 15 + Express.js + MySQL 학원관리 시스템
- 민감정보 암호화: name, phone, parent_phone, address (AES-256-GCM)
- 인증: JWT 토큰
- 권한: owner/admin/teacher/staff 레벨

# 검증 항목 (반드시 실제 코드 확인 후 판정)

## 1. SQL Injection
- [ ] `backend/routes/*.js` 파일에서 `db.query` 호출 패턴 확인
- [ ] 템플릿 리터럴에 사용자 입력이 직접 삽입되는지 확인
- [ ] prepared statements (`?` placeholder) 사용 여부 확인

검증 명령어:
```bash
# 위험 패턴 (템플릿 리터럴에 변수 삽입)
grep -r "db.query(\`.*\${" backend/routes/

# 안전 패턴 (placeholder 사용)
grep -r "db.query(" backend/routes/ | head -20
```

## 2. XSS
- [ ] `dangerouslySetInnerHTML` 사용 여부 확인
- [ ] 사용자 입력이 HTML로 렌더링되는 곳 확인

검증 명령어:
```bash
grep -r "dangerouslySetInnerHTML" src/
```

## 3. 인증/권한
- [ ] JWT 토큰 검증 미들웨어 확인
- [ ] 권한 체크 미들웨어 확인
- [ ] 민감 API에 권한 체크 적용 여부

검증 명령어:
```bash
# 인증 미들웨어
cat backend/middleware/auth.js

# 라우트에서 사용
grep -r "verifyToken\|requireRole" backend/routes/
```

## 4. 암호화
- [ ] 암호화 구현 확인
- [ ] 암호화 키 관리 확인

검증 명령어:
```bash
cat backend/utils/encryption.js
```

# 출력 형식
| 항목 | 검증 결과 | 근거 (파일:라인) |
|------|----------|-----------------|
| SQL Injection | ✅ 안전 / ❌ 취약 | 근거 코드 |
| XSS | ✅ 안전 / ❌ 취약 | 근거 코드 |
| 인증 | ✅ 안전 / ❌ 취약 | 근거 코드 |
| 암호화 | ✅ 안전 / ❌ 취약 | 근거 코드 |

**중요**: 추측하지 말고 반드시 실제 코드를 확인한 후 판정하세요.
```

---

### 2. 코드 품질 검증

```markdown
# 역할
당신은 시니어 풀스택 개발자입니다. 이 프로젝트의 코드 품질을 **실제 코드를 검증하며** 분석해주세요.

# 컨텍스트
- 프로젝트: Next.js 15 + Express.js + MySQL 학원관리 시스템
- TypeScript strict 모드 사용
- shadcn/ui + TailwindCSS 디자인 시스템

# 검증 항목

## 1. TypeScript 설정
```bash
cat tsconfig.json | grep -A5 "compilerOptions"
```
- [ ] strict: true 여부
- [ ] 경로 별칭 설정

## 2. 테스트 코드
```bash
find . -name "*.test.ts" -o -name "*.test.tsx" | grep -v node_modules
```
- [ ] 테스트 파일 존재 여부
- [ ] 테스트 커버리지

## 3. ESLint/Prettier 설정
```bash
ls -la eslint.config.* .eslintrc* .prettierrc*
cat package.json | grep -A5 '"lint"'
```

## 4. 에러 핸들링 패턴
```bash
# 프론트엔드 에러 핸들링
grep -r "catch\|try\|error" src/app/ | head -20

# 백엔드 에러 핸들링
grep -r "catch\|try\|res.status(4\|res.status(5" backend/routes/ | head -20
```

## 5. API 응답 일관성
```bash
# 성공 응답 패턴
grep -r "res.json" backend/routes/ | head -10

# 에러 응답 패턴
grep -r "res.status(400)\|res.status(500)" backend/routes/ | head -10
```

# 출력 형식
| 항목 | 상태 | 개선 필요 | 우선순위 |
|------|------|----------|---------|
| TypeScript strict | ✅/❌ | 내용 | HIGH/MEDIUM/LOW |
| 테스트 코드 | ✅/❌ | 내용 | HIGH/MEDIUM/LOW |
| Lint 설정 | ✅/❌ | 내용 | HIGH/MEDIUM/LOW |

**중요**: 추측하지 말고 반드시 실제 코드를 확인한 후 판정하세요.
```

---

### 3. 아키텍처 검증

```markdown
# 역할
당신은 소프트웨어 아키텍트입니다. 이 프로젝트의 구조를 분석해주세요.

# 컨텍스트
프로젝트 구조:
```
pacapro/
├── src/                    # Next.js 프론트엔드
│   ├── app/               # App Router 페이지
│   ├── components/        # 재사용 컴포넌트
│   ├── lib/
│   │   ├── api/          # API 클라이언트
│   │   ├── types/        # TypeScript 타입
│   │   └── utils/        # 유틸리티
│   └── hooks/            # 커스텀 훅
├── backend/               # Express.js 백엔드
│   ├── routes/           # API 라우트
│   ├── middleware/       # 미들웨어
│   ├── utils/            # 유틸리티
│   ├── config/           # 설정
│   └── scheduler/        # 스케줄러
└── docs/                  # 문서
```

# 검증 항목

## 1. 폴더 구조 확인
```bash
# 프론트엔드 구조
ls -la src/
ls -la src/app/
ls -la src/components/

# 백엔드 구조
ls -la backend/
ls -la backend/routes/
```

## 2. 관심사 분리
```bash
# 라우트 파일 개수
ls backend/routes/*.js | wc -l

# 컴포넌트 구조
find src/components -name "*.tsx" | wc -l
```

## 3. 공통 패턴
```bash
# API 클라이언트 패턴
cat src/lib/api/client.ts

# 공통 타입
ls src/lib/types/
```

# 출력 형식
## 강점
- 항목1
- 항목2

## 개선 권장
| 항목 | 현재 상태 | 권장 사항 | 우선순위 |
|------|----------|----------|---------|

**중요**: 추측하지 말고 반드시 실제 코드를 확인한 후 판정하세요.
```

---

### 4. 성능 검증

```markdown
# 역할
당신은 성능 최적화 전문가입니다. 이 프로젝트의 성능 이슈를 분석해주세요.

# 컨텍스트
- Next.js 15 App Router 사용
- React Query로 서버 상태 관리
- MySQL 데이터베이스

# 검증 항목

## 1. N+1 쿼리 문제
```bash
# JOIN 사용 여부
grep -r "JOIN\|LEFT JOIN" backend/routes/ | wc -l

# 루프 내 쿼리
grep -r "for.*await.*query\|forEach.*await.*query" backend/routes/
```

## 2. 인덱스 사용
```bash
# 문서에서 인덱스 확인
cat docs/DATABASE-SCHEMA.md | grep -A5 "INDEX\|PRIMARY\|FOREIGN"
```

## 3. 프론트엔드 최적화
```bash
# React Query 사용
grep -r "useQuery\|useMutation" src/ | wc -l

# 메모이제이션
grep -r "useMemo\|useCallback\|memo(" src/ | wc -l
```

## 4. 번들 사이즈
```bash
# 의존성 확인
cat package.json | grep -A50 '"dependencies"'

# dynamic import 사용
grep -r "dynamic(" src/
```

# 출력 형식
| 항목 | 상태 | 이슈 | 권장 사항 |
|------|------|------|----------|
```

---

## 주의사항

### 잘못된 검증 예시 (하지 말아야 할 것)

```markdown
❌ 잘못된 예:
"SQL Injection에 취약할 수 있습니다. prepared statements를 사용하세요."
→ 실제로 확인하지 않고 일반적인 권고를 하는 것

✅ 올바른 예:
"backend/routes/students.js:42에서 확인한 결과,
db.query('SELECT * FROM students WHERE id = ?', [studentId])
형태로 placeholder를 사용하고 있어 SQL Injection에 안전합니다."
→ 실제 코드를 확인하고 근거를 제시
```

### 검증 시 필수 확인 명령어

```bash
# 1. 프로젝트 기본 정보
cat package.json | head -20
cat CLAUDE.md

# 2. 보안 관련
grep -r "db.query" backend/routes/ | head -10
grep -r "dangerouslySetInnerHTML" src/
cat backend/middleware/auth.js

# 3. 코드 품질
cat tsconfig.json
find . -name "*.test.*" | grep -v node_modules
ls eslint.config.* .eslintrc* 2>/dev/null

# 4. 문서
ls docs/
cat docs/DATABASE-SCHEMA.md | head -50
cat docs/API-ROUTES.md | head -50
```

---

## 기존 검증 결과 (참고용)

2026-01-10 검증 결과:

| 항목 | 결과 | 근거 |
|------|------|------|
| SQL Injection | ✅ 안전 | `?` placeholder 사용 확인 |
| XSS | ✅ 안전 | dangerouslySetInnerHTML 미사용 |
| TypeScript strict | ✅ 사용 중 | tsconfig.json 확인 |
| 테스트 코드 | ❌ 없음 | test 파일 미존재 |
| ESLint | ✅ 설정됨 | eslint.config.mjs 생성 완료 |

---

## 모델별 추천 프롬프트

### GPT-4 / GPT-4o
```
위의 "보안 검증" 프롬프트를 그대로 사용하되,
"Code Interpreter를 사용해 실제 파일을 읽고 분석하세요"를 추가
```

### Claude
```
위의 프롬프트를 그대로 사용하되,
"Read, Grep, Bash 도구를 사용해 실제 코드를 검증하세요"를 추가
```

### Gemini
```
위의 프롬프트를 그대로 사용하되,
"코드 스니펫을 직접 확인하고 라인 번호와 함께 근거를 제시하세요"를 추가
```

---

## 체크리스트

검증 보고서 작성 시 다음을 확인하세요:

- [ ] 모든 판정에 **실제 코드 근거**가 있는가?
- [ ] 파일 경로와 라인 번호가 명시되어 있는가?
- [ ] "~할 수 있습니다" 같은 추측성 표현이 없는가?
- [ ] 검증 명령어의 실제 출력 결과가 포함되어 있는가?
- [ ] 우선순위가 합리적으로 설정되어 있는가?

---

*이 문서는 AI 모델 간 크로스체크를 위해 작성되었습니다.*
*마지막 업데이트: 2026-01-10*
