# P-ACA 백엔드 라우터 목록

> 마지막 업데이트: 2025-12-13
> 총 24개 라우터 파일

---

## 복호화 작업 현황

> 마지막 업데이트: 2025-12-13

| 라우터 | 상태 | 암호화 필드 |
|--------|------|-------------|
| students.js | ✅ 완료 | name, phone, parent_phone, address |
| instructors.js | ✅ 완료 | name, phone, address, resident_number, account_number, account_holder |
| schedules.js | ✅ 완료 | student_name, instructor_name |
| payments.js | ✅ 완료 | student_name |
| salaries.js | ✅ 완료 | instructor_name |
| consultations.js | ✅ 완료 | student_name |
| users.js | ✅ 완료 | name, phone |
| seasons.js | ✅ 완료 | student_name, student_phone, parent_phone |
| staff.js | ✅ 완료 | name, instructor_name, instructor_phone, phone |
| reports.js | ✅ 완료 | student_name, phone, parent_phone |
| exports.js | ✅ 완료 | student_name, instructor_name, resident_number |
| search.js | ✅ 완료 | name, phone, parent_phone (메모리 필터링) |
| performance.js | ✅ 완료 | student_name, recorded_by_name |
| classes.js | ✅ 완료 | instructor_name |
| auth.js | ✅ 완료 | name (decryptFields 사용) |
| notifications.js | ⏳ 검토필요 | - |
| sms.js | ⏳ 검토필요 | - |
| public.js | ⏳ 검토필요 | - |
| expenses.js | ❌ 해당없음 | - |
| incomes.js | ❌ 해당없음 | - |
| settings.js | ❌ 해당없음 | - |
| onboarding.js | ❌ 해당없음 | - |

---

## 1. auth.js - 인증

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | /register | 회원가입 |
| POST | /login | 로그인 |
| GET | /me | 내 정보 조회 |
| POST | /change-password | 비밀번호 변경 |
| POST | /verify-password | 비밀번호 확인 |
| POST | /forgot-password | 비밀번호 찾기 |
| POST | /reset-password | 비밀번호 재설정 |
| GET | /verify-reset-token | 재설정 토큰 확인 |

---

## 2. classes.js - 수업 클래스

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 전체 수업 목록 |
| GET | /by-date/:date | 날짜별 수업 |
| PUT | /:classId/schedules/:date/assign-instructors | 강사 배정 |
| GET | /:id | 수업 상세 |
| POST | / | 수업 생성 |
| PUT | /:id | 수업 수정 |
| DELETE | /:id | 수업 삭제 |

---

## 3. consultations.js - 상담

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 상담 목록 |
| GET | /booked-times | 예약된 시간 조회 |
| GET | /:id | 상담 상세 |
| PUT | /:id | 상담 수정 |
| DELETE | /:id | 상담 삭제 |
| POST | /direct | 직접 상담 등록 |
| POST | /:id/link-student | 학생 연결 |
| POST | /:id/convert-to-trial | 체험 전환 |
| GET | /settings/info | 상담 설정 조회 |
| PUT | /settings/info | 상담 설정 수정 |
| PUT | /settings/weekly-hours | 주간 시간 설정 |
| POST | /settings/blocked-slots | 차단 슬롯 추가 |
| DELETE | /settings/blocked-slots/:id | 차단 슬롯 삭제 |
| GET | /calendar/events | 캘린더 이벤트 |

---

## 4. expenses.js - 지출

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 지출 목록 |
| GET | /:id | 지출 상세 |
| GET | /summary/monthly | 월별 요약 |
| GET | /category/list | 카테고리 목록 |
| POST | / | 지출 등록 |
| PUT | /:id | 지출 수정 |
| DELETE | /:id | 지출 삭제 |

---

## 5. exports.js - 내보내기

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /revenue | 수입 내보내기 |
| GET | /expenses | 지출 내보내기 |
| GET | /financial | 재무 내보내기 |
| GET | /payments | 학원비 내보내기 |
| GET | /salaries | 급여 내보내기 |

---

## 6. incomes.js - 수입

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 수입 목록 |
| GET | /categories | 카테고리 목록 |
| GET | /:id | 수입 상세 |
| POST | / | 수입 등록 |
| PUT | /:id | 수입 수정 |
| DELETE | /:id | 수입 삭제 |

---

## 7. instructors.js - 강사

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 강사 목록 |
| GET | /overtime/pending | 추가근무 대기 |
| GET | /overtime/history | 추가근무 이력 |
| PUT | /overtime/:approvalId/approve | 추가근무 승인 |
| POST | /verify-admin-password | 관리자 비밀번호 확인 |
| GET | /:id | 강사 상세 |
| POST | / | 강사 등록 |
| PUT | /:id | 강사 수정 |
| DELETE | /:id | 강사 삭제 |
| POST | /:id/attendance | 출퇴근 기록 |
| GET | /:id/attendance | 출퇴근 조회 |
| POST | /:id/overtime | 추가근무 등록 |

---

## 8. notifications.js - 알림톡

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /settings | 알림 설정 조회 |
| PUT | /settings | 알림 설정 수정 |
| POST | /test | 테스트 발송 |
| POST | /send-unpaid | 미납 알림 발송 |
| POST | /send-individual | 개별 발송 |
| GET | /logs | 발송 로그 |
| POST | /send-unpaid-today-auto | 자동 미납 발송 |
| GET | /stats | 통계 |

---

## 9. onboarding.js - 온보딩

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /status | 온보딩 상태 |
| GET | /data | 온보딩 데이터 |
| POST | /complete | 온보딩 완료 |
| POST | /sample-data | 샘플 데이터 생성 |
| POST | /skip | 온보딩 스킵 |

---

## 10. payments.js - 학원비

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 학원비 목록 |
| GET | /unpaid | 미납 목록 |
| GET | /unpaid-today | 오늘 미납 (n8n용) |
| GET | /:id | 학원비 상세 |
| POST | / | 학원비 등록 |
| POST | /bulk-monthly | 월별 일괄 생성 |
| POST | /:id/pay | 납부 처리 |
| PUT | /:id | 학원비 수정 |
| DELETE | /:id | 학원비 삭제 |
| GET | /stats/summary | 통계 요약 |
| POST | /generate-prorated | 일할 계산 |
| POST | /generate-monthly-for-student | 학생별 월납 생성 |

---

## 11. performance.js - 성적

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 성적 목록 |
| GET | /:id | 성적 상세 |
| GET | /student/:student_id | 학생별 성적 |
| POST | / | 성적 등록 |
| PUT | /:id | 성적 수정 |
| DELETE | /:id | 성적 삭제 |

---

## 12. public.js - 공개 API (인증 불필요)

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /consultation/:slug | 상담 페이지 조회 |
| GET | /consultation/:slug/slots | 예약 슬롯 조회 |
| POST | /consultation/:slug/apply | 상담 신청 |
| GET | /check-slug/:slug | 슬러그 확인 |

---

## 13. reports.js - 리포트

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /dashboard | 대시보드 데이터 |
| GET | /financial/monthly | 월별 재무 |
| GET | /financial/yearly | 연간 재무 |
| GET | /students | 학생 리포트 |
| GET | /instructors | 강사 리포트 |
| GET | /attendance | 출결 리포트 |
| GET | /payments/unpaid | 미납 리포트 |

---

## 14. salaries.js - 급여

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 급여 목록 |
| GET | /work-summary/:instructorId/:yearMonth | 근무 요약 |
| GET | /:id | 급여 상세 |
| POST | /calculate | 급여 계산 |
| POST | / | 급여 등록 |
| POST | /:id/recalculate | 재계산 |
| POST | /:id/pay | 지급 처리 |
| PUT | /:id | 급여 수정 |
| POST | /bulk-pay | 일괄 지급 |
| DELETE | /:id | 급여 삭제 |

---

## 15. schedules.js - 스케줄/출결

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 스케줄 목록 |
| GET | /instructor/:instructor_id | 강사별 스케줄 |
| GET | /slot | 슬롯 조회 |
| POST | /slot/student | 슬롯에 학생 추가 |
| DELETE | /slot/student | 슬롯에서 학생 제거 |
| POST | /slot/move | 슬롯 이동 |
| GET | /:id | 스케줄 상세 |
| POST | /bulk | 일괄 생성 |
| POST | / | 스케줄 생성 |
| PUT | /:id/assign-instructor | 강사 배정 |
| PUT | /:id | 스케줄 수정 |
| DELETE | /:id | 스케줄 삭제 |
| GET | /:id/attendance | 출결 조회 |
| POST | /:id/attendance | 출결 기록 |
| GET | /:id/instructor-attendance | 강사 출결 조회 |
| POST | /:id/instructor-attendance | 강사 출결 기록 |
| GET | /date/:date/instructor-attendance | 날짜별 강사 출결 |
| POST | /date/:date/instructor-attendance | 날짜별 강사 출결 저장 |
| GET | /date/:date/instructor-schedules | 날짜별 강사 스케줄 |
| POST | /date/:date/instructor-schedules | 날짜별 강사 스케줄 저장 |
| GET | /instructor-schedules/month | 월별 강사 스케줄 |
| POST | /fix-all | 전체 수정 (owner) |

---

## 16. search.js - 통합 검색

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 통합 검색 |

---

## 17. seasons.js - 시즌

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 시즌 목록 |
| GET | /active | 활성 시즌 |
| POST | /enrollments/:enrollment_id/pay | 등록 납부 |
| PUT | /enrollments/:enrollment_id | 등록 수정 |
| POST | /enrollments/:enrollment_id/refund-preview | 환불 미리보기 |
| POST | /enrollments/:enrollment_id/cancel | 등록 취소 |
| GET | /:id | 시즌 상세 |
| POST | / | 시즌 생성 |
| PUT | /:id | 시즌 수정 |
| DELETE | /:id | 시즌 삭제 |
| POST | /:id/enroll | 시즌 등록 |
| GET | /:id/students | 시즌 학생 목록 |
| DELETE | /:id/students/:student_id | 학생 제거 |
| GET | /:id/preview | 시즌 미리보기 |

---

## 18. settings.js - 설정

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 설정 조회 |
| PUT | / | 설정 수정 |
| GET | /academy | 학원 정보 |
| PUT | /academy | 학원 정보 수정 |
| GET | /tuition-rates | 수강료 조회 |
| PUT | /tuition-rates | 수강료 수정 |
| POST | /reset-database | DB 초기화 (owner) |

---

## 19. sms.js - 문자

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| POST | /send | 문자 발송 |
| GET | /recipients-count | 수신자 수 조회 |
| GET | /logs | 발송 로그 |

---

## 20. staff.js - 직원 관리

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 직원 목록 |
| GET | /available-instructors | 연결 가능 강사 |
| POST | / | 직원 등록 |
| GET | /:id | 직원 상세 |
| PUT | /:id | 직원 수정 |
| PUT | /:id/permissions | 권한 수정 |
| DELETE | /:id | 직원 삭제 |
| GET | /permissions/pages | 권한 페이지 목록 |

---

## 21. students.js - 학생

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | / | 학생 목록 |
| GET | /:id | 학생 상세 |
| POST | / | 학생 등록 |
| PUT | /:id | 학생 수정 |
| DELETE | /:id | 학생 삭제 |
| POST | /:id/withdraw | 퇴원 처리 |
| POST | /grade-upgrade | 학년 진급 |
| POST | /auto-promote | 자동 진급 |
| GET | /:id/seasons | 학생 시즌 |
| GET | /search | 학생 검색 |
| POST | /:id/rest | 휴원 처리 |
| POST | /:id/resume | 복원 처리 |
| GET | /:id/rest-credits | 휴원 크레딧 |

---

## 22. users.js - 사용자 승인 (admin)

| 메서드 | 엔드포인트 | 설명 |
|--------|------------|------|
| GET | /pending | 승인 대기 목록 |
| POST | /approve/:id | 승인 |
| POST | /reject/:id | 거절 |
| GET | / | 사용자 목록 |
| GET | /:id | 사용자 상세 |

---

## 라우트 마운트 (server.js)

```javascript
app.use('/paca/auth', authRoutes);
app.use('/paca/students', studentsRoutes);
app.use('/paca/instructors', instructorsRoutes);
app.use('/paca/schedules', schedulesRoutes);
app.use('/paca/payments', paymentsRoutes);
app.use('/paca/salaries', salariesRoutes);
app.use('/paca/expenses', expensesRoutes);
app.use('/paca/incomes', incomesRoutes);
app.use('/paca/reports', reportsRoutes);
app.use('/paca/settings', settingsRoutes);
app.use('/paca/notifications', notificationsRoutes);
app.use('/paca/seasons', seasonsRoutes);
app.use('/paca/classes', classesRoutes);
app.use('/paca/onboarding', onboardingRoutes);
app.use('/paca/consultations', consultationsRoutes);
app.use('/paca/performance', performanceRoutes);
app.use('/paca/exports', exportsRoutes);
app.use('/paca/users', usersRoutes);
app.use('/paca/staff', staffRoutes);
app.use('/paca/sms', smsRoutes);
app.use('/paca/search', searchRoutes);
app.use('/public', publicRoutes);
```
