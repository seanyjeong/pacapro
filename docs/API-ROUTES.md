# P-ACA API 명세서

> **Last Updated**: 2026-02-11
> **Base URL**: `https://chejump.com:8320/api`
> **Authentication**: Bearer Token (JWT)

---

## 목차

1. [인증 (Auth)](#인증-auth)
2. [학생 (Students)](#학생-students)
3. [강사 (Instructors)](#강사-instructors)
4. [수업 (Schedules)](#수업-schedules)
5. [학원비 (Payments)](#학원비-payments)
6. [급여 (Salaries)](#급여-salaries)
7. [상담 (Consultations)](#상담-consultations)
8. [재원생 상담 (Student Consultations)](#재원생-상담-student-consultations)
9. [시즌 (Seasons)](#시즌-seasons)
10. [알림톡 (Notifications)](#알림톡-notifications)
11. [SMS](#sms)
12. [설정 (Settings)](#설정-settings)
13. [보고서 (Reports)](#보고서-reports)
14. [내보내기 (Exports)](#내보내기-exports)
15. [지출/수입 (Expenses/Incomes)](#지출수입-expensesincomes)
16. [직원 관리 (Staff)](#직원-관리-staff)
17. [푸시 알림 (Push)](#푸시-알림-push)
18. [토스 결제 (Toss)](#토스-결제-toss)
19. [공개 API (Public)](#공개-api-public)
20. [학원 일정 (Academy Events)](#학원-일정-academy-events)
21. [기타](#기타)

---

## 공통 사항

### 인증 헤더
```
Authorization: Bearer <JWT_TOKEN>
```

### 응답 형식
```json
{
  "success": true,
  "data": { ... },
  "message": "성공 메시지"
}
```

### 에러 응답
```json
{
  "success": false,
  "message": "에러 메시지",
  "error": "상세 에러 (개발용)"
}
```

### 권한 레벨
| 권한 | 설명 |
|------|------|
| `owner` | 학원장 (모든 권한) |
| `admin` | 관리자 |
| `teacher` | 강사 |
| `staff` | 직원 |

---

## 인증 (Auth)

**Base**: `/api/auth`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| POST | `/register` | Public | 회원가입 |
| POST | `/login` | Public | 로그인 |
| GET | `/me` | Token | 내 정보 조회 |
| POST | `/change-password` | Token | 비밀번호 변경 |
| POST | `/verify-password` | Token | 비밀번호 확인 |
| POST | `/forgot-password` | Public | 비밀번호 찾기 요청 |
| POST | `/reset-password` | Public | 비밀번호 재설정 |
| GET | `/verify-reset-token` | Public | 재설정 토큰 검증 |

---

## 학생 (Students)

**Base**: `/api/students`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 학생 목록 조회 |
| GET | `/rest-ended` | owner, admin, staff | 휴원 종료 학생 목록 |
| GET | `/search` | Token | 학생 검색 |
| GET | `/class-days` | class_days.view | 요일반 목록 조회 |
| PUT | `/class-days/bulk` | class_days.edit | 요일반 일괄 수정 |
| GET | `/:id` | Token | 학생 상세 조회 |
| POST | `/` | students.edit | 학생 등록 |
| PUT | `/:id` | students.edit | 학생 수정 (`effective_from` 파라미터로 수업요일 예약 적용 가능, 변경 이력 audit_logs 기록) |
| PUT | `/:id/class-days` | class_days.edit | 학생 요일반 수정 |
| DELETE | `/:id/class-days-schedule` | class_days.edit | 학생 요일반 일정 삭제 |
| DELETE | `/:id` | owner | 학생 삭제 |
| POST | `/:id/withdraw` | students.edit | 퇴원 처리 |
| POST | `/grade-upgrade` | students.edit | 학년 진급 |
| POST | `/auto-promote` | owner | 자동 진급 |
| GET | `/:id/seasons` | Token | 학생 시즌 이력 |
| POST | `/:id/process-rest` | students.edit | 휴원 처리 |
| POST | `/:id/resume` | students.edit | 휴원 복원 |
| GET | `/:id/rest-credits` | Token | 휴원 크레딧 조회 |
| POST | `/:id/manual-credit` | payments.edit | 수동 크레딧 추가 (날짜/회차/금액직접입력) |
| GET | `/:id/credits` | Token | 크레딧 목록 |
| PUT | `/:id/credits/:creditId` | payments.edit | 크레딧 수정 |
| DELETE | `/:id/credits/:creditId` | payments.edit | 크레딧 삭제 |
| POST | `/:id/credits/:creditId/apply` | payments.edit | 크레딧 적용 |
| GET | `/:id/attendance` | Token | 학생 월별 출결 현황 (`?year_month=YYYY-MM`) |

### 학생 상태 (status)
- `active`: 재원생 (스케줄O, 학원비O)
- `paused`: 휴원 (스케줄X, 학원비X)
- `trial`: 체험생 (스케줄O, 학원비X)
- `pending`: 미등록 대기
- `withdrawn`: 퇴원
- `graduated`: 졸업

---

## 강사 (Instructors)

**Base**: `/api/instructors`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | instructors.view | 강사 목록 |
| GET | `/:id` | instructors.view | 강사 상세 |
| POST | `/` | instructors.edit | 강사 등록 |
| PUT | `/:id` | instructors.edit | 강사 수정 |
| DELETE | `/:id` | instructors.edit | 강사 삭제 |
| POST | `/:id/attendance` | Token | 출퇴근 기록 |
| GET | `/:id/attendance` | instructors.view | 출퇴근 이력 |
| POST | `/:id/overtime` | overtime_approval.edit | 초과근무 등록 |
| GET | `/overtime/pending` | overtime_approval.view | 대기 중 초과근무 |
| GET | `/overtime/history` | instructors.view | 초과근무 이력 |
| PUT | `/overtime/:approvalId/approve` | overtime_approval.edit | 초과근무 승인/거절 |
| POST | `/verify-admin-password` | instructors.edit | 관리자 비밀번호 확인 |

---

## 수업 (Schedules)

**Base**: `/api/schedules`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 수업 목록 (기간별) |
| GET | `/:id` | Token | 수업 상세 |
| POST | `/` | schedules.edit | 수업 등록 |
| PUT | `/:id` | schedules.edit | 수업 수정 |
| DELETE | `/:id` | schedules.edit | 수업 삭제 |
| PUT | `/:id/assign-instructor` | schedules.edit | 강사 배정 |
| GET | `/:id/attendance` | Token | 출석 목록 |
| POST | `/:id/attendance` | Token | 출석 체크 |
| GET | `/instructor/:instructor_id` | Token | 강사별 수업 |
| GET | `/slot` | Token | 타임슬롯 학생 목록 |
| POST | `/slot/student` | schedules.edit | 타임슬롯에 학생 추가 |
| DELETE | `/slot/student` | schedules.edit | 타임슬롯에서 학생 제거 |
| POST | `/slot/move` | schedules.edit | 학생 타임슬롯 이동 |
| GET | `/:id/instructor-attendance` | Token | 강사 출근 상태 |
| POST | `/:id/instructor-attendance` | schedules.edit | 강사 출근 체크 |
| GET | `/date/:date/instructor-attendance` | Token | 일자별 강사 출근 |
| POST | `/date/:date/instructor-attendance` | schedules.edit | 일자별 강사 출근 체크 |
| GET | `/date/:date/instructor-schedules` | schedules.view | 일자별 강사 배정 |
| POST | `/date/:date/instructor-schedules` | schedules.edit | 일자별 강사 배정 저장 |
| GET | `/instructor-schedules/month` | schedules.view | 월별 강사 통계 |
| POST | `/fix-all` | owner | 전체 수업 재생성 |

---

## 학원비 (Payments)

**Base**: `/api/payments`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | payments.view | 학원비 목록 |
| GET | `/unpaid` | payments.view | 미납 목록 |
| GET | `/unpaid-today` | Token | 오늘 수업 미납자 |
| GET | `/credits` | payments.view | 크레딧 목록 |
| GET | `/credits/summary` | payments.view | 크레딧 요약 |
| GET | `/:id` | payments.view | 학원비 상세 |
| POST | `/` | payments.edit | 학원비 등록 |
| PUT | `/:id` | payments.edit | 학원비 수정 |
| DELETE | `/:id` | owner | 학원비 삭제 |
| POST | `/:id/pay` | payments.edit | 납부 처리 |
| POST | `/bulk-monthly` | payments.edit | 월별 일괄 생성 |
| GET | `/stats/summary` | payments.view | 통계 요약 |
| POST | `/generate-prorated` | payments.edit | 일할 학원비 생성 |
| POST | `/generate-monthly-for-student` | payments.edit | 특정 학생 월 학원비 생성 |
| POST | `/prepaid-preview` | Token | 선납 할인 미리보기 (금액 계산) |
| POST | `/prepaid-pay` | Token | 선납 할인 결제 실행 (2~6개월) |

---

## 급여 (Salaries)

**Base**: `/api/salaries`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | salaries.view | 급여 목록 |
| GET | `/:id` | salaries.view | 급여 상세 |
| GET | `/work-summary/:instructorId/:yearMonth` | salaries.view | 근무 요약 |
| POST | `/calculate` | salaries.edit | 급여 계산 |
| POST | `/` | salaries.edit | 급여 등록 |
| POST | `/:id/recalculate` | salaries.edit | 재계산 |
| POST | `/:id/pay` | owner | 지급 처리 |
| PUT | `/:id` | owner | 급여 수정 |
| POST | `/bulk-pay` | owner | 일괄 지급 |
| DELETE | `/:id` | owner | 급여 삭제 |

---

## 상담 (Consultations)

**Base**: `/api/consultations`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 상담 목록 |
| GET | `/:id` | Token | 상담 상세 |
| PUT | `/:id` | Token | 상담 수정 |
| DELETE | `/:id` | Token | 상담 삭제 |
| POST | `/direct` | Token | 직접 상담 등록 |
| POST | `/learning` | Token | 재원생 상담 등록 |
| GET | `/by-student/:studentId` | Token | 학생별 상담 |
| GET | `/booked-times` | Token | 예약된 시간 조회 |
| POST | `/:id/link-student` | Token | 재원생 연결 |
| POST | `/:id/convert-to-trial` | Token | 체험생 전환 |
| POST | `/:id/convert-to-pending` | Token | 미등록관리 전환 |
| GET | `/settings/info` | Token | 상담 설정 조회 |
| PUT | `/settings/info` | Token | 상담 설정 수정 |
| PUT | `/settings/weekly-hours` | Token | 주간 시간 설정 |
| POST | `/settings/blocked-slots` | Token | 차단 시간 추가 |
| DELETE | `/settings/blocked-slots/:id` | Token | 차단 시간 삭제 |
| GET | `/calendar/events` | Token | 캘린더 이벤트 |

---

## 재원생 상담 (Student Consultations)

**Base**: `/api/student-consultations`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/calendar` | Token | 상담 캘린더 |
| GET | `/:studentId` | Token | 학생 상담 이력 (응답: consultations + initialConsultations) |
| GET | `/:studentId/peak-records` | Token | P-EAK 실기 기록 |
| GET | `/:studentId/compare/:id` | Token | 상담 비교 |
| GET | `/:studentId/:id` | Token | 상담 상세 |
| POST | `/` | Token | 상담 기록 등록 |
| PUT | `/:id` | Token | 상담 기록 수정 |
| DELETE | `/:id` | Token | 상담 기록 삭제 |

---

## 시즌 (Seasons)

**Base**: `/api/seasons`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 시즌 목록 |
| GET | `/active` | Token | 활성 시즌 |
| GET | `/:id` | Token | 시즌 상세 |
| POST | `/` | seasons.edit | 시즌 등록 |
| PUT | `/:id` | seasons.edit | 시즌 수정 |
| DELETE | `/:id` | owner | 시즌 삭제 |
| POST | `/:id/enroll` | seasons.edit | 시즌 등록 |
| GET | `/:id/students` | Token | 시즌 등록 학생 |
| DELETE | `/:id/students/:student_id` | seasons.edit | 시즌 등록 취소 |
| GET | `/:id/preview` | seasons.edit | 등록 미리보기 |
| POST | `/enrollments/:enrollment_id/pay` | seasons.edit | 시즌비 납부 |
| PUT | `/enrollments/:enrollment_id` | seasons.edit | 시즌 등록 수정 |
| POST | `/enrollments/:enrollment_id/refund-preview` | seasons.edit | 환불 미리보기 |
| POST | `/enrollments/:enrollment_id/cancel` | seasons.edit | 시즌 등록 취소 |

---

## 알림톡 (Notifications)

**Base**: `/api/notifications`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/settings` | notifications.view | 알림 설정 조회 |
| PUT | `/settings` | notifications.edit | 알림 설정 수정 |
| POST | `/test` | notifications.edit | 테스트 발송 |
| POST | `/send-unpaid` | notifications.edit | 미납자 알림 수동 발송 |
| POST | `/send-individual` | notifications.edit | 개별 발송 |
| GET | `/logs` | notifications.view | 발송 로그 |
| POST | `/send-unpaid-today-auto` | Token | 오늘 미납자 자동 발송 (솔라피) |
| POST | `/send-trial-today-auto` | Token | 체험 알림 자동 발송 (솔라피) |
| POST | `/test-consultation` | notifications.edit | 상담 확정 테스트 (솔라피) |
| POST | `/test-trial` | notifications.edit | 체험 알림 테스트 (솔라피) |
| POST | `/test-overdue` | notifications.edit | 미납 알림 테스트 (솔라피) |
| POST | `/test-reminder` | notifications.edit | 리마인더 테스트 (솔라피) |
| GET | `/stats` | notifications.view | 발송 통계 |
| POST | `/send-unpaid-today-auto-sens` | Public | 오늘 미납자 자동 발송 (SENS) |
| POST | `/send-trial-today-auto-sens` | Public | 체험 알림 자동 발송 (SENS) |
| POST | `/send-reminder-auto` | Public | 리마인더 자동 발송 (솔라피) |
| POST | `/send-reminder-auto-sens` | Public | 리마인더 자동 발송 (SENS) |
| POST | `/test-sens-consultation` | notifications.edit | 상담 확정 테스트 (SENS) |
| POST | `/test-sens-trial` | notifications.edit | 체험 알림 테스트 (SENS) |
| POST | `/test-sens-overdue` | notifications.edit | 미납 알림 테스트 (SENS) |
| POST | `/test-sens-reminder` | notifications.edit | 리마인더 테스트 (SENS) |

---

## SMS

**Base**: `/api/sms`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| POST | `/send` | sms.edit | SMS 발송 |
| GET | `/recipients-count` | Token | 수신자 수 조회 |
| GET | `/logs` | sms.view | 발송 로그 |
| GET | `/sender-numbers` | Token | 발신번호 목록 |
| POST | `/sender-numbers` | sms.edit | 발신번호 등록 |
| PUT | `/sender-numbers/:id` | sms.edit | 발신번호 수정 |
| DELETE | `/sender-numbers/:id` | sms.edit | 발신번호 삭제 |

---

## 설정 (Settings)

**Base**: `/api/settings`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 설정 조회 |
| PUT | `/` | settings.edit | 설정 수정 |
| GET | `/academy` | Token | 학원 정보 |
| PUT | `/academy` | settings.edit | 학원 정보 수정 |
| GET | `/tuition-rates` | Token | 수업료 테이블 |
| PUT | `/tuition-rates` | settings.edit | 수업료 테이블 수정 |
| POST | `/reset-database` | owner | 데이터 초기화 |

---

## 보고서 (Reports)

**Base**: `/api/reports`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/dashboard` | owner, admin, staff | 대시보드 데이터 |
| GET | `/financial/monthly` | reports.view | 월별 재무 |
| GET | `/financial/yearly` | reports.view | 연별 재무 |
| GET | `/students` | reports.view | 학생 현황 |
| GET | `/instructors` | reports.view | 강사 현황 |
| GET | `/attendance` | reports.view | 출석 통계 |
| GET | `/payments/unpaid` | reports.view | 미납 현황 |

---

## 내보내기 (Exports)

**Base**: `/api/exports`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/revenue` | reports.view | 매출 엑셀 |
| GET | `/expenses` | reports.view | 지출 엑셀 |
| GET | `/financial` | reports.view | 재무 엑셀 |
| GET | `/payments` | reports.view | 학원비 엑셀 |
| GET | `/salaries` | reports.view | 급여 엑셀 |
| GET | `/students` | Token | 학생 엑셀 |

---

## 지출/수입 (Expenses/Incomes)

### 지출 (Expenses)

**Base**: `/api/expenses`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | expenses.view | 지출 목록 |
| GET | `/:id` | expenses.view | 지출 상세 |
| GET | `/summary/monthly` | expenses.view | 월별 요약 |
| GET | `/category/list` | expenses.view | 카테고리 목록 |
| POST | `/` | expenses.edit | 지출 등록 |
| PUT | `/:id` | expenses.edit | 지출 수정 |
| DELETE | `/:id` | expenses.edit | 지출 삭제 |

### 기타 수입 (Incomes)

**Base**: `/api/incomes`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | incomes.view | 수입 목록 |
| GET | `/categories` | incomes.view | 카테고리 목록 |
| GET | `/:id` | incomes.view | 수입 상세 |
| POST | `/` | incomes.edit | 수입 등록 |
| PUT | `/:id` | incomes.edit | 수입 수정 |
| DELETE | `/:id` | incomes.edit | 수입 삭제 |

---

## 직원 관리 (Staff)

**Base**: `/api/staff`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | owner | 직원 목록 |
| GET | `/available-instructors` | owner | 연결 가능 강사 |
| POST | `/` | owner | 직원 등록 |
| GET | `/:id` | owner | 직원 상세 |
| PUT | `/:id` | owner | 직원 수정 |
| DELETE | `/:id` | owner | 직원 삭제 |
| PUT | `/:id/permissions` | owner | 권한 수정 |
| GET | `/permissions/pages` | owner | 권한 페이지 목록 |

---

## 사용자 관리 (Users)

**Base**: `/api/users`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | owner, admin | 사용자 목록 |
| GET | `/pending` | owner, admin | 승인 대기 목록 |
| POST | `/approve/:id` | owner, admin | 가입 승인 |
| POST | `/reject/:id` | owner, admin | 가입 거절 |
| GET | `/:id` | owner, admin | 사용자 상세 |

---

## 푸시 알림 (Push)

**Base**: `/api/push`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/vapid-public-key` | Public | VAPID 공개키 |
| POST | `/subscribe` | Token | 푸시 구독 |
| DELETE | `/subscribe` | Token | 푸시 해제 |
| GET | `/subscriptions` | Token | 구독 목록 |
| POST | `/test` | Token | 테스트 푸시 |

---

## 알림 설정 (User Notification Settings)

**Base**: `/api/notification-settings`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 알림 설정 조회 |
| PUT | `/` | Token | 알림 설정 수정 |

---

## 토스 결제 (Toss)

**Base**: `/api/toss`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/unpaid` | Toss Plugin | 미납 학생 목록 |
| GET | `/student/:id` | Toss Plugin | 학생 정보 |
| POST | `/payment-callback` | Callback | 결제 완료 콜백 |
| POST | `/cancel-callback` | Callback | 결제 취소 콜백 |
| GET | `/history` | payments.view | 결제 내역 |
| GET | `/queue` | payments.view | 대기열 조회 |
| POST | `/queue/:id/match` | payments.edit | 수동 매칭 |
| POST | `/queue/:id/ignore` | payments.edit | 무시 처리 |
| GET | `/stats` | payments.view | 통계 |
| GET | `/settings` | settings.view | 토스 설정 |
| PUT | `/settings` | settings.edit | 토스 설정 수정 |

---

## 공개 API (Public)

**Base**: `/api/public` (인증 불필요)

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/consultation/:slug` | 상담 예약 페이지 정보 |
| GET | `/consultation/:slug/slots` | 예약 가능 시간 |
| POST | `/consultation/:slug/apply` | 상담 신청 |
| GET | `/reservation/:reservationNumber` | 예약 정보 조회 |
| PUT | `/reservation/:reservationNumber` | 예약 수정 |
| GET | `/check-slug/:slug` | 슬러그 사용 가능 확인 |

---

## 학원 일정 (Academy Events)

**Base**: `/api/academy-events`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 학원 일정 목록 |
| GET | `/:id` | Token | 일정 상세 |
| POST | `/` | schedules.edit | 일정 등록 |
| PUT | `/:id` | schedules.edit | 일정 수정 |
| DELETE | `/:id` | schedules.edit | 일정 삭제 |

### 일정 타입 (event_type)
- `work` - 업무
- `academy` - 학원
- `holiday` - 휴일 (자동 휴강 처리)
- `etc` - 기타

### 일정 등록 시 자동 처리
- `is_holiday: true` 설정 시 해당 날짜 수업 휴강 처리 + 전체 시간대 상담 차단
- 일반 일정도 해당 시간대 상담 차단 (종일 일정이면 전체, 시간 지정이면 해당 시간대만)
- 삭제 시 연결된 상담 차단 자동 해제

---

## 기타

### 검색 (Search)

**Base**: `/api/search`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 통합 검색 |

### 반 (Classes)

**Base**: `/api/classes`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 반 목록 |
| GET | `/by-date/:date` | Token | 일자별 수업 |
| GET | `/:id` | Token | 반 상세 |
| POST | `/` | owner, admin | 반 등록 |
| PUT | `/:id` | owner, admin | 반 수정 |
| DELETE | `/:id` | owner, admin | 반 삭제 |
| PUT | `/:classId/schedules/:date/assign-instructors` | owner, admin | 강사 배정 |

### 온보딩 (Onboarding)

**Base**: `/api/onboarding`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/status` | Token | 온보딩 상태 |
| GET | `/data` | Token | 온보딩 데이터 |
| POST | `/complete` | owner | 온보딩 완료 |
| POST | `/sample-data` | owner | 샘플 데이터 생성 |
| POST | `/skip` | owner | 온보딩 건너뛰기 |

### 성적 (Performance)

**Base**: `/api/performance`

| Method | Endpoint | 권한 | 설명 |
|--------|----------|------|------|
| GET | `/` | Token | 성적 목록 |
| GET | `/:id` | Token | 성적 상세 |
| GET | `/student/:student_id` | Token | 학생별 성적 |
| POST | `/` | Token | 성적 등록 |
| PUT | `/:id` | Token | 성적 수정 |
| DELETE | `/:id` | students.edit | 성적 삭제 |

---

## 권한 (Permissions) 상세

| 권한 키 | 설명 |
|---------|------|
| students.view | 학생 조회 |
| students.edit | 학생 등록/수정 |
| instructors.view | 강사 조회 |
| instructors.edit | 강사 등록/수정 |
| schedules.view | 수업 조회 |
| schedules.edit | 수업 등록/수정 |
| payments.view | 학원비 조회 |
| payments.edit | 학원비 등록/수정 |
| salaries.view | 급여 조회 |
| salaries.edit | 급여 등록/수정 |
| seasons.view | 시즌 조회 |
| seasons.edit | 시즌 등록/수정 |
| consultations.view | 상담 조회 |
| consultations.edit | 상담 등록/수정 |
| reports.view | 보고서 조회 |
| settings.view | 설정 조회 |
| settings.edit | 설정 수정 |
| expenses.view | 지출 조회 |
| expenses.edit | 지출 등록/수정 |
| incomes.view | 수입 조회 |
| incomes.edit | 수입 등록/수정 |
| overtime_approval.view | 초과근무 승인 조회 |
| overtime_approval.edit | 초과근무 승인/거절 |
| notifications.view | 알림톡 조회 |
| notifications.edit | 알림톡 발송/수정 |
| sms.view | SMS 로그 조회 |
| sms.edit | SMS 발송/수정 |
| class_days.view | 요일반 조회 |
| class_days.edit | 요일반 등록/수정 |

---

## n8n 자동화 연동

### Webhook 엔드포인트
| 워크플로우 | 호출 엔드포인트 |
|------------|----------------|
| 납부안내 알림톡 (솔라피) | `POST /api/notifications/send-unpaid-today-auto` |
| 체험수업 알림톡 (솔라피) | `POST /api/notifications/send-trial-today-auto` |
| 납부안내 알림톡 (SENS) | `POST /api/notifications/send-unpaid-today-auto-sens` |
| 체험수업 알림톡 (SENS) | `POST /api/notifications/send-trial-today-auto-sens` |
| 리마인더 (솔라피) | `POST /api/notifications/send-reminder-auto` |
| 리마인더 (SENS) | `POST /api/notifications/send-reminder-auto-sens` |

### 인증
```
X-API-Key: paca-n8n-api-key-2024
```
