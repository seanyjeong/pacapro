# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

P-ACA(Papa Academy)는 체대입시 학원관리시스템입니다.
- **프론트엔드**: Next.js 15 + React 18 + TypeScript + TailwindCSS (포트 3000)
- **백엔드**: Express.js + MySQL (포트 8320, API 베이스: `/paca`)

## 저장소 및 배포

### GitHub 저장소
- **URL**: https://github.com/seanyjeong/pacapro
- **브랜치**: `main`

### 프론트엔드 배포 (Vercel)
- **URL**: https://pacapro.vercel.app (또는 Vercel이 생성한 도메인)
- **자동 배포**: `main` 브랜치에 push하면 자동으로 배포됨
- **환경변수**: `NEXT_PUBLIC_API_URL=https://supermax.kr/paca`

### 백엔드 배포
- **서버**: 211.37.174.218 (cafe24)
- **API URL**: https://supermax.kr/paca

## 개발 명령어

### 프론트엔드 (루트 디렉토리)
```bash
npm run dev      # 개발 서버 실행 (포트 3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 실행
```

### 백엔드 (backend/ 디렉토리)
```bash
cd backend
npm run dev      # nodemon으로 개발 서버 실행 (핫 리로드)
npm start        # 프로덕션 서버 실행
npm test         # Jest 테스트 (watch 모드)
npm run test:ci  # 테스트 1회 실행 (CI용)
```

### 서버 배포
```bash
# 서버 접속
ssh root@211.37.174.218
# 비밀번호: Qq141171616!

# 백엔드 디렉토리
cd supermax/paca

# systemctl로 서비스 관리
sudo systemctl restart paca    # 서버 재시작
sudo systemctl status paca     # 상태 확인
sudo journalctl -u paca -f     # 로그 확인
```

## 아키텍처

### 백엔드 구조
- `paca.js` - Express 서버 진입점
- `routes/` - API 라우트 핸들러 (auth, students, instructors, payments, salaries, seasons, schedules 등)
- `middleware/auth.js` - JWT 인증 (`verifyToken`, `requireRole()`)
- `config/database.js` - MySQL 커넥션 풀
- `scheduler/paymentScheduler.js` - 학원비 자동 생성 크론잡 (매일 자정 실행)

### 프론트엔드 구조
- `src/app/` - Next.js App Router 페이지
- `src/components/` - 기능별 컴포넌트 (students/, instructors/, schedules/ 등)
- `src/lib/api/` - Axios 싱글톤 API 클라이언트 (`client.ts`)
- `src/hooks/` - React Query 데이터 페칭 훅

### 주요 패턴
- **인증**: JWT 토큰을 localStorage에 저장, Axios 인터셉터로 자동 첨부
- **API 클라이언트**: `src/lib/api/client.ts`의 싱글톤 `apiClient`가 모든 HTTP 요청 처리
- **데이터 페칭**: TanStack React Query 사용
- **폼**: React Hook Form + Zod 유효성 검사
- **사용자 역할**: `owner`, `admin`, `teacher` - `requireRole()` 미들웨어로 권한 제어

### 데이터베이스
- MySQL 커넥션 풀 사용
- 마이그레이션: `database/migrations/`
- Soft Delete: `deleted_at` 컬럼 활용
- 타임존: 한국 시간 (`+09:00`)

## API 엔드포인트

모든 엔드포인트는 `/paca/` 접두사 사용:
- `/auth` - 로그인, 회원가입
- `/students`, `/instructors` - 학생/강사 CRUD
- `/payments`, `/salaries` - 학원비/급여 관리
- `/schedules` - 수업 일정 및 출석
- `/seasons` - 시즌/등록 관리
- `/performance` - 학생 성적 기록
- `/reports` - 대시보드 및 재무 리포트
- `/settings` - 학원 설정

상세 API 문서: `backend/API-REFERENCE.md`

## 개발 워크플로우

### 다른 컴퓨터에서 작업 시작하기
```bash
# 1. 저장소 클론
git clone https://github.com/seanyjeong/pacapro.git
cd pacapro

# 2. 의존성 설치
npm install

# 3. 환경변수 설정 (.env.local 생성)
echo "NEXT_PUBLIC_API_URL=https://supermax.kr/paca" > .env.local

# 4. 개발 서버 실행
npm run dev
```

### 프론트엔드 수정 프로세스
1. 코드 수정
2. `git add . && git commit -m "메시지" && git push`
3. **자동 배포**: Vercel이 자동으로 빌드 & 배포 (1-2분 소요)

### 백엔드 수정 프로세스
1. `backend/` 폴더에서 코드 수정
2. 수정된 파일을 서버에 SFTP로 업로드
3. `sudo systemctl restart paca`

### 파일 업로드 위치
- **로컬 백엔드**: `C:\projects\papa\backend\`
- **서버 백엔드**: `/root/supermax/paca/`

### DB 마이그레이션
새 테이블이나 컬럼 추가 시:
1. `backend/migrations/` 에 SQL 파일 생성
2. 서버에서 직접 MySQL 실행: `mysql -u root -p paca < migration.sql`

### 주의사항
- 프론트엔드는 GitHub push 시 자동 배포 (Vercel)
- 백엔드는 수동으로 서버에 업로드 필요
- 서버 로그 확인: `sudo journalctl -u paca -f`

## 버전 관리

프로젝트는 **Semantic Versioning** 규칙을 따릅니다: `MAJOR.MINOR.PATCH`

### 버전 업데이트 기준
- **PATCH (1.0.X)**: 자잘한 버그 수정, 오타 수정, 작은 UI 개선
  - 예: 1.0.0 → 1.0.1
- **MINOR (1.X.0)**: 새 기능 추가, 중간 규모 수정, API 변경 (하위호환)
  - 예: 1.0.1 → 1.1.0
- **MAJOR (X.0.0)**: 대규모 리팩토링, 아키텍처 변경, 하위호환 깨지는 변경
  - 예: 1.5.3 → 2.0.0

### 버전 업데이트 방법
수정 완료 후 **3곳** 모두 업데이트 필요:

1. **package.json** - `version` 필드
```json
"version": "1.0.1"
```

2. **src/components/layout/sidebar.tsx** - 사이드바 하단 (line ~199)
```tsx
P-ACA v1.0.1
```

3. **src/app/settings/page.tsx** - 시스템 정보 카드 (line ~750)
```tsx
<span className="font-medium text-gray-900">v1.0.1</span>
<span className="font-medium text-gray-900">2025-11-30</span>  // 날짜도 업데이트
```

### 현재 버전
- **v1.2.0** (2025-12-01): 휴식 기간 관리 기능 추가, 학원비 이월/환불 처리, 스케줄러 수정
- **v1.0.1** (2025-11-30): Hydration 에러 수정, 시즌 태그 쿼리 수정, 빌드 오류 수정
- **v1.0.0** (2025-11-30): 시즌 시간대 다중 선택, 시즌 활성화 시 스케줄 자동 배치

## 주의사항 (개발 패턴)

### Hydration 에러 방지
Next.js에서 localStorage나 권한 체크처럼 클라이언트에서만 사용 가능한 값은 SSR과 클라이언트 렌더링 불일치로 hydration 에러 발생 가능.

**해결 패턴:**
```tsx
// ❌ 잘못된 방식 (hydration 에러 발생)
const canEdit = canEdit('schedules');

// ✅ 올바른 방식 (클라이언트에서만 체크)
const [canEditSchedules, setCanEditSchedules] = useState(false);
useEffect(() => {
  setCanEditSchedules(canEdit('schedules'));
}, []);
```

### useSearchParams 사용
Next.js 15에서 `useSearchParams()`는 반드시 Suspense boundary 내에서 사용해야 함.
정적 생성 시점에 URL 파라미터를 읽으면 빌드 에러 발생.

**해결 패턴:**
```tsx
// Suspense로 감싸고, useEffect에서 파라미터 처리
const searchParams = useSearchParams();
useEffect(() => {
  const status = searchParams.get('status');
  if (status === 'unpaid') {
    updateFilters({ payment_status: 'pending' });
  }
}, [searchParams]);
```

### 시즌 날짜 필드 구분
- `non_season_end_date`: 비시즌 종강일 (시즌 시작 전 마지막 날)
- `season_start_date`: 시즌 시작일
- `season_end_date`: 시즌 종료일

시즌 기간 체크 시: `date BETWEEN season_start_date AND season_end_date`

### 휴식(휴원) 기간 관리
학생이 휴식(paused) 상태가 되면 휴식 기간을 설정할 수 있음.

**관련 테이블/필드:**
- `students.rest_start_date`: 휴식 시작일
- `students.rest_end_date`: 휴식 종료일 (NULL이면 무기한)
- `students.rest_reason`: 휴식 사유
- `rest_credits`: 휴식으로 인한 이월/환불 크레딧 기록

**API 엔드포인트:**
- `POST /paca/students/:id/rest` - 휴식 처리 (이월/환불 크레딧 생성)
- `POST /paca/students/:id/resume` - 휴식 복귀
- `GET /paca/students/:id/rest-credits` - 휴식 크레딧 내역 조회

**이월 처리 흐름:**
1. 학생을 휴원 상태로 변경하고 휴식 기간 설정
2. 이미 납부한 학원비가 있으면 휴식 일수만큼 일할 계산하여 크레딧 생성
3. 다음 달 학원비 생성 시 크레딧이 자동 차감됨

**학원비 자동 생성:**
- 스케줄러가 매월 1일에 모든 active 학생의 학원비를 자동 생성
- 또는 학원비 관리 페이지에서 "월별 학원비 생성" 버튼으로 수동 생성
