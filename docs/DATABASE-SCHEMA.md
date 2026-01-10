# P-ACA 데이터베이스 스키마

> 최종 업데이트: 2026-01-10
> 총 41개 애플리케이션 테이블

---

## 핵심 테이블 (Core)

### `academies` - 학원
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| owner_user_id | int | 학원 소유자 (원장) ID |
| name | varchar(200) | 학원명 |
| business_number | varchar(20) | 사업자 등록번호 |
| address | varchar(500) | 주소 |
| phone | varchar(20) | 대표 전화번호 |
| email | varchar(255) | 학원 이메일 |
| operating_hours | json | 운영 시간 설정 |
| tuition_due_day | int | 월 납부 기한일 (기본: 5일) |
| slug | varchar(50) | 상담 페이지용 URL slug |

### `users` - 사용자
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| email | varchar(255) | 로그인 ID (UNI) |
| password_hash | varchar(255) | bcrypt 해시 |
| name | varchar(255) | 이름 |
| phone | varchar(255) | 연락처 |
| role | enum | owner/admin/teacher/staff |
| academy_id | int | 소속 학원 ID |
| approval_status | enum | pending/approved/rejected |
| permissions | json | 페이지별 권한 |
| instructor_id | int | 연결된 강사 ID |

### `students` - 학생 ⭐
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| name | varchar(255) | **암호화** - 학생 이름 |
| phone | varchar(255) | **암호화** - 연락처 |
| parent_phone | varchar(255) | **암호화** - 학부모 연락처 |
| school | varchar(200) | 학교명 |
| grade | varchar(20) | 학년 (고1/고2/고3/N수) |
| student_type | enum | exam(입시)/adult(성인) |
| status | enum | **active/paused/graduated/withdrawn/trial/pending** |
| class_days | json | 수업 요일 [0-6] |
| weekly_count | int | 주 수업 횟수 |
| monthly_tuition | decimal | 월 수강료 |
| is_trial | tinyint | 체험생 여부 |
| trial_remaining | int | 남은 체험 횟수 |
| time_slot | enum | morning/afternoon/evening |
| rest_start_date | date | 휴식 시작일 |
| rest_end_date | date | 휴식 종료일 |
| enrollment_date | date | 등록일 |
| withdrawal_date | date | 퇴원일 |

### `instructors` - 강사
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| user_id | int | 연결된 사용자 계정 |
| name | varchar(255) | **암호화** - 이름 |
| phone | varchar(255) | **암호화** - 연락처 |
| instructor_type | enum | teacher/assistant |
| salary_type | enum | hourly/per_class/monthly/mixed |
| morning_class_rate | decimal | 오전 수업 단가 |
| afternoon_class_rate | decimal | 오후 수업 단가 |
| evening_class_rate | decimal | 저녁 수업 단가 |
| status | enum | active/on_leave/retired |

---

## 수업 관리 (Class Management)

### `class_schedules` - 수업 일정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| class_date | date | 수업 날짜 |
| time_slot | enum | **morning/afternoon/evening** |
| instructor_id | int | 담당 강사 |
| attendance_taken | tinyint | 출석 체크 여부 |
| is_closed | tinyint | 휴강 여부 |

### `attendance` - 출석
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| class_schedule_id | int | 수업 일정 ID |
| student_id | int | 학생 ID |
| attendance_status | enum | **present/absent/late/excused** |
| is_makeup | tinyint | 보충 여부 |
| makeup_date | date | 보충 날짜 |

### `instructor_schedules` - 강사 근무 배정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| work_date | date | 근무 날짜 |
| time_slot | enum | morning/afternoon/evening |

### `instructor_attendance` - 강사 출퇴근
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| work_date | date | 근무 날짜 |
| time_slot | enum | morning/afternoon/evening |
| check_in_time | time | 출근 시간 |
| check_out_time | time | 퇴근 시간 |
| attendance_status | enum | present/absent/late/day_off |

---

## 결제 관리 (Payment)

### `student_payments` - 학원비
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| academy_id | int | 학원 ID |
| year_month | varchar(7) | 대상 연월 (YYYY-MM) |
| payment_type | enum | monthly/season/product/other |
| base_amount | decimal | 기본 금액 |
| discount_amount | decimal | 할인 금액 |
| final_amount | decimal | 최종 금액 |
| paid_amount | decimal | 납부 금액 |
| payment_status | enum | **pending/paid/partial/overdue/cancelled** |
| due_date | date | 납부 기한 |
| paid_date | date | 납부일 |
| payment_method | enum | account/card/cash/other |

### `toss_payment_history` - 토스 결제 내역
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| payment_id | int | student_payments FK |
| order_id | varchar(100) | 주문번호 |
| payment_key | varchar(100) | 토스 결제 키 |
| amount | decimal | 결제 금액 |
| method | varchar(20) | 결제 수단 |
| status | varchar(20) | 결제 상태 |

---

## 상담 관리 (Consultation)

### `consultations` - 상담 예약
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| consultation_type | enum | **new_registration/learning** |
| parent_name | varchar(255) | 학부모명 |
| parent_phone | varchar(255) | 연락처 |
| student_name | varchar(255) | 학생명 |
| student_grade | enum | 학년 |
| preferred_date | date | 희망 상담 날짜 |
| preferred_time | time | 희망 상담 시간 |
| status | enum | **pending/confirmed/completed/cancelled/no_show** |
| linked_student_id | int | 연결된 기존 학생 ID |

### `student_consultations` - 재원생 상담
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| consultation_date | date | 상담 날짜 |
| consultation_type | enum | regular/admission/parent/counseling |
| academic_memo | text | 학습 메모 |
| physical_records | json | 실기 기록 |
| target_university_1 | varchar(100) | 목표 대학 1 |

---

## 시즌 관리 (Season)

### `seasons` - 시즌
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| season_name | varchar(100) | 시즌명 |
| season_type | enum | early(수시)/regular(정시) |
| season_start_date | date | 시즌 시작일 |
| season_end_date | date | 시즌 종료일 |
| default_season_fee | decimal | 기본 시즌비 |
| status | enum | upcoming/active/ended |

### `student_seasons` - 학생 시즌 등록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| season_id | int | 시즌 ID |
| season_fee | decimal | 시즌비 |
| payment_status | enum | pending/paid/partial/cancelled |
| is_continuous | tinyint | 연속등록 여부 |

---

## 재무 관리 (Finance)

### `expenses` - 지출
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| expense_date | date | 지출일 |
| category | varchar(100) | 카테고리 |
| amount | decimal | 금액 |
| payment_method | enum | account/card/cash/other |

### `salary_records` - 급여 기록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| year_month | varchar(7) | 연월 |
| base_amount | decimal | 기본급 |
| net_salary | decimal | 실수령액 |
| payment_status | enum | pending/paid |

---

## 알림 (Notification)

### `notification_settings` - 알림 설정
- 학원별 알림톡/SMS 설정 (SENS, Solapi)
- 템플릿 코드, 자동 발송 설정

### `notification_logs` - 알림 발송 기록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| message_type | enum | alimtalk/sms/lms/mms |
| status | enum | pending/sent/delivered/failed |

---

## 기타 테이블

| 테이블 | 설명 |
|--------|------|
| academy_events | 학원 일정 |
| academy_settings | 학원 설정 |
| audit_logs | 감사 로그 |
| classes | 반 관리 |
| consultation_blocked_slots | 상담 차단 슬롯 |
| consultation_settings | 상담 설정 |
| consultation_weekly_hours | 상담 주간 운영시간 |
| holidays | 공휴일 |
| other_incomes | 기타 수입 |
| overtime_approvals | 초과근무 승인 |
| push_subscriptions | 푸시 구독 |
| rest_credits | 휴식 크레딧 |
| revenues | 수입 |
| season_settings | 시즌 설정 |
| sender_numbers | 발신번호 |
| student_classes | 학생-반 배정 |
| student_performance | 학생 성적/실기 |
| test_applicants | 테스트 신청자 |
| toss_payment_queue | 토스 결제 대기열 |
| toss_settings | 토스 설정 |
| user_notification_settings | 사용자 알림 설정 |

---

## 암호화 필드 주의사항

다음 필드들은 **암호화**되어 저장됩니다:
- `students.name`, `students.phone`, `students.parent_phone`
- `instructors.name`, `instructors.phone`, `instructors.resident_number`, `instructors.account_number`

**SQL LIKE 검색 불가** → 전체 조회 후 메모리에서 필터링 필요

---

## 주요 ENUM 값

### 학생 상태 (students.status)
- `active` - 재원생
- `paused` - 휴원
- `withdrawn` - 퇴원
- `graduated` - 졸업
- `trial` - 체험
- `pending` - 미등록

### 시간대 (time_slot)
- `morning` - 오전
- `afternoon` - 오후
- `evening` - 저녁

### 출석 상태 (attendance_status)
- `present` - 출석
- `absent` - 결석
- `late` - 지각
- `excused` - 공결

### 결제 상태 (payment_status)
- `pending` - 대기
- `paid` - 완납
- `partial` - 부분납부
- `overdue` - 연체
- `cancelled` - 취소
