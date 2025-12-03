# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

P-ACA(Papa Academy)는 체대입시 학원관리시스템입니다.
- **프론트엔드**: Next.js 15 + React 18 + TypeScript + TailwindCSS (포트 3000)
- **백엔드**: Express.js + MySQL (포트 8320, API 베이스: `/paca`)

## 저장소 및 배포

### GitHub 저장소
- **프론트엔드**: https://github.com/seanyjeong/pacapro (`main` 브랜치)
- **백엔드**: https://github.com/seanyjeong/supermax (`master` 브랜치, `paca/` 폴더)

### 프론트엔드 배포 (Vercel)
- **URL**: https://pacapro.vercel.app
- **자동 배포**: `main` 브랜치에 push하면 자동으로 배포됨
- **환경변수**: `NEXT_PUBLIC_API_URL=https://supermax.kr/paca`

### 백엔드 배포 (n8n 자동 배포)
- **서버**: 211.37.174.218 (cafe24)
- **API URL**: https://supermax.kr/paca
- **자동 배포**: supermax 레포 `master` 브랜치에 push하면 n8n이 자동으로 배포
- **n8n URL**: https://n8n.sean8320.dedyn.io/

## n8n 워크플로우

### 1. GitHub 자동 배포
- **트리거**: GitHub webhook (supermax 레포 push)
- **동작**: 서버 SSH 접속 → git pull → systemctl restart paca
- **소요시간**: 약 3초

### 2. Google Sheets 동기화 (P-ACA 학생 동기화)
- **트리거**: 매일 아침 9시 (Asia/Seoul)
- **대상**: academy_id = 2 (P-ACA)
- **동기화 내용**:
  - **학생명단** 시트: No, 이름, 학년, 상태, 학생전화, 학부모전화, 등록일
  - **월별수납** 시트: No, 이름, 학년, 년월, 수강료, 납부상태, 납부일
- **Google Sheet ID**: `1O9wjLbA969k7YZ1eHVnE2iahXWCt5_d3biWXJhW4A34`
- **인증**: N8N API Key (`X-API-Key: paca-n8n-api-key-2024`)

### 3. 카카오톡 미납 알림 (P-ACA 미납 알림)
- **트리거**: 매일 아침 9시 (Asia/Seoul)
- **대상**: academy_id = 2 미납자
- **동작**: 미납 현황을 카카오톡 "나에게 보내기"로 전송
- **내용**: 미납 학생 수, 총 미납액, 학생별 상세 (이름, 학년, 금액)
- **인증**: 카카오 OAuth2 (REST API Key + Client Secret)

### N8N API Key 인증
백엔드에서 n8n 서비스 계정용 API Key 인증 지원:
- 헤더: `X-API-Key: paca-n8n-api-key-2024`
- JWT 없이 API 호출 가능
- `middleware/auth.js`에서 처리

### DB 백업
- **위치**: `/home/sean/backups/paca/`
- **주기**: 매주 일요일 새벽 3시 (한국시간)
- **보관**: 6개월치 (182일 이상 된 파일 자동 삭제)
- **수동 실행**: `/home/sean/backups/paca/backup.sh`

## 개발 명령어

### 프론트엔드 (루트 디렉토리)
```bash
npm run dev      # 개발 서버 실행 (포트 3000)
npm run build    # 프로덕션 빌드
npm run lint     # ESLint 실행
```

### 백엔드 (supermax/paca/backend/ 디렉토리)
```bash
cd /home/sean/supermax/paca/backend
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

## 완성된 기능 목록

### 학생 관리
- 학생 CRUD (등록, 조회, 수정)
- 학생 검색 (이름, 전화번호)
- 학생 상태 관리: `active`(재원), `paused`(휴원), `withdrawn`(퇴원), `graduated`(졸업)
- **체험생 관리** (v1.3.3)
  - 체험생 등록 (2회 무료 체험)
  - 체험생 전용 탭 (학생 관리 페이지)
  - 체험 일정 수정 가능
  - 정식 등록 전환 기능
  - 스케줄 캘린더에 체험생 수 표시 (✨ 아이콘)
  - 출석 모달에 학년 + 체험 배지 표시
- 휴원 처리 (휴식 기간, 사유 저장, 학원비 이월 크레딧)
- 복귀 처리 (일할계산 학원비 자동 생성, 스케줄 재배정)
- 퇴원 처리 (퇴원 사유 저장, 스케줄 제거)
- 졸업 처리 (고3/N수 학생)
- 삭제 (Hard Delete, owner만 가능)
- 중복 등록 방지 (이름+전화번호 동일 시 차단)
- 동명이인 경고 (이름만 같으면 확인 다이얼로그 후 등록 가능)

### 학년 자동 진급
- 매년 3월 1일 오전 1시(한국시간) 자동 실행
- 진급: 중1→중2→중3→고1→고2→고3→N수
- active, paused 학생만 진급 (graduated, withdrawn 제외)

### 학원비 관리
- 월별 학원비 자동 생성 (매월 1일 스케줄러)
- 학원비 일괄 생성/업데이트
- 납부 처리 (완납, 부분납)
- 일할계산 (복귀 시)
- 휴식 크레딧 자동 차감

### 수업/출석 관리
- 수업 스케줄 관리
- 출석 체크 (출석, 지각, 결석, 병결)
- 시즌(입시 시즌) 관리
- 시즌 활성화 시 스케줄 자동 배치

### 강사 관리
- 강사 CRUD
- 출퇴근 기록
- 급여 관리

### 알림톡/SMS
- Naver Cloud SENS API 연동
- 알림톡 발송 (KakaoTalk 비즈메시지)
- SMS/LMS 발송
- MMS 발송 (이미지 첨부, 최대 3장)
- 학년별 필터 발송 (선행반/3학년)
- 자동 발송 스케줄 (날짜, 시간 설정 가능)

### 리포트/대시보드
- 대시보드 통계
- 재무 리포트
- 데이터 내보내기 (Excel)

### 기타
- 전역 검색 (학생, 강사)
- 설정 관리 (학원 정보, 수강료, 시간대)

## 아키텍처

### 백엔드 구조
```
/home/sean/supermax/paca/backend/
├── paca.js                 # Express 서버 진입점
├── config/database.js      # MySQL 커넥션 풀
├── middleware/auth.js      # JWT 인증, 역할 기반 접근 제어
├── routes/                 # API 라우트 (20개)
│   ├── auth.js            # 로그인, 회원가입
│   ├── students.js        # 학생 CRUD, 휴식/복귀/퇴원/졸업
│   ├── instructors.js     # 강사 CRUD
│   ├── payments.js        # 학원비 관리
│   ├── schedules.js       # 수업 일정, 출석
│   ├── seasons.js         # 시즌 관리
│   ├── salaries.js        # 급여 관리
│   ├── notifications.js   # 알림톡 (SENS)
│   ├── sms.js             # SMS/MMS 발송
│   ├── search.js          # 전역 검색
│   └── ...
├── scheduler/              # 자동화 스케줄러 (3개)
│   ├── paymentScheduler.js         # 월별 학원비 생성 (매월 1일)
│   ├── notificationScheduler.js    # 알림톡 자동 발송 (매시간 체크)
│   └── gradePromotionScheduler.js  # 학년 진급 (매년 3월 1일)
├── utils/naverSens.js      # 네이버 SENS API 유틸
└── migrations/             # DB 마이그레이션 SQL
```

### 프론트엔드 구조
```
/home/sean/pacapro/
├── src/app/                # Next.js App Router 페이지
│   ├── students/          # 학생 관리
│   ├── instructors/       # 강사 관리
│   ├── payments/          # 학원비 관리
│   ├── schedules/         # 수업 일정
│   ├── seasons/           # 시즌 관리
│   ├── salaries/          # 급여 관리
│   ├── sms/               # SMS 발송
│   ├── settings/          # 설정 (알림톡 포함)
│   └── reports/           # 대시보드/리포트
├── src/components/         # 기능별 컴포넌트
├── src/lib/api/            # API 클라이언트
└── src/hooks/              # React Query 훅
```

### 주요 패턴
- **인증**: JWT 토큰을 localStorage에 저장, Axios 인터셉터로 자동 첨부
- **API 클라이언트**: `src/lib/api/client.ts`의 싱글톤 `apiClient`
- **데이터 페칭**: TanStack React Query
- **폼**: React Hook Form + Zod 유효성 검사
- **사용자 역할**: `owner`, `admin`, `teacher`

## API 엔드포인트 요약

모든 엔드포인트는 `/paca/` 접두사 사용:

| 경로 | 설명 |
|------|------|
| `/auth` | 로그인, 회원가입 |
| `/students` | 학생 CRUD, 휴식/복귀/퇴원/졸업 |
| `/students/auto-promote` | 학년 자동 진급 |
| `/instructors` | 강사 CRUD |
| `/payments` | 학원비 관리 |
| `/schedules` | 수업 일정, 출석 |
| `/seasons` | 시즌 관리 |
| `/salaries` | 급여 관리 |
| `/notifications` | 알림톡 설정/발송 |
| `/sms` | SMS/MMS 발송 |
| `/search` | 전역 검색 |
| `/reports` | 대시보드, 리포트 |
| `/settings` | 학원 설정 |

## 개발 워크플로우

### 프론트엔드 수정
1. `/home/sean/pacapro/` 에서 코드 수정
2. `npm run build` 로 빌드 확인
3. `git add . && git commit -m "메시지" && git push`
4. Vercel 자동 배포 (1-2분)

### 백엔드 수정
1. `/home/sean/supermax/paca/backend/` 에서 코드 수정
2. `cd /home/sean/supermax && git add . && git commit -m "메시지" && git push origin master`
3. n8n 자동 배포 (3초)

### DB 마이그레이션
1. `backend/migrations/` 에 SQL 파일 생성
2. 서버에서 실행:
```bash
ssh root@211.37.174.218
mysql -u root -pQq141171616! paca < /root/supermax/paca/backend/migrations/파일명.sql
```

## 주의사항 (개발 패턴)

### 학생 상태 (status)
- `active`: 재원 (스케줄 포함, 학원비 생성, 진급 대상)
- `paused`: 휴원 (스케줄 제외, 학원비 미생성, 진급 대상)
- `withdrawn`: 퇴원 (스케줄 제외, 학원비 미생성, 진급 제외)
- `graduated`: 졸업 (스케줄 제외, 학원비 미생성, 진급 제외)

### 삭제/퇴원/졸업 처리 시 확인 필요
- 삭제: "삭제" 텍스트 입력 확인
- 퇴원: "퇴원" 텍스트 입력 확인 + 사유 입력
- 졸업: "졸업" 텍스트 입력 확인

### Hydration 에러 방지
```tsx
// ✅ 클라이언트에서만 체크
const [canEditSchedules, setCanEditSchedules] = useState(false);
useEffect(() => {
  setCanEditSchedules(canEdit('schedules'));
}, []);
```

### JavaScript Date 월(month) 주의
```javascript
// month는 0부터 시작!
new Date(2025, 11, 1)  // 12월 1일
new Date(2025, 12, 1)  // 2026년 1월 1일 (주의!)
```

### 휴원 복귀 시 일할계산
- 복귀일부터 말일까지의 수업일수 계산
- `월수강료 × (남은수업일 / 총수업일)` (천원 단위 절삭)
- 납부기한: 복귀일 + 7일

## 버전 이력

### 현재 버전: v2.0.0 (2025-12-03)

- **v2.0.0** (2025-12-03): 알림톡/SMS 멀티 서비스 지원 (네이버 SENS + 솔라피)
  - 서비스 선택 UI (SENS/솔라피 탭)
  - 각 서비스별 API 키, 템플릿 별도 관리
  - SENS/솔라피 각각 독립적 활성화 (is_enabled, solapi_enabled)
  - SENS: 자동 발송 스케줄러 (날짜/시간 설정)
  - 솔라피: n8n 워크플로우 연동용 (자동발송 스케줄 n8n에서 관리)
  - 솔라피 가이드 추가
- **v1.3.3** (2025-12-03): 체험생 기능, 필터 버그 수정, 문의 연락처 추가
- **v1.3.2** (2025-12-02): 카카오톡 미납 알림 (n8n), 학원비 검색 기능
- **v1.3.1** (2025-12-02): n8n Google Sheets 동기화, 중복등록 방지, 동명이인 경고
- **v1.3.0** (2025-12-02): 알림톡/SMS/MMS 기능, 학년 자동 진급, 퇴원/졸업 처리, DB 백업
- **v1.2.2** (2025-12-01): 휴원 복귀 시 일할계산 학원비 자동 생성
- **v1.2.0** (2025-12-01): 휴식 기간 관리, 학원비 이월/환불 처리
- **v1.0.0** (2025-11-30): 초기 버전

## 보안 참고사항

현재 코드에 하드코딩된 값들 (프로덕션 전 환경변수로 분리 권장):
- DB 비밀번호: `config/database.js`
- JWT 시크릿: `middleware/auth.js`
- 암호화 키: `routes/notifications.js`, `routes/sms.js`

권장 `.env` 파일:
```
DB_HOST=211.37.174.218
DB_PASSWORD=실제비밀번호
JWT_SECRET=강한랜덤문자열
ENCRYPTION_KEY=또다른랜덤문자열
```
