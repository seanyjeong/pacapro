# P-ACA 데이터베이스 스키마

> 최종 업데이트: 2026-02-11
> 총 43개 애플리케이션 테이블 (NocoDB nc_*/xc_* 제외)

---

## 공통 패턴

거의 모든 테이블에 적용되는 공통 컬럼:

| 패턴 | 컬럼 | 설명 |
|------|------|------|
| 타임스탬프 | `created_at` timestamp | 생성 시각 (DEFAULT CURRENT_TIMESTAMP) |
| 타임스탬프 | `updated_at` timestamp | 수정 시각 (ON UPDATE CURRENT_TIMESTAMP) |
| 감사 추적 | `recorded_by` int | 기록자 user ID |
| 감사 추적 | `created_by` int | 생성자 user ID |
| Soft Delete | `deleted_at` timestamp | 삭제 표시 (students, instructors, users) |

> 아래 테이블 정의에서 `created_at`, `updated_at`는 생략합니다 (거의 모든 테이블에 존재).

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
| name | varchar(255) | **암호화** - 이름 |
| phone | varchar(255) | **암호화** - 연락처 |
| role | enum | owner/admin/teacher/staff |
| academy_id | int | 소속 학원 ID |
| parent_user_id | int | 상위 사용자 ID |
| approval_status | enum | pending/approved/rejected |
| approved_by | int | 승인자 ID |
| approved_at | timestamp | 승인 시각 |
| is_active | tinyint(1) | 활성 여부 |
| last_login_at | timestamp | 마지막 로그인 |
| oauth_provider | enum | kakao/naver/google |
| oauth_id | varchar(255) | OAuth 연동 ID |
| permissions | json | 페이지별 권한 |
| instructor_id | int | 연결된 강사 ID |
| position | varchar(50) | 직급 |
| created_by | int | 생성자 ID |
| tutorial_completed | json | 튜토리얼 완료 상태 |
| reset_token | varchar(255) | 비밀번호 재설정 토큰 |
| reset_token_expires | datetime | 토큰 만료 시각 |
| deleted_at | timestamp | Soft delete |

### `students` - 학생 ⭐
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| name | varchar(255) | **암호화** - 학생 이름 |
| gender | enum | male/female |
| student_type | enum | exam(입시)/adult(성인) |
| student_number | varchar(50) | 학생 번호 |
| phone | varchar(255) | **암호화** - 연락처 |
| parent_phone | varchar(255) | **암호화** - 학부모 연락처 |
| school | varchar(200) | 학교명 |
| grade | varchar(20) | 학년 (고1/고2/고3/N수) |
| age | int | 나이 |
| address | text | **암호화** - 주소 |
| admission_type | enum | regular/early/civil_service/military_academy/police_university |
| profile_image_url | varchar(500) | 프로필 이미지 URL |
| class_days | json | 수업 요일 [0-6] |
| class_days_next | json | 예정 요일반 변경 |
| class_days_effective_from | date | 요일반 변경 적용일 |
| weekly_count | int | 주 수업 횟수 |
| monthly_tuition | decimal(10,2) | 월 수강료 |
| discount_rate | decimal(5,2) | 할인율 |
| discount_reason | varchar(255) | 할인 사유 |
| final_monthly_tuition | decimal(10,2) | 최종 월 수강료 |
| status | enum | **active/paused/graduated/withdrawn/trial/pending** |
| is_trial | tinyint(1) | 체험생 여부 |
| trial_remaining | int | 남은 체험 횟수 |
| trial_dates | json | 체험 일정 |
| time_slot | enum | morning/afternoon/evening |
| is_season_registered | tinyint(1) | 시즌 등록 여부 |
| current_season_id | int | 현재 시즌 ID |
| rest_start_date | date | 휴원 시작일 |
| rest_end_date | date | 휴원 종료일 |
| rest_reason | varchar(255) | 휴원 사유 |
| enrollment_date | date | 등록일 |
| withdrawal_date | date | 퇴원일 |
| withdrawal_reason | varchar(255) | 퇴원 사유 |
| payment_due_day | int | 개별 납부 기한일 |
| consultation_date | date | 상담일 |
| notes | text | 메모 |
| memo | text | 추가 메모 |
| deleted_at | timestamp | Soft delete |

### `instructors` - 강사
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| user_id | int | 연결된 사용자 계정 |
| name | varchar(255) | **암호화** - 이름 |
| gender | enum | male/female |
| phone | varchar(255) | **암호화** - 연락처 |
| email | varchar(255) | 이메일 |
| address | text | **암호화** - 주소 |
| birth_date | date | 생년월일 |
| hire_date | date | 입사일 |
| instructor_type | enum | teacher/assistant |
| salary_type | enum | hourly/per_class/monthly/mixed |
| morning_class_rate | decimal(10,2) | 오전 수업 단가 |
| afternoon_class_rate | decimal(10,2) | 오후 수업 단가 |
| evening_class_rate | decimal(10,2) | 저녁 수업 단가 |
| base_salary | decimal(10,2) | 기본급 |
| hourly_rate | decimal(10,2) | 시급 |
| incentive_rate | decimal(5,2) | 인센티브율 |
| tax_type | enum | 3.3%/insurance/none |
| work_days | json | 근무 요일 |
| work_start_time | time | 출근 시간 |
| work_end_time | time | 퇴근 시간 |
| bank_name | varchar(100) | 은행명 |
| account_number | varchar(255) | **암호화** - 계좌번호 |
| account_holder | varchar(255) | **암호화** - 예금주 |
| resident_number | varchar(255) | **암호화** - 주민번호 |
| status | enum | active/on_leave/retired |
| notes | text | 메모 |
| deleted_at | timestamp | Soft delete |

---

## 수업 관리 (Class Management)

### `classes` - 반
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| name | varchar(100) | 반 이름 |
| time_slot | enum | morning/afternoon/evening |
| admission_type | enum | regular/early |
| is_active | tinyint(1) | 활성 여부 |

### `class_schedules` - 수업 일정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| class_id | int | 반 ID |
| class_date | date | 수업 날짜 |
| time_slot | enum | **morning/afternoon/evening** |
| target_grade | varchar(20) | 대상 학년 |
| instructor_id | int | 담당 강사 |
| season_id | int | 시즌 ID |
| title | varchar(200) | 수업 제목 |
| content | text | 수업 내용 |
| attendance_taken | tinyint(1) | 출석 체크 여부 |
| is_closed | tinyint(1) | 휴강 여부 |
| close_reason | varchar(200) | 휴강 사유 |
| academy_event_id | int | 연결된 학원 일정 |
| notes | text | 비고 |

### `attendance` - 출석
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| class_schedule_id | int | 수업 일정 ID |
| student_id | int | 학생 ID |
| attendance_status | enum | **present/absent/late/excused** |
| is_makeup | tinyint(1) | 보충 여부 |
| makeup_date | date | 보충 날짜 |
| notes | text | 비고 |
| recorded_by | int | 기록자 |

### `student_classes` - 학생-반 배정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| class_id | int | 반 ID |
| academy_id | int | 학원 ID |

### `instructor_schedules` - 강사 근무 배정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| academy_id | int | 학원 ID |
| work_date | date | 근무 날짜 |
| time_slot | enum | morning/afternoon/evening |
| scheduled_start_time | time | 예정 시작 시간 |
| scheduled_end_time | time | 예정 종료 시간 |
| created_by | int | 배정자 |

### `instructor_attendance` - 강사 출퇴근
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| class_schedule_id | int | 수업 일정 ID |
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
| target_year | int | 대상 연도 |
| target_month | int | 대상 월 |
| payment_type | enum | monthly/season/product/other |
| base_amount | decimal(10,2) | 기본 금액 |
| discount_amount | decimal(10,2) | 할인 금액 |
| additional_amount | decimal(10,2) | 추가 금액 |
| carryover_amount | int | 이월 금액 |
| refund_amount | int | 환불 금액 |
| rest_credit_id | int | 연결 크레딧 ID |
| final_amount | decimal(10,2) | 최종 금액 |
| paid_amount | decimal(12,2) | 납부 금액 |
| is_prorated | tinyint(1) | 일할 계산 여부 |
| proration_details | json | 일할 계산 상세 |
| payment_status | enum | **pending/paid/partial/overdue/cancelled** |
| due_date | date | 납부 기한 |
| paid_date | date | 납부일 |
| payment_method | enum | account/card/cash/other |
| season_id | int | 시즌 ID |
| prepaid_group_id | varchar(36) | 선납 그룹 ID |
| description | text | 설명 |
| notes | text | 비고 |
| recorded_by | int | 기록자 |

### `rest_credits` - 휴원 크레딧
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| academy_id | int | 학원 ID |
| credit_type | enum | carryover/excused/manual |
| credit_amount | decimal(10,2) | 크레딧 금액 |
| remaining_amount | decimal(10,2) | 잔액 |
| status | enum | active/used/expired |
| source_month | varchar(7) | 발생 월 |
| applied_month | varchar(7) | 적용 월 |
| processed_at | timestamp | 처리 시각 |
| notes | text | 비고 |

### `toss_payment_history` - 토스 결제 내역
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| payment_id | int | student_payments FK |
| academy_id | int | 학원 ID |
| order_id | varchar(100) | 주문번호 |
| payment_key | varchar(100) | 토스 결제 키 |
| amount | decimal(10,0) | 결제 금액 (정수) |
| method | varchar(20) | 결제 수단 |
| approved_at | datetime | 승인 시각 |
| receipt_url | varchar(500) | 영수증 URL |
| card_company | varchar(50) | 카드사 |
| card_number | varchar(20) | 카드 번호 |
| installment_months | int | 할부 개월 |
| status | varchar(20) | 결제 상태 |
| raw_data | json | 원본 데이터 |

### `toss_payment_queue` - 토스 결제 대기열
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| order_id | varchar(100) | 주문번호 |
| payment_key | varchar(100) | 결제 키 |
| amount | decimal(10,0) | 금액 |
| method | varchar(20) | 결제 수단 |
| approved_at | datetime | 승인 시각 |
| receipt_url | varchar(500) | 영수증 URL |
| card_company | varchar(50) | 카드사 |
| merchant_id | varchar(50) | 가맹점 ID |
| metadata | json | 메타데이터 |
| raw_data | json | 원본 데이터 |
| match_status | enum | pending/matched/ignored/error |
| matched_payment_id | int | 매칭된 학원비 ID |
| matched_at | datetime | 매칭 시각 |
| matched_by | int | 매칭 처리자 |
| error_reason | varchar(500) | 오류 사유 |

### `toss_settings` - 토스 설정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID (UNI) |
| merchant_id | varchar(50) | 가맹점 ID |
| plugin_api_key | varchar(100) | 플러그인 API 키 |
| callback_secret | varchar(100) | 콜백 시크릿 |
| is_active | tinyint(1) | 활성 여부 |
| auto_match_enabled | tinyint(1) | 자동 매칭 여부 |
| auto_receipt_print | tinyint(1) | 자동 영수증 여부 |

---

## 상담 관리 (Consultation)

### `consultations` - 상담 예약
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| consultation_type | enum | **new_registration/learning** |
| learning_type | enum | regular/admission/parent/counseling |
| reservation_number | varchar(20) | 예약번호 (UNI) |
| parent_name | varchar(255) | **암호화** - 학부모명 |
| parent_phone | varchar(255) | **암호화** - 학부모 연락처 |
| student_name | varchar(255) | **암호화** - 학생명 |
| student_phone | varchar(255) | **암호화** - 학생 연락처 |
| student_grade | enum | 학년 |
| student_school | varchar(100) | 학교명 |
| gender | enum | male/female |
| preferred_date | date | 희망 상담 날짜 |
| preferred_time | time | 희망 상담 시간 |
| status | enum | **pending/confirmed/completed/cancelled/no_show** |
| linked_student_id | int | 연결된 기존 학생 ID |
| academic_scores | json | 학업 성적 |
| target_school | varchar(100) | 목표 대학 |
| referrer_student | varchar(50) | 소개 학생 |
| referral_sources | json | 유입 경로 |
| inquiry_content | text | 문의 내용 |
| admin_notes | text | 관리자 메모 |
| notes | text | **암호화** - 상담 메모 |
| checklist | json | 체크리스트 |
| consultation_memo | text | 상담 기록 |
| alimtalk_sent_at | timestamp | 알림톡 발송 시각 |
| alimtalk_status | varchar(20) | 알림톡 상태 |
| reminder_sent | tinyint(1) | 리마인더 발송 여부 |
| reminder_alimtalk_sent_at | timestamp | 리마인더 발송 시각 |

### `student_consultations` - 재원생 상담
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| academy_id | int | 학원 ID |
| consultation_id | int | 상담 예약 연결 ID |
| consultation_date | date | 상담 날짜 |
| consultation_type | enum | regular/admission/parent/counseling |
| academic_memo | text | 학습 메모 |
| physical_records | json | 실기 기록 |
| target_university_1 | varchar(100) | 목표 대학 1 |

### `consultation_settings` - 상담 설정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| is_active | tinyint(1) | 활성 여부 |
| slot_duration | int | 슬롯 시간 (분) |
| max_per_slot | int | 슬롯당 최대 인원 |
| min_advance_hours | int | 최소 사전 예약 시간 |

### `consultation_weekly_hours` - 상담 주간 운영시간
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| day_of_week | int | 요일 (0=일~6=토) |
| time_slot | enum | morning/afternoon/evening |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 |
| is_active | tinyint(1) | 활성 여부 |

### `consultation_blocked_slots` - 상담 차단 슬롯
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| blocked_date | date | 차단 날짜 |
| time_slot | enum | morning/afternoon/evening |
| blocked_by | varchar(50) | 차단 주체 |
| reason | varchar(255) | 사유 |
| created_by | int | 생성자 |
| academy_event_id | int | 연결된 학원 일정 |

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
| non_season_end_date | date | 비시즌 종료일 |
| default_season_fee | decimal(10,2) | 기본 시즌비 |
| operating_days | json | 운영 요일 |
| grade_time_slots | json | 학년별 타임슬롯 |
| allows_continuous | tinyint(1) | 연속등록 허용 |
| continuous_to_season_type | enum | 연속등록 대상 시즌 타입 |
| continuous_discount_type | enum | 연속등록 할인 유형 |
| continuous_discount_rate | decimal(5,2) | 연속등록 할인율 |
| status | enum | upcoming/active/ended |

### `student_seasons` - 학생 시즌 등록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| season_id | int | 시즌 ID |
| season_fee | decimal(10,2) | 시즌비 |
| registration_date | date | 등록일 |
| payment_status | enum | pending/paid/partial/cancelled |
| paid_amount | decimal(10,2) | 납부 금액 |
| paid_date | date | 납부일 |
| prorated_month | varchar(7) | 일할 계산 월 |
| prorated_amount | decimal(10,2) | 일할 금액 |
| prorated_details | json | 일할 상세 |
| is_continuous | tinyint(1) | 연속등록 여부 |
| previous_season_id | int | 이전 시즌 ID |
| discount_type | enum | none/rate/free/manual |
| discount_amount | decimal(10,2) | 할인 금액 |
| discount_reason | varchar(255) | 할인 사유 |
| time_slots | json | 타임슬롯 |
| payment_method | enum | account/card/cash |
| after_season_action | enum | regular/reregister/terminate |
| is_cancelled | tinyint(1) | 취소 여부 |
| cancellation_date | date | 취소일 |
| refund_amount | decimal(10,2) | 환불 금액 |
| refund_calculation | text | 환불 계산 내역 |
| notes | text | 비고 |

### `season_settings` - 시즌 설정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| season_id | int | 시즌 ID |
| non_season_end_date | date | 비시즌 종료일 |
| is_active | tinyint(1) | 활성 여부 |

---

## 재무 관리 (Finance)

### `expenses` - 지출
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| expense_date | date | 지출일 |
| category | varchar(100) | 카테고리 |
| description | varchar(255) | 설명 |
| amount | decimal(10,2) | 금액 |
| payment_method | enum | account/card/cash/other |
| salary_id | int | 연결된 급여 ID |
| recorded_by | int | 기록자 |

### `other_incomes` - 기타 수입
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| income_date | date | 수입일 |
| category | varchar(100) | 카테고리 |
| description | varchar(255) | 설명 |
| amount | decimal(10,2) | 금액 |
| recorded_by | int | 기록자 |

### `revenues` - 매출
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| revenue_date | date | 매출일 |
| category | varchar(100) | 카테고리 |
| amount | decimal(10,2) | 금액 |
| notes | text | 비고 |
| recorded_by | int | 기록자 |

### `salary_records` - 급여 기록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| academy_id | int | 학원 ID |
| year_month | varchar(7) | 연월 |
| base_amount | decimal(10,2) | 기본급 |
| morning_classes | int | 오전 수업 횟수 |
| afternoon_classes | int | 오후 수업 횟수 |
| evening_classes | int | 저녁 수업 횟수 |
| total_hours | decimal(5,2) | 총 근무 시간 |
| insurance_details | json | 보험 상세 |
| total_deduction | decimal(10,2) | 총 공제 |
| net_salary | decimal(10,2) | 실수령액 |
| payment_status | enum | pending/paid |
| notes | text | 비고 |

### `overtime_approvals` - 초과근무 승인
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | 강사 ID |
| academy_id | int | 학원 ID |
| work_date | date | 근무 날짜 |
| hours | decimal(5,2) | 초과 시간 |
| reason | text | 사유 |
| status | enum | pending/approved/rejected |
| approved_by | int | 승인자 |

---

## 알림 (Notification)

### `notification_settings` - 알림 설정
학원별 알림톡/SMS 설정. 솔라피 + SENS 이중 지원. **70+ 컬럼** (템플릿별 설정).

주요 컬럼 그룹:
- `service_type` - 서비스 타입 (solapi/sens)
- `solapi_*` - 솔라피 API 키, 각 알림 유형별 템플릿/버튼/이미지 설정
- `sens_*` - SENS API 키, 각 알림 유형별 템플릿 코드
- `auto_send_*` - 자동 발송 설정 (미납, 체험, 리마인더 등)
- `reminder_*` - D-1 리마인더 설정

> 전체 컬럼 목록은 너무 길어 생략. 필요 시 `SHOW COLUMNS FROM notification_settings` 참조.

### `notification_logs` - 알림 발송 기록
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| student_id | int | 학생 ID |
| message_type | enum | alimtalk/sms/lms/mms |
| recipient | varchar(255) | 수신자 |
| content | text | 내용 |
| status | enum | pending/sent/delivered/failed |
| error_message | text | 오류 메시지 |
| request_id | varchar(100) | 요청 ID |
| sent_at | timestamp | 발송 시각 |

### `notification` - 인앱 알림
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | varchar(20) | PK |
| type | varchar(40) | 알림 유형 |
| body | text | 알림 내용 |
| is_read | tinyint(1) | 읽음 여부 |
| is_deleted | tinyint(1) | 삭제 여부 |
| fk_user_id | varchar(20) | 사용자 ID |

### `user_notification_settings` - 사용자별 알림 설정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| user_id | int | 사용자 ID (UNI) |
| unpaid_attendance | tinyint(1) | 미납 출석 알림 |
| consultation_reminder | tinyint(1) | 상담 리마인더 |
| new_consultation | tinyint(1) | 새 상담 알림 |
| pause_ending | tinyint(1) | 휴원 종료 알림 |

### `sender_numbers` - 발신번호
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| phone_number | varchar(20) | 발신번호 |
| label | varchar(50) | 레이블 |
| is_default | tinyint(1) | 기본 발신번호 |

### `push_subscriptions` - 푸시 구독
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| user_id | int | 사용자 ID |
| endpoint | text | 구독 엔드포인트 |
| keys | json | 구독 키 |
| device_name | varchar(100) | 디바이스명 |

---

## 기타 테이블

### `academy_events` - 학원 일정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| title | varchar(200) | 일정 제목 |
| event_type | enum | work/academy/holiday/etc |
| start_date | date | 시작일 |
| end_date | date | 종료일 |
| is_holiday | tinyint(1) | 휴일 여부 (자동 휴강) |
| created_by | int | 생성자 |

### `academy_settings` - 학원 설정
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| settings | json | 학원 일반 설정 |
| onboarding_completed | tinyint(1) | 온보딩 완료 여부 |
| onboarding_completed_at | timestamp | 온보딩 완료 시각 |

### `audit_logs` - 감사 로그
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| user_id | int | 사용자 ID |
| action | varchar(50) | 수행 동작 |
| target_type | varchar(50) | 대상 유형 |
| target_id | int | 대상 ID |
| details | json | 상세 내용 |

### `holidays` - 공휴일
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| holiday_date | date | 공휴일 날짜 |
| name | varchar(100) | 공휴일명 |

### `student_performance` - 학생 성적/실기
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | 학생 ID |
| record_date | date | 기록 날짜 |
| record_type | enum | mock_exam/physical/competition |
| performance_data | json | 성적 데이터 |
| notes | text | 비고 |
| recorded_by | int | 기록자 |

### `test_applicants` - 테스트 신청자
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | 학원 ID |
| name | varchar(255) | 이름 |
| gender | enum | male/female |
| phone | varchar(255) | 연락처 |
| school | varchar(200) | 학교 |
| grade | varchar(20) | 학년 |
| test_month | varchar(7) | 시험 월 |
| test_date | date | 시험 날짜 |
| status | enum | pending/registered/cancelled |
| converted_student_id | int | 전환된 학생 ID |
| notes | text | 비고 |

---

## 암호화 필드 주의사항

다음 필드들은 **AES-256-GCM 암호화**되어 저장됩니다 (`ENC:` 접두사):

| 테이블 | 필드 |
|--------|------|
| students | name, phone, parent_phone, address |
| instructors | name, phone, address, resident_number, account_number, account_holder |
| consultations | student_name, student_phone, parent_name, parent_phone, notes |
| users | name, phone |

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

### 입시 유형 (admission_type)
- `regular` - 정시
- `early` - 수시
- `civil_service` - 공무원
- `military_academy` - 사관학교
- `police_university` - 경찰대

### 크레딧 유형 (credit_type)
- `carryover` - 이월
- `excused` - 공결
- `manual` - 수동
