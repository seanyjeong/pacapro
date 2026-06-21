# pacapro API-SPEC

Express 4 기반. prefix `/paca/*`. JWT (authMiddleware) + rate limiter.

> **Last Updated**: 2026-04-15

## 미들웨어 스택 (`paca.js`)
```js
app.use(cors(corsOptions));
app.use(helmet({...}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(compression());
app.use(morgan('dev' | 'combined'));  // dev vs prod

// Rate limiting
app.use('/paca/auth/login', loginLimiter);      // 로그인 시도 제한
app.use('/paca/public', publicLimiter);         // 공개 API 제한
app.use('/paca', generalLimiter);               // 전체 제한
```

## 헬스체크
- `GET /health` — 단순 200 응답 (페일오버가 사용)
- `GET /paca` — API 루트 정보

## 라우트 모듈 자동 마운트
`paca.js`에서 `routes/` 디렉토리 스캔 후 각 모듈을 prefix와 함께 마운트:
- camelCase 파일명 → kebab-case URL prefix 변환
- 예: `academyEvents.js` → `/paca/academy-events`
- 디렉토리는 `index.js`가 있으면 마운트 (subdelegation 패턴)

**제외 목록** (`ROUTE_EXCLUDE`): `classes.js` (미사용)

---

## 전체 라우트 모듈 목록 (28개)

### 단일 파일 모듈 (25개)
| 파일 | URL Prefix | 설명 |
|------|------------|------|
| `academyEvents.js` | `/paca/academy-events` | 학원 일정/이벤트 |
| `auth.js` | `/paca/auth` | 인증 (로그인/회원가입/JWT) |
| `consultations.js` | `/paca/consultations` | 신규상담 (예약/설정) |
| `expenses.js` | `/paca/expenses` | 지출 관리 |
| `exports.js` | `/paca/exports` | 엑셀 내보내기 |
| `incomes.js` | `/paca/incomes` | 기타수입 관리 |
| `instructors.js` | `/paca/instructors` | 강사 관리 |
| `jungsi.js` | `/paca/jungsi` | 정시엔진 연동 (성적 조회) |
| `notificationSettings.js` | `/paca/notification-settings` | 알림 설정 (글로벌) |
| `onboarding.js` | `/paca/onboarding` | 온보딩 |
| `payments.js` | `/paca/payments` | 결제/학원비 |
| `performance.js` | `/paca/performance` | 성적 (모의고사/내신) |
| `public.js` | `/paca/public` | 공개 API (상담 신청) |
| `push.js` | `/paca/push` | 웹푸시 |
| `reports.js` | `/paca/reports` | 리포트/대시보드 |
| `salaries.js` | `/paca/salaries` | 급여 관리 |
| `schedules.js` | `/paca/schedules` | 스케줄/출결 |
| `search.js` | `/paca/search` | 통합 검색 |
| `seasons.js` | `/paca/seasons` | 시즌/특강 |
| `settings.js` | `/paca/settings` | 학원 설정 |
| `sms.js` | `/paca/sms` | SMS 발송 |
| `staff.js` | `/paca/staff` | 직원 관리 |
| `student-consultations.js` | `/paca/student-consultations` | 재원생 상담기록 |
| `toss.js` | `/paca/toss` | Toss Payments 연동 |
| `users.js` | `/paca/users` | 사용자 관리 |

### 디렉토리 모듈 (2개)
| 디렉토리 | URL Prefix | 서브모듈 |
|----------|------------|----------|
| `students/` | `/paca/students` | crud, classDays, enrollment, rest, credits, attendance |
| `notifications/` | `/paca/notifications` | settings, logs, test, send |

---

## 상세 엔드포인트

### Auth (`/paca/auth`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/register` | 회원가입 | Public |
| POST | `/login` | 로그인 | Public |
| GET | `/me` | 내 정보 조회 | JWT |
| POST | `/change-password` | 비밀번호 변경 | JWT |
| POST | `/verify-password` | 비밀번호 확인 | JWT |
| POST | `/forgot-password` | 비밀번호 찾기 | Public |
| POST | `/reset-password` | 비밀번호 재설정 | Public |
| GET | `/verify-reset-token` | 재설정 토큰 확인 | Public |

### Students (`/paca/students`)
**CRUD** (`crud.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 전체 학생 목록 | JWT |
| GET | `/:id` | 학생 상세 | JWT |
| POST | `/` | 학생 등록 | students:edit |
| PUT | `/:id` | 학생 수정 | students:edit |
| DELETE | `/:id` | 학생 삭제 | owner |
| GET | `/search` | 학생 검색 | JWT |

**수업일** (`classDays.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/class-days` | 수업일 현황 | class_days:view |
| PUT | `/class-days/bulk` | 수업일 일괄변경 | class_days:edit |
| PUT | `/:id/class-days` | 개별 수업일 변경 | class_days:edit |
| DELETE | `/:id/class-days-schedule` | 스케줄 삭제 | class_days:edit |

**입학/휴원** (`enrollment.js`, `rest.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/rest-ended` | 휴원종료 학생 | owner/admin/staff |
| POST | `/:id/withdraw` | 퇴원 처리 | students:edit |
| POST | `/grade-upgrade` | 학년 진급 | students:edit |
| POST | `/auto-promote` | 자동 진급 | owner |
| GET | `/:id/seasons` | 학생 시즌 조회 | JWT |
| POST | `/:id/process-rest` | 휴원 처리 | students:edit |
| POST | `/:id/resume` | 복원 처리 | students:edit |

**선차감/크레딧** (`credits.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/:id/rest-credits` | 휴원 크레딧 | JWT |
| POST | `/:id/manual-credit` | 수동 크레딧 추가 | payments:edit |
| GET | `/:id/credits` | 크레딧 목록 | JWT |
| PUT | `/:id/credits/:creditId` | 크레딧 수정 | payments:edit |
| DELETE | `/:id/credits/:creditId` | 크레딧 삭제 | payments:edit |
| POST | `/:id/credits/:creditId/apply` | 크레딧 적용 | payments:edit |

**출결** (`attendance.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/:id/attendance` | 출결 조회 | JWT |

### Consultations (`/paca/consultations`)
**신규상담 관리**
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 상담 목록 | JWT |
| GET | `/:id` | 상담 상세 | JWT |
| PUT | `/:id` | 상담 수정 | JWT |
| DELETE | `/:id` | 상담 삭제 | JWT |
| GET | `/by-student/:studentId` | 학생별 상담 | JWT |
| GET | `/booked-times` | 예약된 시간 | JWT |
| POST | `/direct` | 직접 상담 등록 | JWT |
| POST | `/:id/link-student` | 학생 연결 | JWT |
| POST | `/:id/convert-to-trial` | 체험 전환 | JWT |
| POST | `/:id/convert-to-pending` | 대기 전환 | JWT |
| POST | `/learning` | 학습상담 등록 | JWT |

**상담 설정**
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/settings/info` | 설정 조회 | JWT |
| PUT | `/settings/info` | 설정 수정 | JWT |
| PUT | `/settings/weekly-hours` | 주간 가용시간 | JWT |
| POST | `/settings/blocked-slots` | 차단 슬롯 추가 | JWT |
| DELETE | `/settings/blocked-slots/:id` | 차단 슬롯 삭제 | JWT |
| GET | `/calendar/events` | 캘린더 이벤트 | JWT |

### Student Consultations (`/paca/student-consultations`)
**재원생 상담기록 + 신규상담 통합**
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/calendar` | 상담 캘린더 | JWT |
| GET | `/:studentId` | 학생별 상담목록 (재원생 + 신규상담 통합) | JWT |
| GET | `/:studentId/peak-records` | Peak 실기기록 | JWT |
| GET | `/:studentId/compare/:id` | 상담 비교 | JWT |
| GET | `/:studentId/:id` | 상담 상세 | JWT |
| POST | `/` | 상담 등록 | JWT |
| PUT | `/:id` | 상담 수정 | JWT |
| DELETE | `/:id` | 상담 삭제 | JWT |

**GET `/:studentId` 응답**
```json
{
  "consultations": [...],           // 재원생 상담 (student_consultations)
  "initialConsultations": [...]     // 신규상담 (consultations, linked_student_id 연결)
}
```

### Payments (`/paca/payments`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 결제 목록 | payments:view |
| GET | `/:id` | 결제 상세 | payments:view |
| POST | `/` | 결제 생성 | payments:edit |
| PUT | `/:id` | 결제 수정 | payments:edit |
| DELETE | `/:id` | 결제 삭제 | owner |
| GET | `/unpaid` | 미납 목록 | payments:view |
| GET | `/unpaid-today` | 오늘 미납 | JWT |
| POST | `/:id/pay` | 결제 처리 | payments:edit |
| POST | `/bulk-monthly` | 월 학원비 일괄생성 | payments:edit |
| GET | `/credits` | 크레딧 목록 | payments:view |
| GET | `/credits/summary` | 크레딧 요약 | payments:view |
| GET | `/stats/summary` | 결제 통계 | payments:view |
| POST | `/generate-prorated` | 일할계산 생성 | payments:edit |
| POST | `/generate-monthly-for-student` | 학생별 월 결제 | payments:edit |
| POST | `/prepaid-preview` | 선납 미리보기 | JWT |
| POST | `/prepaid-pay` | 선납 결제 | JWT |

### Toss (`/paca/toss`)
**Toss Payments 연동**
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/unpaid` | 미납 (플러그인) | TossPlugin |
| GET | `/student/:id` | 학생 정보 (플러그인) | TossPlugin |
| POST | `/payment-callback` | 결제 콜백 | Signature |
| POST | `/cancel-callback` | 취소 콜백 | Signature |
| GET | `/history` | 결제 내역 | payments:view |
| GET | `/queue` | 대기열 | payments:view |
| POST | `/queue/:id/match` | 매칭 | payments:edit |
| POST | `/queue/:id/ignore` | 무시 | payments:edit |
| GET | `/stats` | 통계 | payments:view |
| GET | `/settings` | 설정 조회 | settings:view |
| PUT | `/settings` | 설정 수정 | settings:edit |

### Schedules (`/paca/schedules`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 스케줄 목록 | JWT |
| GET | `/:id` | 스케줄 상세 | JWT |
| POST | `/` | 스케줄 생성 | schedules:edit |
| PUT | `/:id` | 스케줄 수정 | schedules:edit |
| DELETE | `/:id` | 스케줄 삭제 | schedules:edit |
| GET | `/instructor/:instructor_id` | 강사별 스케줄 | JWT |
| GET | `/slot` | 슬롯 조회 | JWT |
| POST | `/slot/student` | 학생 슬롯 추가 | schedules:edit |
| DELETE | `/slot/student` | 학생 슬롯 삭제 | schedules:edit |
| POST | `/slot/move` | 슬롯 이동 | schedules:edit |
| PUT | `/:id/assign-instructor` | 강사 배정 | schedules:edit |
| GET | `/:id/attendance` | 출결 조회 | JWT |
| POST | `/:id/attendance` | 출결 기록 | JWT |
| GET | `/:id/instructor-attendance` | 강사 출결 | JWT |
| POST | `/:id/instructor-attendance` | 강사 출결 기록 | schedules:edit |
| GET | `/date/:date/instructor-attendance` | 날짜별 강사 출결 | JWT |
| POST | `/date/:date/instructor-attendance` | 날짜별 강사 출결 기록 | schedules:edit |
| GET | `/date/:date/instructor-schedules` | 날짜별 강사 스케줄 | schedules:view |
| POST | `/date/:date/instructor-schedules` | 날짜별 강사 스케줄 생성 | schedules:edit |
| GET | `/instructor-schedules/month` | 월별 강사 스케줄 | schedules:view |
| POST | `/fix-all` | 전체 수정 | owner |

### Instructors (`/paca/instructors`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 강사 목록 | instructors:view |
| GET | `/:id` | 강사 상세 | instructors:view |
| POST | `/` | 강사 등록 | instructors:edit |
| PUT | `/:id` | 강사 수정 | instructors:edit |
| DELETE | `/:id` | 강사 삭제 | instructors:edit |
| POST | `/:id/attendance` | 출근 기록 | JWT |
| GET | `/:id/attendance` | 출근 조회 | instructors:view |
| GET | `/overtime/pending` | 야근 승인 대기 | overtime_approval:view |
| GET | `/overtime/history` | 야근 내역 | instructors:view |
| PUT | `/overtime/:approvalId/approve` | 야근 승인 | overtime_approval:edit |
| POST | `/verify-admin-password` | 관리자 비번 확인 | instructors:edit |
| POST | `/:id/overtime` | 야근 등록 | overtime_approval:edit |

### Salaries (`/paca/salaries`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 급여 목록 | salaries:view |
| GET | `/:id` | 급여 상세 | salaries:view |
| GET | `/work-summary/:instructorId/:yearMonth` | 근무 요약 | salaries:view |
| POST | `/calculate` | 급여 계산 | salaries:edit |
| POST | `/` | 급여 생성 | salaries:edit |
| POST | `/:id/recalculate` | 재계산 | salaries:edit |
| POST | `/:id/pay` | 급여 지급 | owner |
| PUT | `/:id` | 급여 수정 | owner |
| POST | `/bulk-pay` | 일괄 지급 | owner |
| DELETE | `/:id` | 급여 삭제 | owner |

### Seasons (`/paca/seasons`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 시즌 목록 | JWT |
| GET | `/active` | 활성 시즌 | JWT |
| GET | `/:id` | 시즌 상세 | JWT |
| POST | `/` | 시즌 생성 | seasons:edit |
| PUT | `/:id` | 시즌 수정 | seasons:edit |
| DELETE | `/:id` | 시즌 삭제 | owner |
| POST | `/:id/enroll` | 시즌 등록 | seasons:edit |
| GET | `/:id/students` | 시즌 학생 | JWT |
| DELETE | `/:id/students/:student_id` | 등록 취소 | seasons:edit |
| GET | `/:id/preview` | 미리보기 | seasons:edit |
| POST | `/enrollments/:enrollment_id/pay` | 등록 결제 | seasons:edit |
| PUT | `/enrollments/:enrollment_id` | 등록 수정 | seasons:edit |
| POST | `/enrollments/:enrollment_id/refund-preview` | 환불 미리보기 | seasons:edit |
| POST | `/enrollments/:enrollment_id/cancel` | 등록 취소 | seasons:edit |

### Notifications (`/paca/notifications`)
**설정** (`settings.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/settings` | 알림 설정 조회 | notifications:view |
| PUT | `/settings` | 알림 설정 수정 | notifications:edit |

**로그** (`logs.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/logs` | 알림 로그 | notifications:view |
| GET | `/stats` | 알림 통계 | notifications:view |

**테스트** (`test.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/test` | 테스트 발송 | notifications:edit |
| POST | `/test-consultation` | 상담 알림 테스트 | notifications:edit |
| POST | `/test-trial` | 체험 알림 테스트 | notifications:edit |
| POST | `/test-overdue` | 미납 알림 테스트 | notifications:edit |
| POST | `/test-reminder` | 리마인더 테스트 | notifications:edit |
| POST | `/test-sens-*` | SENS 채널 테스트 | notifications:edit |

**발송** (`send.js`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/send-unpaid` | 미납 알림 발송 | notifications:edit |
| POST | `/send-individual` | 개별 알림 발송 | notifications:edit |
| POST | `/send-unpaid-today-auto` | 자동 미납 알림 | JWT |
| POST | `/send-trial-today-auto` | 자동 체험 알림 | JWT |
| POST | `/send-reminder-auto` | 자동 리마인더 | Public |
| POST | `/send-*-sens` | SENS 채널 발송 | varies |

### Public (`/paca/public`)
**공개 상담 API (인증 불필요)**
| Method | Path | 설명 |
|--------|------|------|
| GET | `/consultation/:slug` | 상담 페이지 정보 |
| GET | `/consultation/:slug/slots` | 예약 가능 시간 |
| POST | `/consultation/:slug/apply` | 상담 신청 |
| GET | `/reservation/:reservationNumber` | 예약 조회 |
| PUT | `/reservation/:reservationNumber` | 예약 수정 |

### Expenses (`/paca/expenses`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 지출 목록 | expenses:view |
| GET | `/:id` | 지출 상세 | expenses:view |
| POST | `/` | 지출 등록 | expenses:edit |
| PUT | `/:id` | 지출 수정 | expenses:edit |
| DELETE | `/:id` | 지출 삭제 | expenses:edit |
| GET | `/summary/monthly` | 월별 요약 | expenses:view |
| GET | `/category/list` | 카테고리 목록 | expenses:view |

### Incomes (`/paca/incomes`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 수입 목록 | incomes:view |
| GET | `/:id` | 수입 상세 | incomes:view |
| POST | `/` | 수입 등록 | incomes:edit |
| PUT | `/:id` | 수입 수정 | incomes:edit |
| DELETE | `/:id` | 수입 삭제 | incomes:edit |
| GET | `/categories` | 카테고리 목록 | incomes:view |

### Reports (`/paca/reports`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/dashboard` | 대시보드 | owner/admin/staff |
| GET | `/financial/monthly` | 월별 재무 | reports:view |
| GET | `/financial/yearly` | 연별 재무 | reports:view |
| GET | `/students` | 학생 리포트 | reports:view |
| GET | `/instructors` | 강사 리포트 | reports:view |
| GET | `/attendance` | 출결 리포트 | reports:view |
| GET | `/payments/unpaid` | 미납 리포트 | reports:view |

### Exports (`/paca/exports`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/revenue` | 수입 엑셀 | reports:view |
| GET | `/expenses` | 지출 엑셀 | reports:view |
| GET | `/financial` | 재무 엑셀 | reports:view |
| GET | `/payments` | 결제 엑셀 | reports:view |
| GET | `/salaries` | 급여 엑셀 | reports:view |
| GET | `/students` | 학생 엑셀 | JWT |

### Settings (`/paca/settings`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 설정 조회 | JWT |
| PUT | `/` | 설정 수정 | settings:edit |
| GET | `/academy` | 학원 정보 | JWT |
| PUT | `/academy` | 학원 정보 수정 | settings:edit |
| GET | `/tuition-rates` | 수강료 설정 | JWT |
| PUT | `/tuition-rates` | 수강료 수정 | settings:edit |
| POST | `/reset-database` | DB 초기화 | owner |

### Staff (`/paca/staff`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 직원 목록 | owner |
| GET | `/:id` | 직원 상세 | owner |
| POST | `/` | 직원 등록 | owner |
| PUT | `/:id` | 직원 수정 | owner |
| DELETE | `/:id` | 직원 삭제 | owner |
| PUT | `/:id/permissions` | 권한 수정 | owner |
| GET | `/available-instructors` | 가용 강사 | owner |
| GET | `/permissions/pages` | 페이지 권한 목록 | owner |

### SMS (`/paca/sms`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/send` | SMS 발송 | sms:edit |
| GET | `/recipients-count` | 수신자 수 | JWT |
| GET | `/logs` | 발송 로그 | sms:view |
| GET | `/sender-numbers` | 발신번호 목록 | JWT |
| POST | `/sender-numbers` | 발신번호 등록 | sms:edit |
| PUT | `/sender-numbers/:id` | 발신번호 수정 | sms:edit |
| DELETE | `/sender-numbers/:id` | 발신번호 삭제 | sms:edit |

### Academy Events (`/paca/academy-events`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 이벤트 목록 | JWT |
| GET | `/:id` | 이벤트 상세 | JWT |
| POST | `/` | 이벤트 생성 | schedules:edit |
| PUT | `/:id` | 이벤트 수정 | schedules:edit |
| DELETE | `/:id` | 이벤트 삭제 | schedules:edit |

### Performance (`/paca/performance`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 성적 목록 | JWT |
| GET | `/:id` | 성적 상세 | JWT |
| GET | `/student/:student_id` | 학생별 성적 | JWT |
| POST | `/` | 성적 등록 | JWT |
| PUT | `/:id` | 성적 수정 | JWT |
| DELETE | `/:id` | 성적 삭제 | students:edit |

### Users (`/paca/users`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 사용자 목록 | owner/admin |
| GET | `/:id` | 사용자 상세 | owner/admin |
| GET | `/pending` | 승인 대기 | admin |
| POST | `/approve/:id` | 승인 | admin |
| POST | `/reject/:id` | 거부 | admin |

### Onboarding (`/paca/onboarding`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/status` | 온보딩 상태 | JWT |
| GET | `/data` | 온보딩 데이터 | JWT |
| POST | `/complete` | 완료 | owner |
| POST | `/sample-data` | 샘플 데이터 | owner |
| POST | `/skip` | 건너뛰기 | owner |

### Push (`/paca/push`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| POST | `/subscribe` | 구독 등록 | JWT |
| DELETE | `/unsubscribe` | 구독 해제 | JWT |
| POST | `/test` | 테스트 발송 | JWT |

### Search (`/paca/search`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 통합 검색 | JWT |

### Notification Settings (`/paca/notification-settings`)
| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/` | 글로벌 설정 조회 | Public |
| PUT | `/` | 글로벌 설정 수정 | Public |

### Jungsi (`/paca/jungsi`)
**정시엔진 연동 — 수능 성적 조회 및 학생 매칭**

| Method | Path | 설명 | 권한 |
|--------|------|------|------|
| GET | `/status` | 연동 상태 확인 | JWT |
| GET | `/scores/:studentId` | 학생 수능 성적 조회 | JWT |
| GET | `/match-preview` | 전체 학생 매칭 미리보기 | JWT |
| POST | `/link` | 학생 수동 연결 | JWT |

**쿼리 파라미터**
- `year`: 학년도 (기본값: '2026')
- `exam`: 시험 유형 (기본값: '수능')

**GET `/scores/:studentId` 응답**
```json
{
  "success": true,
  "matched": true,
  "confidence": "high",
  "matchMethod": "name+school+grade",
  "student": {
    "paca": { "id": 1, "name": "김철준", "school": "행신고", "grade": "고3" },
    "jungsi": { "student_id": 123, "student_name": "김철준", "school_name": "행신고등학교", "grade": "고3" }
  },
  "scores": {
    "year": "2026",
    "exam": "수능",
    "국어": { "선택과목": "화법과 작문", "원점수": 85, "표준점수": 135, "백분위": 92, "등급": "2" },
    "수학": { "선택과목": "미적분", "원점수": 88, "표준점수": 140, "백분위": 95, "등급": "1" },
    "영어": { "원점수": 95, "등급": "1" },
    "한국사": { "원점수": 48, "등급": "2" },
    "탐구1": { "선택과목": "생명과학I", "원점수": 45, "표준점수": 68, "백분위": 90, "등급": "2" },
    "탐구2": { "선택과목": "지구과학I", "원점수": 42, "표준점수": 65, "백분위": 85, "등급": "2" }
  }
}
```

**학생 매칭 로직**
1. 이름 + 학교 + 학년 완전 일치 (confidence: high)
2. 이름 + 학교 일치 (confidence: medium)
3. 이름만 일치 + 동명이인 없음 (confidence: low)

**학교명 정규화**: "행신고등학교" → "행신고"로 변환하여 매칭

**academy_id → branch_name 매핑**
- academy_id=2 → '일산'

---

## 응답 형태
- 성공: `{ success: true, data: ... }` 또는 raw JSON array
- 실패: `{ success: false, message: "..." }` + HTTP 4xx/5xx
- 에러: `{ error: "...", message: "..." }`

## CORS 허용 도메인
- `https://chejump.com`
- `https://dev-paca.sean8320.dedyn.io`
- `https://pacapro.vercel.app`
- `http://localhost:3000` (개발)

## 에러 핸들러
`paca.js` 말단:
```js
app.use((req, res, next) => { /* 404 */ });
app.use((err, req, res, next) => { /* 500 */ });
```
