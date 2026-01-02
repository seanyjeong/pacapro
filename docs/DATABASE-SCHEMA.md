# P-ACA 데이터베이스 스키마

> **Last Updated**: 2026-01-02
> **Database**: MySQL 8.0
> **Total Tables**: 46 (P-ACA Core)

---

## 목차

1. [핵심 테이블](#핵심-테이블)
2. [학생 관련](#학생-관련)
3. [강사 관련](#강사-관련)
4. [수업/스케줄](#수업스케줄)
5. [결제/급여](#결제급여)
6. [상담](#상담)
7. [알림/푸시](#알림푸시)
8. [시즌](#시즌)
9. [기타](#기타)

---

## 핵심 테이블

### academies (학원)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| owner_user_id | int | FK → users.id |
| name | varchar(200) | 학원명 |
| business_number | varchar(20) | 사업자번호 |
| address | varchar(500) | 주소 |
| phone | varchar(20) | 전화번호 |
| email | varchar(255) | 이메일 |
| operating_hours | json | 운영시간 |
| tuition_due_day | int | 기본 납부일 |
| slug | varchar(50) | URL 슬러그 (상담예약용) |
| created_at | timestamp | |
| updated_at | timestamp | |

### academy_settings (학원 설정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| tuition_due_day | int | 납부일 |
| salary_payment_day | int | 급여일 |
| salary_month_type | enum | 'current', 'next' |
| morning_class_time | varchar(20) | 오전 수업시간 |
| afternoon_class_time | varchar(20) | 오후 수업시간 |
| evening_class_time | varchar(20) | 저녁 수업시간 |
| weekly_tuition_rates | json | 주당 수업료 |
| settings | json | 기타 설정 |
| onboarding_completed | tinyint(1) | 온보딩 완료 여부 |

### users (사용자)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| email | varchar(255) | 이메일 (로그인) |
| password_hash | varchar(255) | 비밀번호 해시 |
| name | varchar(255) | 🔐 암호화 |
| phone | varchar(255) | 🔐 암호화 |
| role | enum | 'owner', 'admin', 'teacher', 'staff' |
| academy_id | int | FK |
| permissions | json | 권한 설정 |
| position | varchar(50) | 직책 |
| instructor_id | int | 연결된 강사 ID |
| approval_status | enum | 'pending', 'approved', 'rejected' |
| is_active | tinyint(1) | 활성 상태 |
| last_login_at | timestamp | 마지막 로그인 |
| reset_token | varchar(255) | 비밀번호 재설정 토큰 |

---

## 학생 관련

### students (학생)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| name | varchar(255) | 🔐 암호화 |
| gender | enum | 'male', 'female' |
| student_type | enum | 'exam', 'adult' |
| phone | varchar(255) | 🔐 암호화 |
| parent_phone | varchar(255) | 🔐 암호화 |
| school | varchar(200) | 학교 |
| grade | varchar(20) | 학년 |
| address | text | 🔐 암호화 |
| admission_type | enum | 'regular', 'early', 'civil_service', ... |
| class_days | json | 수업 요일 [0-6] |
| weekly_count | int | 주당 횟수 |
| monthly_tuition | decimal(10,2) | 월 수업료 |
| discount_rate | decimal(5,2) | 할인율 |
| final_monthly_tuition | decimal(10,2) | 최종 월 수업료 |
| time_slot | enum | 'morning', 'afternoon', 'evening' |
| status | enum | 'active', 'paused', 'graduated', 'withdrawn', 'trial', 'pending' |
| is_trial | tinyint(1) | 체험생 여부 |
| trial_remaining | int | 남은 체험 횟수 |
| trial_dates | json | 체험 일정 |
| rest_start_date | date | 휴원 시작 |
| rest_end_date | date | 휴원 종료 |
| rest_reason | varchar(255) | 휴원 사유 |
| memo | text | 메모 |
| payment_due_day | int | 개인 납부일 |
| enrollment_date | date | 등록일 |
| withdrawal_date | date | 퇴원일 |
| deleted_at | timestamp | 소프트 삭제 |

**status 상태별 규칙:**
| 상태 | 스케줄 생성 | 학원비 생성 | 진급 대상 |
|------|------------|------------|----------|
| active | O | O | O |
| paused | X | X | O |
| withdrawn | X | X | X |
| graduated | X | X | X |
| trial | O | X | X |
| pending | X | X | X |

### attendance (출석)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| class_schedule_id | int | FK → class_schedules.id |
| student_id | int | FK → students.id |
| attendance_status | enum | 'present', 'absent', 'late', 'excused' |
| makeup_date | date | 보강일 |
| notes | text | 메모 |
| is_makeup | tinyint(1) | 보강 수업 여부 |
| recorded_by | int | 기록자 |

### rest_credits (휴원 크레딧)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | FK |
| academy_id | int | FK |
| rest_start_date | date | 휴원 시작 |
| rest_end_date | date | 휴원 종료 |
| rest_days | int | 휴원 일수 |
| credit_amount | int | 크레딧 금액 |
| remaining_amount | int | 잔여 금액 |
| credit_type | enum | 'carryover', 'refund', 'manual' |
| status | enum | 'pending', 'partial', 'applied', 'refunded', 'cancelled' |
| applied_to_payment_id | int | 적용된 학원비 ID |

### student_performance (학생 성적/체력)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | FK |
| record_date | date | 기록일 |
| record_type | enum | 'mock_exam', 'physical', 'competition' |
| performance_data | json | 성적 데이터 |
| notes | text | 비고 |

---

## 강사 관련

### instructors (강사)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| user_id | int | FK (연결된 사용자) |
| name | varchar(255) | 🔐 암호화 |
| phone | varchar(255) | 🔐 암호화 |
| address | text | 🔐 암호화 |
| resident_number | varchar(255) | 🔐 암호화 (주민번호) |
| account_number | varchar(255) | 🔐 암호화 |
| account_holder | varchar(255) | 🔐 암호화 |
| gender | enum | 'male', 'female' |
| birth_date | date | 생년월일 |
| hire_date | date | 입사일 |
| salary_type | enum | 'hourly', 'per_class', 'monthly', 'mixed' |
| instructor_type | enum | 'teacher', 'assistant' |
| work_days | json | 근무 요일 |
| base_salary | decimal(10,2) | 기본급 |
| hourly_rate | decimal(10,2) | 시급 |
| morning_class_rate | decimal(10,2) | 오전 타임급 |
| afternoon_class_rate | decimal(10,2) | 오후 타임급 |
| evening_class_rate | decimal(10,2) | 저녁 타임급 |
| tax_type | enum | '3.3%', 'insurance', 'none' |
| bank_name | varchar(100) | 은행명 |
| status | enum | 'active', 'on_leave', 'retired' |
| deleted_at | timestamp | 소프트 삭제 |

### instructor_attendance (강사 출근)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | FK |
| class_schedule_id | int | FK |
| work_date | date | 근무일 |
| time_slot | enum | 'morning', 'afternoon', 'evening' |
| check_in_time | time | 출근 시간 |
| check_out_time | time | 퇴근 시간 |
| attendance_status | enum | 'present', 'absent', 'late', 'day_off' |

### instructor_schedules (강사 근무 배정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| instructor_id | int | FK |
| work_date | date | 근무일 |
| time_slot | enum | 'morning', 'afternoon', 'evening' |
| scheduled_start_time | time | 예정 시작 (시급제용) |
| scheduled_end_time | time | 예정 종료 (시급제용) |

### overtime_approvals (초과근무 승인)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | FK |
| work_date | date | 근무일 |
| time_slot | enum | |
| request_type | enum | 'overtime', 'extra_day' |
| original_end_time | time | 원래 종료시간 |
| actual_end_time | time | 실제 종료시간 |
| overtime_minutes | int | 초과 분 |
| status | enum | 'pending', 'approved', 'rejected' |
| approved_by | int | 승인자 |

---

## 수업/스케줄

### class_schedules (수업 스케줄)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| class_id | int | FK |
| season_id | int | FK |
| target_grade | varchar(20) | 대상 학년 |
| class_date | date | 수업일 |
| time_slot | enum | 'morning', 'afternoon', 'evening' |
| instructor_id | int | FK |
| title | varchar(200) | 수업명 |
| content | text | 수업 내용 |
| attendance_taken | tinyint(1) | 출석 체크 여부 |
| notes | text | 비고 |

### classes (반)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| class_name | varchar(100) | 반 이름 |
| class_type | enum | 'exam', 'adult' |
| grade | varchar(20) | 학년 |
| admission_type | enum | 'regular', 'early' |
| default_time_slot | enum | 기본 시간대 |
| status | enum | 'active', 'inactive' |

### student_classes (학생-반 연결)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | FK |
| class_id | int | FK |
| assigned_date | date | 배정일 |
| status | enum | 'active', 'inactive' |

---

## 결제/급여

### student_payments (학생 학원비)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | FK |
| academy_id | int | FK |
| year_month | varchar(7) | '2026-01' 형식 |
| payment_type | enum | 'monthly', 'season', 'product', 'other' |
| base_amount | decimal(10,2) | 기본 금액 |
| discount_amount | decimal(10,2) | 할인 금액 |
| additional_amount | decimal(10,2) | 추가 금액 |
| carryover_amount | int | 이월 금액 |
| refund_amount | int | 환불 금액 |
| final_amount | decimal(10,2) | 최종 금액 |
| paid_amount | decimal(12,2) | 납부 금액 |
| is_prorated | tinyint(1) | 일할 계산 여부 |
| proration_details | json | 일할 계산 상세 |
| due_date | date | 납부기한 |
| payment_status | enum | 'pending', 'paid', 'partial', 'overdue', 'cancelled' |
| paid_date | date | 납부일 |
| payment_method | enum | 'account', 'card', 'cash', 'other' |
| season_id | int | 시즌 ID (시즌비인 경우) |

### salary_records (급여 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| instructor_id | int | FK |
| year_month | varchar(7) | '2026-01' 형식 |
| base_amount | decimal(10,2) | 기본 급여 |
| morning_classes | int | 오전 수업 수 |
| afternoon_classes | int | 오후 수업 수 |
| evening_classes | int | 저녁 수업 수 |
| total_hours | decimal(5,2) | 총 시간 |
| incentive_amount | decimal(10,2) | 인센티브 |
| tax_type | varchar(20) | 세금 유형 |
| tax_amount | decimal(10,2) | 세금 |
| insurance_details | json | 4대보험 상세 |
| total_deduction | decimal(10,2) | 총 공제액 |
| net_salary | decimal(10,2) | 실수령액 |
| payment_status | enum | 'pending', 'paid' |
| payment_date | date | 지급일 |
| payment_method | enum | 'account', 'cash', 'cheque' |

### expenses (지출)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| expense_date | date | 지출일 |
| category | varchar(100) | 카테고리 |
| amount | decimal(10,2) | 금액 |
| salary_id | int | 연결된 급여 ID |
| instructor_id | int | 연결된 강사 ID |
| payment_method | enum | 'account', 'card', 'cash', 'other' |

### other_incomes (기타 수입)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| income_date | date | 수입일 |
| category | enum | 'clothing', 'shoes', 'equipment', 'beverage', 'snack', 'other' |
| amount | decimal(10,2) | 금액 |
| student_id | int | 관련 학생 |
| payment_method | enum | 'cash', 'card', 'transfer' |

### revenues (매출)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| revenue_date | date | 매출일 |
| category | varchar(100) | 카테고리 |
| amount | decimal(10,2) | 금액 |
| payment_id | int | 관련 학원비 ID |
| student_id | int | 관련 학생 ID |

---

## 상담

### consultations (상담 예약)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| consultation_type | enum | 'new_registration', 'learning' |
| learning_type | enum | 'regular', 'admission', 'parent', 'counseling' |
| parent_name | varchar(255) | 학부모명 |
| parent_phone | varchar(255) | 학부모 연락처 |
| student_name | varchar(255) | 학생명 |
| student_grade | enum | '초1'~'고3', 'N수', '성인' |
| student_school | varchar(100) | 학교 |
| gender | enum | 'male', 'female' |
| target_school | varchar(100) | 목표 대학 |
| referral_sources | json | 유입 경로 |
| preferred_date | date | 희망 상담일 |
| preferred_time | time | 희망 상담 시간 |
| linked_student_id | int | 연결된 재원생 ID |
| status | enum | 'pending', 'confirmed', 'completed', 'cancelled', 'no_show' |
| checklist | json | 상담 체크리스트 |
| consultation_memo | text | 상담 메모 |
| reservation_number | varchar(20) | 예약번호 |

### student_consultations (재원생 상담 기록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| student_id | int | FK |
| consultation_id | int | FK |
| consultation_date | date | 상담일 |
| consultation_type | enum | 'regular', 'admission', 'parent', 'counseling' |
| admission_type | enum | 'early', 'regular', 'both' |
| school_grade_avg | decimal(3,2) | 내신 평균 |
| mock_test_scores | json | 모의고사 점수 |
| academic_memo | text | 학업 메모 |
| physical_records | json | 체력 기록 |
| physical_memo | text | 체력 메모 |
| target_university_1 | varchar(100) | 목표 대학 1 |
| target_university_2 | varchar(100) | 목표 대학 2 |
| general_memo | text | 종합 메모 |

### consultation_settings (상담 설정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| is_enabled | tinyint(1) | 활성화 여부 |
| page_title | varchar(100) | 페이지 제목 |
| page_description | text | 페이지 설명 |
| slot_duration | int | 슬롯 시간 (분) |
| max_reservations_per_slot | int | 슬롯당 최대 예약 |
| advance_days | int | 예약 가능 일수 |
| min_advance_hours | int | 최소 예약 시간 |
| referral_sources | json | 유입 경로 옵션 |

### consultation_weekly_hours (상담 가능 시간)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| day_of_week | tinyint | 요일 (0-6) |
| is_available | tinyint(1) | 가능 여부 |
| start_time | time | 시작 시간 |
| end_time | time | 종료 시간 |

### consultation_blocked_slots (상담 차단 시간)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| blocked_date | date | 차단일 |
| is_all_day | tinyint(1) | 종일 차단 |
| start_time | time | 시작 |
| end_time | time | 종료 |
| reason | varchar(200) | 사유 |

---

## 알림/푸시

### notification_settings (알림톡 설정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| service_type | enum | 'sens', 'solapi' |
| naver_access_key | varchar(255) | SENS Access Key |
| naver_secret_key | varchar(500) | SENS Secret Key |
| solapi_api_key | varchar(255) | Solapi API Key |
| solapi_api_secret | varchar(500) | Solapi Secret |
| solapi_pfid | varchar(255) | Solapi 발신 프로필 |
| is_enabled | tinyint(1) | 활성화 |
| solapi_auto_enabled | tinyint(1) | 자동 발송 |
| solapi_auto_hour | int | 발송 시간 |
| solapi_template_id | varchar(100) | 템플릿 ID |
| solapi_template_content | text | 템플릿 내용 |
| solapi_buttons | text | 버튼 설정 |
| solapi_image_url | varchar(500) | 이미지 URL |
| (+ 상담/체험/미납 각각의 설정) | ... | ... |

### notification_logs (알림 발송 로그)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| student_id | int | FK |
| payment_id | int | FK |
| recipient_name | varchar(100) | 수신자명 |
| recipient_phone | varchar(20) | 수신 번호 |
| message_type | enum | 'alimtalk', 'sms', 'lms', 'mms' |
| template_code | varchar(50) | 템플릿 코드 |
| message_content | text | 메시지 내용 |
| status | enum | 'pending', 'sent', 'delivered', 'failed' |
| error_message | text | 에러 메시지 |
| sent_at | timestamp | 발송 시간 |

### push_subscriptions (PWA 푸시 구독)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| user_id | int | FK |
| endpoint | text | 푸시 엔드포인트 |
| p256dh | varchar(255) | 암호화 키 |
| auth | varchar(255) | 인증 키 |
| device_name | varchar(100) | 기기명 |

### user_notification_settings (사용자 알림 설정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| user_id | int | FK |
| unpaid_attendance | tinyint(1) | 미납자 출석 알림 |
| consultation_reminder | tinyint(1) | 상담 리마인더 |
| new_consultation | tinyint(1) | 새 상담 예약 |
| pause_ending | tinyint(1) | 휴원 종료 알림 |

### sender_numbers (발신번호)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| service_type | enum | 'solapi', 'sens' |
| phone | varchar(20) | 전화번호 |
| label | varchar(50) | 라벨 |
| is_default | tinyint(1) | 기본 발신번호 |

---

## 시즌

### seasons (시즌)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| season_name | varchar(100) | 시즌명 |
| season_type | enum | 'early', 'regular' |
| non_season_end_date | date | 비시즌 종료일 |
| season_start_date | date | 시즌 시작일 |
| season_end_date | date | 시즌 종료일 |
| operating_days | json | 운영 요일 |
| grade_time_slots | json | 학년별 시간대 |
| default_season_fee | decimal(10,2) | 기본 시즌비 |
| allows_continuous | tinyint(1) | 연속 등록 허용 |
| continuous_discount_type | enum | 'none', 'rate', 'free' |
| continuous_discount_rate | decimal(5,2) | 연속 할인율 |
| status | enum | 'upcoming', 'active', 'ended' |

### student_seasons (학생 시즌 등록)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| student_id | int | FK |
| season_id | int | FK |
| season_fee | decimal(10,2) | 시즌비 |
| registration_date | date | 등록일 |
| payment_status | enum | 'pending', 'paid', 'partial', 'cancelled' |
| paid_amount | decimal(10,2) | 납부 금액 |
| prorated_month | varchar(7) | 일할 적용 월 |
| prorated_amount | decimal(10,2) | 일할 금액 |
| prorated_details | json | 일할 상세 |
| is_continuous | tinyint(1) | 연속 등록 |
| discount_type | enum | 'none', 'rate', 'free', 'manual' |
| discount_amount | decimal(10,2) | 할인 금액 |
| time_slots | json | 시간대 |
| after_season_action | enum | 'regular', 'reregister', 'terminate' |
| is_cancelled | tinyint(1) | 취소 여부 |
| refund_amount | decimal(10,2) | 환불 금액 |

---

## 기타

### holidays (휴일)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| holiday_date | date | 휴일 |
| holiday_name | varchar(100) | 휴일명 |
| is_class_day | tinyint(1) | 수업일 여부 |

### audit_logs (감사 로그)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| user_id | int | FK |
| user_email | varchar(255) | 사용자 이메일 |
| action | varchar(100) | 작업 유형 |
| table_name | varchar(100) | 테이블명 |
| record_id | int | 레코드 ID |
| old_values | json | 이전 값 |
| new_values | json | 새 값 |
| ip_address | varchar(45) | IP 주소 |

### toss_settings (토스 결제 설정)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| merchant_id | varchar(50) | 가맹점 ID |
| plugin_api_key | varchar(100) | 플러그인 API 키 |
| callback_secret | varchar(100) | 콜백 시크릿 |
| is_active | tinyint(1) | 활성화 |
| auto_match_enabled | tinyint(1) | 자동 매칭 |

### toss_payment_history (토스 결제 내역)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| payment_id | int | FK |
| academy_id | int | FK |
| order_id | varchar(100) | 주문 ID |
| payment_key | varchar(100) | 결제 키 |
| amount | decimal(10,0) | 금액 |
| method | varchar(20) | 결제 수단 |
| approved_at | datetime | 승인 시간 |
| receipt_url | varchar(500) | 영수증 URL |

### toss_payment_queue (토스 결제 대기열)
| 컬럼 | 타입 | 설명 |
|------|------|------|
| id | int | PK |
| academy_id | int | FK |
| order_id | varchar(100) | 주문 ID |
| payment_key | varchar(100) | 결제 키 |
| amount | decimal(10,0) | 금액 |
| match_status | enum | 'pending', 'matched', 'ignored', 'error' |
| matched_payment_id | int | 매칭된 학원비 ID |
| matched_at | datetime | 매칭 시간 |

---

## 암호화 필드 (🔐)

다음 필드들은 AES-256-GCM으로 암호화됨:

| 테이블 | 필드 |
|--------|------|
| students | name, phone, parent_phone, address |
| instructors | name, phone, address, resident_number, account_number, account_holder |
| users | name, phone |

**주의**: 암호화된 필드는 SQL LIKE 검색 불가 → 메모리 필터링 사용

---

## 인덱스 및 성능

주요 쿼리 패턴에 최적화된 인덱스:

```sql
-- students: 학원별 상태 조회
INDEX idx_academy_status (academy_id, status, deleted_at)

-- student_payments: 월별 학원비 조회
INDEX idx_academy_yearmonth (academy_id, year_month, payment_status)

-- class_schedules: 일별 수업 조회
INDEX idx_academy_date (academy_id, class_date, time_slot)

-- attendance: 출석 조회
INDEX idx_schedule_student (class_schedule_id, student_id)
```
