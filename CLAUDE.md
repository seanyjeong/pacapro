# CLAUDE.md - P-ACA 개발 가이드

## 프로젝트 개요

**P-ACA** = **P**hysical **A**cademy **C**omprehensive **A**dministration
체대입시 학원 종합관리 시스템

### 자매 시스템
| 시스템 | 발음 | 풀네임 | 역할 |
|--------|------|--------|------|
| **P-ACA** | 파카 | Physical Academy Comprehensive Administration | 학원 종합관리 |
| **P-EAK** | 피크 | Physical Excellence Achievement Keeper | 실기 훈련관리 |

> "파카로 학원 관리, 피크로 기록 정점!"

---

- **프론트**: Next.js 15 + TailwindCSS (Vercel: pacapro.vercel.app)
- **백엔드**: Express.js + MySQL (로컬: chejump.com:8320)

## 배포

### 프론트엔드 (Vercel)
```bash
git add . && git commit -m "메시지" && git push  # 자동 배포
```

### 백엔드 (로컬 서버)
```bash
# 재시작 (sudo 비밀번호 자동 입력)
echo 'q141171616!' | sudo -S systemctl restart paca

# 로그 확인
echo 'q141171616!' | sudo -S journalctl -u paca -f
```

### sudo 팁 (안 될 때)
```bash
# -k 옵션 추가하면 캐시된 자격증명 초기화되어 더 안정적
echo 'q141171616!' | sudo -S -k docker stop container_name

# 여러 명령 연속 실행 시 sh -c 사용
echo 'q141171616!' | sudo -S sh -c "docker stop x && docker rm x"
```

### 개발 서버 (실시간 프리뷰)
```bash
# dev 서버 시작
npm run dev -- -H 0.0.0.0

# 접속 URL
https://dev.sean8320.dedyn.io
```

**개발 워크플로우:**
1. code-server에서 코드 수정
2. 저장 (Ctrl+S)
3. `dev.sean8320.dedyn.io` 새로고침 → 바로 확인 (Hot Reload)
4. 잘 되면 git push → Vercel 배포

**테스트 계정:** `admin@paca.com` / `0000`

### DB 접근 (CLI가 안 될 때 Node.js 사용)
```bash
# CLI 방식 (비밀번호에 ! 있어서 불안정)
mysql -u paca -pq141171616! paca

# Node.js 방식 (안정적 - CLI 안 될 때 사용)
node -e "
const mysql = require('./backend/node_modules/mysql2/promise');
async function run() {
    const conn = await mysql.createConnection({
        host: 'localhost', user: 'paca',
        password: 'q141171616!', database: 'paca'
    });
    const [rows] = await conn.execute('SELECT * FROM students LIMIT 1');
    console.log(rows);
    await conn.end();
}
run();
"
```

> **참고**: MySQL CLI에서 `year_month` 같은 예약어는 백틱(\`)으로 감싸야 함

---

## 🚨 버전 업데이트 필수! (배포 시 4곳 수정)

```
1. package.json                        → "version": "x.x.x"
2. src/components/version-checker.tsx  → APP_VERSION = 'x.x.x'
3. src/components/layout/sidebar.tsx   → P-ACA vx.x.x + 날짜
4. src/app/settings/page.tsx           → vx.x.x + 날짜
```

**버전 안 올리면 브라우저에 새 버전 적용 안 됨!**

---

## 주의사항

### 기존 코드 수정 금지
```
✅ 허용: 새 파일 생성, 새 라우트 추가, 새 컬럼 추가
❌ 금지: 기존 API 수정, 기존 컴포넌트 변경, 컬럼 삭제
```

### 학생 상태 (status)
| 상태 | 스케줄 | 학원비 | 진급 |
|------|--------|--------|------|
| active | O | O | O |
| paused | X | X | O |
| withdrawn | X | X | X |
| graduated | X | X | X |
| trial | O | X | X |
| pending | X | X | X |

### time_slot 변환
DB는 영어(`morning/afternoon/evening`), 프론트는 한글(`오전/오후/저녁`)

### Dialog 패딩
모달 본문에 `py-6 px-6` 필수

---

## 보안 (Phase 1 완료)

민감정보 AES-256-GCM 암호화:
- students: name, phone, parent_phone, address
- instructors: name, phone, address, resident_number, account_number, account_holder
- users: name, phone

상세: `docs/SECURITY-ENCRYPTION.md`

### 복호화 작업 현황 (2025-12-13 기준)

| 라우터 | 상태 | 복호화 필드 |
|--------|------|-------------|
| students.js | ✅ 완료 | name, phone, parent_phone, address |
| instructors.js | ✅ 완료 | name, phone, address, resident_number, account_number, account_holder |
| schedules.js | ✅ 완료 | student_name, instructor_name |
| payments.js | ✅ 완료 | student_name |
| salaries.js | ✅ 완료 | instructor_name |
| consultations.js | ✅ 완료 | student_name |
| users.js | ✅ 완료 | name, phone |
| seasons.js | ✅ 완료 | student_name, student_phone, parent_phone |
| staff.js | ✅ 완료 | name, instructor_name, phone |
| reports.js | ✅ 완료 | student_name, phone, parent_phone |
| exports.js | ✅ 완료 | student_name, instructor_name |
| search.js | ✅ 완료 | name, phone (메모리 필터링) |
| performance.js | ✅ 완료 | student_name |
| classes.js | ✅ 완료 | instructor_name |
| auth.js | ✅ 완료 | name |
| notifications.js | ⏳ 검토필요 | - |
| sms.js | ⏳ 검토필요 | - |
| public.js | ⏳ 검토필요 | - |

**주의**: 암호화된 필드는 SQL LIKE 검색 불가 → 메모리 필터링 필요

---

## 주요 파일

| 기능 | 백엔드 | 프론트 |
|------|--------|--------|
| 학생 | backend/routes/students.js | src/app/students/ |
| 강사 | backend/routes/instructors.js | src/app/instructors/ |
| 학원비 | backend/routes/payments.js | src/app/payments/ |
| 급여 | backend/routes/salaries.js | src/app/salaries/ |
| 스케줄 | backend/routes/schedules.js | src/app/schedules/ |
| 시즌 | backend/routes/seasons.js | src/app/seasons/ |
| 상담 | backend/routes/consultations.js | src/app/consultations/ |
| 암호화 | backend/utils/encryption.js | - |

---

## 자동화 (스케줄러)

### n8n 워크플로우
| 워크플로우 | 트리거 | 설명 |
|------------|--------|------|
| P-ACA 학생 동기화 | 매일 9시 | Google Sheets 동기화 |
| p-aca미납자알림 | 매일 9시 | 카카오톡 미납 알림 |
| P-ACA 솔라피 자동발송 | 매시간 | 솔라피 미납자 알림톡 (설정 시간에 발송) |
| P-ACA 체험수업 자동발송 | 매시간 | 솔라피 체험수업 알림톡 (설정 시간에 발송) |
| PACA Backend Auto Deploy | GitHub push | 백엔드 자동 배포 |

### 백엔드 스케줄러 (node-cron)
| 파일 | 트리거 | 설명 |
|------|--------|------|
| paymentScheduler.js | 매월 1일 | 월별 학원비 자동 생성 |
| notificationScheduler.js | 매시간 | SENS 알림톡 자동발송 |
| gradePromotionScheduler.js | 매년 3/1 01:00 | 학년 자동 진급 |
| pushScheduler.js | 매일 18:00, 21:00 | PWA 푸시 알림 (미납자 출석 알림) |

---

## 현재 버전: v3.0.3 (2025-12-19)

### 최근 변경
- **v3.0.3**: 미등록관리 학생 탭 추가 (상담 완료 → 미등록관리 or 체험, 체험 완료 → 미등록관리 자동 전환)
- **v3.0.2**: 납부 안내/미납자 알림톡 버튼/이미지 설정 UI 추가, 이미지 URL 설명 통일
- **v3.0.1**: 알림톡 설정 UI 대폭 개선 - 통합 발송 설정, 접기/펼치기, 미납자 알림톡 테스트 발송
- **v2.10.0**: 체험수업 알림톡 자동발송 기능 (n8n 워크플로우 + 백엔드 API)
- **v2.9.25**: 알림톡 템플릿 UI 탭 방식 변경, 체험수업 알림톡 템플릿 추가
- **v2.9.24**: 알림톡 버튼/이미지 설정, 버튼 링크 변수 치환 수정
- **v2.9.23**: 상담예약 페이지 학원명 표시, 상담확정 알림톡 테스트 기능
- **v2.9.22**: 푸시 알림 기능 확장
- **v2.9.21**: PWA 푸시 알림 기능 (미납자 출석 알림)
- **v2.9.20**: 솔라피 알림톡 금액 소수점 제거
- **v2.9.19**: 휴원 종료 대기 학생 관리
- **v2.9.x**: 다크모드, 출결 사유 UI, 비밀번호 찾기 등
- **v2.8.x**: 급여 비밀번호 확인, 재계산
- **v2.7.x**: 시즌 환불, 할인 시스템
- **v2.6.0**: 모바일 PWA
- **v2.5.x**: 상담 예약 시스템
- **v2.0.0**: 알림톡 멀티 서비스 (SENS + 솔라피)

### 버전 규칙
- **Major (x.0.0)**: 대규모 시스템 변경 (DB 이전, 아키텍처 변경 등)
- **Minor (0.x.0)**: 새 기능 추가
- **Patch (0.0.x)**: 버그 수정, 자잘한 개선

---

## 문서

| 문서 | 설명 |
|------|------|
| docs/PACA-RULES.md | 학원 운영 규정집 |
| docs/SECURITY-ENCRYPTION.md | 암호화 설계 |
| docs/SERVER-MIGRATION.md | 서버 이전 가이드 |
| docs/EXCUSED-CREDIT-FEATURE.md | 공결 크레딧 자동화 (TODO: 사유 입력 UI) |

---

## TODO: SENS 알림톡 솔라피와 동일하게 개선 (예정)

### 목표
SENS(네이버)도 솔라피와 완전 동일한 시스템으로 통일

### 작업 목록

#### 1. 백엔드 (notifications.js)
- [ ] SENS용 템플릿 별 설정 추가 (납부 안내, 미납자, 상담확정, 체험수업)
- [ ] SENS용 버튼/이미지 설정 필드 추가
- [ ] SENS 자동발송 로직을 솔라피와 동일하게 변경 (수업 있는 날 발송)
- [ ] SENS 테스트 발송 API 추가 (각 템플릿별)

#### 2. 프론트엔드 (notifications/page.tsx)
- [ ] SENS 탭에 템플릿별 탭 추가 (납부 안내, 미납자, 상담확정, 체험수업)
- [ ] 각 템플릿별 버튼/이미지 설정 UI 추가
- [ ] 각 템플릿별 테스트 발송 UI 추가
- [ ] 발송 설정 UI 통일 (시간 설정, 활성화 토글)

#### 3. n8n 워크플로우
- [ ] 현재 SENS 워크플로우 확인 (날짜별 발송 → 수업일 발송으로 변경)
- [ ] 솔라피 워크플로우와 동일한 로직으로 수정
- [ ] 미납자, 체험수업 자동발송 추가

#### 4. DB 스키마
- [ ] SENS용 템플릿 설정 컬럼 추가 (필요시)

#### 5. API (notifications.ts)
- [ ] SENS용 테스트 발송 함수 추가
- [ ] TypeScript 인터페이스 업데이트

### 참고
- 솔라피 현재 구조: 납부 안내 / 미납자 / 상담확정 / 체험수업 4개 템플릿
- 각 템플릿별 ID, 본문, 버튼, 이미지 URL 설정 가능
- 자동발송: 수업 있는 날 지정 시간에 발송
