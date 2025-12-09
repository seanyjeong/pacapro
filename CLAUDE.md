# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 프로젝트 개요

P-ACA(Papa Academy)는 체대입시 학원관리시스템입니다.
- **프론트엔드**: Next.js 15 + React 18 + TypeScript + TailwindCSS (포트 3000)
- **백엔드**: Express.js + MySQL (포트 8320, API 베이스: `/paca`)

## 저장소 및 배포

### GitHub 저장소
- **프론트엔드**: https://github.com/seanyjeong/pacapro (`main` 브랜치)
- **백엔드**: GitHub 사용 안 함 (로컬에서 직접 수정)

### 프론트엔드 배포 (Vercel)
- **URL**: https://pacapro.vercel.app
- **자동 배포**: `main` 브랜치에 push하면 자동으로 배포됨
- **환경변수**: `NEXT_PUBLIC_API_URL=https://chejump.com/paca`

### 백엔드 배포 (sean-mini-server 로컬)
- **서버**: sean-mini-server (218.148.190.61 / chejump.com)
- **API URL**: https://chejump.com/paca
- **배포 방법**: Git 필요 없음! 로컬에서 코드 수정 후 `sudo systemctl restart paca` 만 실행하면 끝
- **백엔드 경로**: `/home/sean/supermax/paca/backend` (레거시 경로, 나중에 정리 예정)
- **n8n URL**: https://n8n.sean8320.dedyn.io/

### ⚠️ 백엔드 배포 주의사항
- **Git push 필요 없음**: 이 서버에서 직접 작업하므로 코드 수정 후 바로 반영됨
- **재시작만 하면 됨**: `sudo systemctl restart paca`
- **로그 확인**: `sudo journalctl -u paca -f`

## n8n 워크플로우

### 1. ~~GitHub 자동 배포~~ (사용 안 함)
- 백엔드가 로컬 서버에 있으므로 더 이상 사용하지 않음
- cafe24 서버(supermax) 수정할 일 있을 때만 사용

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

### 백엔드 배포 (로컬에서 바로!)
```bash
# Git 필요 없음! 코드 수정 후 재시작만 하면 됨
echo 'q141171616!' | sudo -S systemctl restart paca    # 서버 재시작
echo 'q141171616!' | sudo -S systemctl status paca     # 상태 확인
sudo journalctl -u paca -f                              # 로그 확인
```

### DB 접속
```bash
mysql -u paca -pq141171616! paca   # MySQL 접속 (비밀번호: q141171616!)
```

### cafe24 서버 (레거시 - 백업용)
- IP: 211.37.174.218
- 더 이상 사용하지 않음 (DB/백엔드 모두 로컬로 이전 완료)

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

### UI 컴포넌트 규칙

#### Dialog/Modal 패딩 규칙 (필수!)
모달 내부 컨텐츠에는 **반드시** `py-6 px-6` 패딩을 적용해야 함:
```tsx
<Dialog>
  <DialogContent>
    <DialogHeader>
      <DialogTitle>제목</DialogTitle>
    </DialogHeader>

    {/* ⚠️ 이 div에 py-6 px-6 필수! */}
    <div className="space-y-4 py-6 px-6">
      <div className="space-y-2">
        <Label>라벨</Label>
        <Input />
      </div>
    </div>

    <DialogFooter>
      <Button>확인</Button>
    </DialogFooter>
  </DialogContent>
</Dialog>
```
- `DialogHeader`와 `DialogFooter` 사이의 본문 영역에 패딩 적용
- Label과 Input 사이에는 `space-y-2` 사용
- 여러 필드 사이에는 `space-y-4` 사용

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

### 🚨🚨🚨 버전 업데이트 규칙 (매우 중요!) 🚨🚨🚨

**⚠️ 프론트엔드 배포할 때마다 반드시 버전을 올려야 함!**
**버전을 안 올리면 사용자 브라우저에 새 버전이 적용되지 않음!**

**버전 업데이트 시 아래 4곳을 모두 수정:**
```
1. package.json                           → "version": "x.x.x"
2. src/components/version-checker.tsx     → APP_VERSION = 'x.x.x'
3. src/components/layout/sidebar.tsx      → P-ACA vx.x.x + 날짜
4. src/app/settings/page.tsx              → vx.x.x + 날짜
```

**그리고 CLAUDE.md 버전 이력 섹션에 변경 내용 추가!**

버전 규칙:
- **Major (x.0.0)**: 대규모 기능 추가, 아키텍처 변경
- **Minor (0.x.0)**: 새 기능 추가
- **Patch (0.0.x)**: 버그 수정, 작은 개선

**📌 Claude에게: 프론트엔드 코드 수정 후 git push 전에 반드시 버전 업데이트할 것!**

### 백엔드 수정
1. `/home/sean/supermax/paca/backend/` 에서 코드 수정
2. `cd /home/sean/supermax && git add . && git commit -m "메시지" && git push origin master`
3. n8n 자동 배포 (3초)

### DB 마이그레이션
```bash
# 로컬에서 직접 실행
mysql -u root -p paca < /home/sean/supermax/paca/backend/migrations/파일명.sql
```

## 주의사항 (개발 패턴)

### ⚠️ 기존 코드 수정 금지 (매우 중요!)
**현재 시스템이 안정적으로 운영 중이므로, 기존 기능에 절대 영향을 주면 안 됨!**

새 기능 추가 시 반드시 지켜야 할 원칙:
1. **기존 파일 수정 최소화**: 새 기능은 새 파일로 구현
2. **기존 API 엔드포인트 변경 금지**: 새 엔드포인트만 추가
3. **기존 DB 테이블 구조 변경 최소화**: 새 테이블 생성 우선, 기존 테이블은 컬럼 추가만 허용 (삭제/수정 금지)
4. **기존 컴포넌트 수정 금지**: 새 컴포넌트 생성, 필요시 import만 추가
5. **사이드바/네비게이션 수정**: 메뉴 추가만 허용 (기존 메뉴 변경 금지)

```
✅ 허용:
- 새 라우트 파일 생성 (routes/consultations.js)
- 새 페이지 생성 (src/app/consultations/)
- 새 컴포넌트 생성 (src/components/consultations/)
- 새 DB 테이블 생성
- 기존 테이블에 새 컬럼 추가 (ALTER TABLE ADD COLUMN)
- paca.js에 새 라우트 등록 (기존 라우트 변경 없이)
- sidebar.tsx에 새 메뉴 추가 (기존 메뉴 변경 없이)

❌ 금지:
- 기존 API 로직 수정
- 기존 컴포넌트 동작 변경
- 기존 DB 컬럼 삭제/타입 변경
- 기존 라우트 경로 변경
- 기존 함수 시그니처 변경
```

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

### 시간대(time_slot) 변환 규칙
DB `class_schedules.time_slot`은 **ENUM('morning','afternoon','evening')** 으로 영어만 허용.
프론트엔드에서 한글로 보내면 백엔드에서 반드시 변환 필요:
```javascript
const timeSlotMap = { '오전': 'morning', '오후': 'afternoon', '저녁': 'evening' };
const dbTimeSlot = timeSlotMap[frontendTimeSlot] || frontendTimeSlot;
```

### 체험생 관련 주의사항
- 대시보드 재원생 수: 체험생 제외 (`is_trial = 0 OR is_trial IS NULL`)
- 체험생 등록 시 `class_days`(NOT NULL)와 `monthly_tuition`(NOT NULL) 기본값 필요: `'[]'`, `0`
- 체험 일정은 `trial_dates` JSON 배열로 저장: `[{date, time_slot, attended}]`

### 시즌 등록/취소 관련 주의사항
- **시즌 등록 취소 = 완전 삭제** (status 변경이 아님)
- 취소 시 처리 순서:
  1. 환불 필요 여부 확인 (결제 완료 상태인지)
  2. 환불 금액 계산 (`calculateSeasonRefund()`)
  3. 환불 금액 > 0이면 `expenses` 테이블에 환불 기록
  4. `student_seasons` 삭제
  5. `student_payments` 중 미납건만 삭제
- **시즌 납부기한 계산**:
  - 시즌 시작 전 등록: `min(등록일+7, 시즌시작일)`
  - 시즌 시작 후 등록: `등록일+7` (중간 등록도 7일 유예)
- **시간대 기본값**: `enrollment.time_slots`이 NULL이면 `season.grade_time_slots[학년]` 사용

### 시즌 관련 주요 파일
| 파일 | 설명 |
|------|------|
| `src/app/seasons/[id]/page.tsx` | 시즌 상세 (등록 학생 목록, 시간대 표시) |
| `src/app/seasons/[id]/enroll/page.tsx` | 시즌 학생 등록 모달 (할인 입력) |
| `routes/seasons.js` | 백엔드 시즌 API (등록/취소/환불) |
| `src/components/payments/payment-record-modal.tsx` | 납부 모달 (할인 입력) |

## 버전 이력

### 현재 버전: v2.7.5 (2025-12-09)

- **v2.7.5** (2025-12-09): 시즌 환불 시스템 + 강사 급여 일괄 지급
  - 시즌 환불 명세서 모달 추가 (학원법 기준 표시, 부가세 옵션, 복사/인쇄 기능)
  - 환불 계산: 실제 납부 금액 기준, 일할 계산, VAT 10% 제외 옵션
  - 학원법 기준 안내: 1/3 경과 전 2/3 환불, 1/2 경과 전 1/2 환불, 1/2 이상 환불 불가
  - 급여 관리 페이지에 "모두 지급처리" 버튼 추가 (미지급 급여 일괄 처리)
- **v2.7.4** (2025-12-09): 퇴원 처리 시 미납 학원비 삭제 버그 수정
  - 퇴원 처리 시 미납 학원비가 삭제 안 되는 버그 수정
  - 테이블명 오류 수정: `payments` → `student_payments`
  - 컬럼명 오류 수정: `status` → `payment_status`, `amount` → `final_amount`
- **v2.7.3** (2025-12-08): 시즌 등록 할인 + 학원비 납부 할인 + 시즌 취소 개선
  - **시즌 등록 시 할인 금액 입력** 기능 추가
    - 등록 모달에 할인 금액 입력 필드 추가
    - 할인 적용 시 시즌비 미리보기 표시
    - `student_seasons` 테이블에 `discount_reason` 컬럼 추가
    - `discount_type` ENUM에 'manual' 추가
  - **학원비 납부 시 할인 적용** 기능 추가
    - 납부 모달에 "추가 할인" 입력 필드 추가
    - 할인 적용 시 `final_amount` 감소, `discount_amount` 증가
    - 부분납부/완납 모두 할인 적용 가능
  - **시즌 중간 등록 연체 표시 수정**
    - 기존: 시즌 시작일 이후 등록하면 무조건 연체 표시
    - 수정: 등록일 + 7일이 납부기한 (시즌 시작 후 등록해도 7일 유예)
  - **시즌 등록 시간대 기본값 개선**
    - `enrollment.time_slots`이 NULL이면 `season.grade_time_slots`에서 해당 학년 기본값 사용
    - 백엔드: 등록 학생 조회 시 `student_grade` 필드 추가
  - **시즌 등록 취소 = 완전 삭제**
    - 기존: status = 'cancelled'로 업데이트 → 이제: DELETE로 완전 삭제
    - `student_seasons` 레코드 삭제
    - `student_payments` 중 미납건만 삭제 (완납건은 유지)
    - 환불 필요 시 `expenses`에 환불 내역 기록 (삭제 전 처리)
- **v2.7.2** (2025-12-08): 시즌 페이지 개선
  - 시즌 상세 페이지 시간대 표시 개선 (NULL 처리)
- **v2.7.1** (2025-12-08): 시즌 할인/납부 표시 개선
  - 시즌 상세 페이지 할인 금액 취소선 + 빨간색 표시
  - 납부 상태 색상 구분 (완납/일부납부/미납)
- **v2.7.0** (2025-12-08): 학생 시간대 선택 + 입시유형 분리 + 학생 메모
  - 학생 등록/수정 시 **수업 시간대 선택** 버튼 추가 (오전/오후/저녁, 기본값 저녁)
  - 시간대에 따라 스케줄 자동 배정 (기존: 저녁 고정 → 이제: 선택한 시간대로)
  - 입시유형 **사관학교/경찰대 분리** (기존: military → military_academy, police_university)
  - **학생 메모** 기능 추가 (상담 내용, 학생 특성 등 상세 기록용)
  - students 테이블에 `time_slot` ENUM, `memo` TEXT 컬럼 추가
  - 시즌 등록 페이지: **모든 학생** 시간대 다중 선택 가능 (기존: 고3/N수만)
  - 시즌 상세 페이지: 납부상태/할인금액 표시 개선
- **v2.6.0** (2025-12-08): 모바일 PWA 앱 추가
  - PWA(Progressive Web App) 지원 - 홈 화면에 앱 아이콘 추가 가능
  - 모바일 전용 페이지 `/m/*` 경로 추가
  - `/m` - 모바일 홈 (메뉴 3개: 출석/강사/미납)
  - `/m/attendance` - 학생 출석체크 (날짜/시간대 선택, 전체 출석 버튼)
  - `/m/instructor` - 강사 출근체크 (시간대별 출근/지각/반차/결근)
  - `/m/unpaid` - 미납자 확인 (전화걸기 버튼 `tel:` 링크)
  - 권한: `schedules.edit` (출석/강사), `payments.view` (미납)
  - manifest.json, 아이콘 72~512px 생성
  - @ducanh2912/next-pwa 패키지 사용
- **v2.5.12** (2025-12-08): 리포트/학생통계 퇴원생 제외 처리
  - 리포트 - 총 학생 수: 퇴원생/체험생 제외 (재원+휴원+졸업만)
  - 리포트 - 학생현황: "휴원/졸업" → "휴원생"만 표시
  - 리포트 - 청구금액: 퇴원생 결제 제외 (재원생만 집계)
  - 학생 통계 카드: 전체 학생 수에서 퇴원생/체험생 제외
  - DB: students 테이블에 withdrawal_reason 컬럼 추가
- **v2.5.11** (2025-12-08): 상담 달력 모달 UI 개선
  - 모달 패딩값 추가 (py-4 px-6)
  - 시간대 라벨을 파란색 pill 형태로 변경
  - 상담 카드에 상태 점(dot) 추가
  - 카드 hover 시 배경색 변경 효과 추가
  - 전체적인 간격 조정으로 가독성 향상
- **v2.5.10** (2025-12-08): 성적 정보 필수 입력 + 상담 달력 페이지
  - 상담 신청 폼 성적 정보(내신 평균등급, 입시 유형, 모의고사 4과목) 필수 입력으로 변경
  - "미응시" 옵션 추가 (값: -1) - 시험을 안 본 경우 선택
  - 상담 달력 페이지 추가 (`/consultations/calendar`)
  - 상담 관리 페이지에 "달력 보기" 버튼 추가
  - 월별 상담 일정 달력 형태로 확인 가능
  - 날짜 클릭 시 해당일 상담 목록 모달로 표시
- **v2.5.9** (2025-12-08): 상담 상세 성적 정보 조건부 표시
  - 성적 정보 입력 안 했으면 성적 정보 섹션 자체를 숨김
- **v2.5.8** (2025-12-08): 상담 상세에서 학부모 정보 제거
  - 상담 신청 폼에서 학부모 정보를 안 받으므로 상세 화면에서도 제거
  - 목록/상세에서 학생 연락처만 표시 (student_phone || parent_phone)
- **v2.5.7** (2025-12-08): 수입 페이지도 paid_date 기준으로 변경
  - 수입 관리 페이지에서 학원비 수납 내역을 실제 납부일(paid_date) 기준으로 조회
  - 12월에 납부하면 12월 수입 페이지에 표시
- **v2.5.6** (2025-12-08): 리포트 수납/미수납 계산 수정
  - 11월 청구건을 12월에 납부하면 → 11월 미수납이 0원으로 표시되도록 수정
  - 청구 금액: due_date 기준 (해당 월에 청구된 금액)
  - 수납 완료: 청구건 중 payment_status='paid'인 금액 (수납률 계산용)
  - 미수납: 청구 금액 - 수납 완료
  - 총 수입(매출): paid_date 기준 (해당 월에 실제 입금된 금액)
- **v2.5.5** (2025-12-08): 리포트 매출 집계 기준 변경 (paid_date 기준)
  - 기존: due_date(납부기한) 기준 → 12월 결제해도 11월 매출로 잡힘
  - 변경: paid_date(실제 납부일) 기준 → 결제한 달에 매출로 잡힘
  - 백엔드에 paid_year, paid_month 파라미터 추가
  - 청구 금액은 due_date 기준, 수납 금액(매출)은 paid_date 기준으로 분리
- **v2.5.4** (2025-12-08): 상담 페이지 브라우저 타이틀 동적 변경
  - 상담 신청 페이지(`/c/[slug]`)에서 학원 이름으로 타이틀 표시 (예: "IMAX 체대입시 - 상담 예약")
  - 기존: "P-ACA - 체육입시학원관리시스템" 고정 → 변경: 학원별 이름 동적 표시
  - 성공 페이지도 동일하게 학원 이름 표시
- **v2.5.3** (2025-12-08): 리포트 평균 월 수강료 개선
  - 리포트 "평균 월 수강료" 계산 방식 변경: 재원생 기준, 0원 제외
  - 기존: 납부금액 / 재원생 수 → 변경: 재원생의 monthly_tuition 평균 (0원 학생 제외)
- **v2.5.2** (2025-12-08): 강사 성별 추가
- **v2.5.1** (2025-12-07): 체험생 status 분리, 성별 표시/필터 추가
  - 체험생 status = 'trial' 추가 (기존: is_trial + active → 이제: status = 'trial')
  - 학생 목록 테이블에 성별 컬럼 추가
  - 학생 아이콘 성별 색상: 남자 파란색, 여자 분홍색
  - 성별 필터 추가
- **v2.5.0** (2025-12-06): 상담 → 체험 등록 완성
  - 상담 진행 페이지에서 체크리스트/메모 저장 시 상태 '완료'로 자동 변경
  - 체험 등록 시 학생 전화번호 입력 필드 추가 (선택, 없으면 학부모 번호 사용)
  - 체험 일정 개수 동적 추가/삭제 (2개 고정 → 1개 이상 자유롭게)
  - 같은 날 체험 일정 중복 선택 방지
  - 체험 등록 시 스케줄에 자동 배정 (time_slot 한글→영어 변환: 오전→morning, 오후→afternoon, 저녁→evening)
  - 대시보드 재원생 수에서 체험생 제외
  - 체험생 삭제 시 통계 카드 즉시 갱신
  - 체험 횟수 표시: 등록된 일정 수 기준으로 동적 표시 (2/2 고정 → N/N)
  - 체크리스트 JSON 파싱 추가 (GET /consultations/:id)
- **v2.3.2** (2025-12-06): 상담 시스템 개선
  - 스케줄 캘린더에 상담 예약 표시 (📞 아이콘)
  - 상담 직접 등록 시 시간 중복 체크
  - 시간 프리셋 버튼 추가 (9시~19시)
  - 상담 운영 시간 일괄 설정 기능 (전체 적용/평일만 적용)
- **v2.3.1** (2025-12-06): 스케줄-상담 연동
  - 스케줄 페이지에서 상담 데이터 조회
  - 캘린더에 날짜별 상담 예약 개수 표시
- **v2.3.0** (2025-12-06): 상담 → 체험 연계 기능
  - 관리자 직접 상담 등록 (전화상담 등 직접 예약)
  - 상담 진행 체크리스트 + 메모 기능
  - 상담 완료 → 체험 학생 등록 플로우
  - 체험 일정 선택 (날짜 2개 + 시간대 오전/오후/저녁)
  - consultations 테이블에 checklist, consultation_memo 컬럼 추가
- **v2.2.2** (2025-12-06): Select 컴포넌트 버그 수정
  - 드롭다운 토글 동작 수정
  - 초기값 placeholder 표시 수정
- **v2.2.1** (2025-12-06): 상담 시스템 버그 수정
  - 공개 상담 페이지 사이드바 제거 (LayoutWrapper)
  - 상담 신청 폼 필수 필드 수정 (학생 정보만, 학부모 정보 선택)
  - 내신 평균등급, 입시유형(수시/정시) 필드 추가
  - 모의고사 등급 4과목(국/수/영/탐) 개별 입력
  - Select 컴포넌트 라벨 표시 수정 (value 대신 label 표시)
  - 모달 내 드롭다운 z-index 수정
  - JSON 필드 파싱 오류 수정 (백엔드)
- **v2.2.0** (2025-12-06): 상담 예약 시스템
  - 공개 상담 신청 페이지 (`/c/[slug]`) - 로그인 없이 학부모가 상담 신청
  - 학원별 고유 URL slug 설정
  - 요일별 운영 시간 설정 (00:00~24:00 범위 자유 설정)
  - 특정 날짜 차단 기능
  - 30분 단위 시간 슬롯 선택
  - 상담 신청 정보: 학부모/학생 정보, 내신/모의고사 등급, 백분위, 목표학교, 추천원생, 알게된경로
  - 관리자 상담 목록/상세 조회
  - 상담 상태 관리 (대기중/확정/완료/취소/노쇼)
  - 기존 학생 자동 연결 (전화번호 매칭)
- **v2.1.0** (2025-12-05): 솔라피 자동발송 기능
  - 오늘 수업 있는 미납자에게만 알림톡 자동 발송
  - 학원별 발송 시간 설정 (solapi_auto_hour)
  - n8n 워크플로우 연동 (매시간 트리거)
  - 학원별 솔라피 API 키, 템플릿, 채널 ID 사용
- **v2.0.2** (2025-12-04): 학생 관리 UI 개선
  - 학생 통계 카드: 전체 학생 현황 표시 (탭과 무관하게 고정)
  - 체험생 카드 추가 (전체, 재원, 휴원, 졸업, 체험 5개)
  - 필터 초기화 버튼 수정 (탭에서 관리하는 status 필터 숨김)
  - 초기화 시 검색어도 함께 초기화
- **v2.0.1** (2025-12-04): 버그 수정
  - DB ENUM에 lms, mms 추가
  - message_type 소문자 변환 처리
  - tuition_due_day를 academy_settings 테이블에서 조회하도록 수정
- **v2.0.0** (2025-12-03): 알림톡/SMS 멀티 서비스 지원 (네이버 SENS + 솔라피)
  - 서비스 선택 UI (SENS/솔라피 탭)
  - 각 서비스별 API 키, 템플릿 별도 관리
  - SENS/솔라피 각각 독립적 활성화 (is_enabled, solapi_enabled)
  - SENS: 자동 발송 스케줄러 (날짜/시간 설정)
  - 솔라피: n8n 워크플로우 연동용 (자동발송 스케줄 n8n에서 관리)
  - 솔라피 가이드 추가
  - SMS/MMS 발송도 서비스 타입에 따라 분기 (SENS/솔라피)
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

## 문서 목록

| 문서 | 경로 | 설명 |
|------|------|------|
| 서버 이전 가이드 | `docs/SERVER-MIGRATION.md` | cafe24 → sean-mini-server 이전 가이드 |
| 암호화 설계 | `docs/SECURITY-ENCRYPTION.md` | 다중 학원 데이터 암호화 설계 (Zero-knowledge 구조) |
| Tally API | `/home/sean/tallyform/README.md` | Tally 설문 API 사용법 |

### 암호화 문서 요약 (`docs/SECURITY-ENCRYPTION.md`)
- **현재 상태**: 암호화 없음, admin이 모든 학원 데이터 열람 가능
- **추천 구조**: 마스터 키 + 래핑 키 (사용자 비밀번호 기반)
- **구현 우선순위**: Phase 1 (기본 암호화) → Phase 2 (학원별 키) → Phase 3 (Zero-knowledge)
- **비용**: 직접 구현 (무료) 추천, HashiCorp Vault/AWS KMS는 소규모엔 과함
