# P-ACA Database Schema Reference

> **최종 업데이트**: 2025-11-26
> **데이터베이스**: MySQL 8.0
> **실제 서버 스키마 기준 100% 정확**

## 📋 목차

1. [사용자 관리](#사용자-관리)
2. [학생 관리](#학생-관리)
3. [강사 관리](#강사-관리)
4. [수업 관리](#수업-관리)
5. [재무 관리](#재무-관리)
6. [시즌 관리](#시즌-관리)
7. [시스템 관리](#시스템-관리)

---

## 사용자 관리

### 1. users (사용자 계정)

```sql
CREATE TABLE `users` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) NOT NULL,
  `role` enum('owner','admin','teacher','staff') DEFAULT 'staff',
  `phone` varchar(20) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_email` (`email`),
  KEY `academy_id` (`academy_id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE
);
```

**주요 필드:**
- `role`: owner(원장), admin(관리자), teacher(강사), staff(직원)
- `is_active`: 계정 활성화 상태

### 2. academies (학원 정보)

```sql
CREATE TABLE `academies` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(200) NOT NULL,
  `business_number` varchar(20) DEFAULT NULL,
  `owner_name` varchar(100) DEFAULT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
);
```

### 3. academy_settings (학원 설정)

```sql
CREATE TABLE `academy_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `setting_key` varchar(100) NOT NULL,
  `setting_value` text,
  `description` varchar(500) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_academy_setting` (`academy_id`,`setting_key`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE
);
```

---

## 학생 관리

### 4. students (학생 정보)

```sql
CREATE TABLE `students` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `name` varchar(100) NOT NULL COMMENT '학생 이름',
  `student_number` varchar(50) DEFAULT NULL COMMENT '학번/학생 번호',
  `phone` varchar(20) DEFAULT NULL COMMENT '학생 연락처',
  `parent_phone` varchar(20) DEFAULT NULL COMMENT '학부모 연락처',
  `school` varchar(200) DEFAULT NULL COMMENT '학교명',
  `grade` int DEFAULT NULL COMMENT '학년 (1,2,3학년, 또는 N수)',
  `grade_type` enum('1','2','3','N','graduate') DEFAULT '1' COMMENT '학년 구분',
  `address` text COMMENT '주소',
  `admission_type` enum('susi','jeongsi','preliminary') DEFAULT 'susi' COMMENT '수시/정시/예비반',
  `profile_image_url` varchar(500) DEFAULT NULL COMMENT '프로필 사진 URL',
  `class_days` json NOT NULL COMMENT '수업 요일 (0=일, 1=월, ..., 6=토)',
  `weekly_count` int NOT NULL DEFAULT '3' COMMENT '주 수업 횟수 (1~7)',
  `monthly_tuition` decimal(10,2) NOT NULL COMMENT '월 수강료',
  `discount_rate` decimal(5,2) DEFAULT '0.00' COMMENT '할인율 (%)',
  `final_monthly_tuition` decimal(10,2) DEFAULT NULL COMMENT '최종 월 수강료 (할인 적용 후)',
  `is_season_registered` tinyint(1) DEFAULT '0' COMMENT '시즌 등록 여부',
  `current_season_id` int DEFAULT NULL COMMENT '현재 등록된 시즌 ID',
  `status` enum('active','paused','graduated','withdrawn') DEFAULT 'active' COMMENT '학생 상태',
  `enrollment_date` date DEFAULT NULL COMMENT '등록일',
  `withdrawal_date` date DEFAULT NULL COMMENT '퇴원일',
  `notes` text COMMENT '특이사항',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE
);
```

**주요 필드:**
- `class_days`: JSON 배열 `[1,3,5]` = 월수금
- `grade_type`: 1학년, 2학년, 3학년, N수생, 졸업생
- `admission_type`: susi(수시), jeongsi(정시), preliminary(예비반)
- `status`: active(재원), paused(휴원), graduated(졸업), withdrawn(퇴원)

### 5. student_payments (학원비 납부)

```sql
CREATE TABLE `student_payments` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `academy_id` int NOT NULL,
  `year_month` varchar(7) NOT NULL,
  `payment_type` enum('monthly','season','product','other') NOT NULL,
  `base_amount` decimal(10,2) NOT NULL,
  `discount_amount` decimal(10,2) DEFAULT '0.00',
  `additional_amount` decimal(10,2) DEFAULT '0.00',
  `final_amount` decimal(10,2) NOT NULL,
  `is_prorated` tinyint(1) DEFAULT '0',
  `proration_details` json DEFAULT NULL,
  `due_date` date NOT NULL,
  `payment_status` enum('pending','paid','partial','overdue','cancelled') DEFAULT 'pending',
  `paid_date` date DEFAULT NULL,
  `payment_method` enum('account','card','cash','other') DEFAULT NULL,
  `season_id` int DEFAULT NULL,
  `description` text,
  `notes` text,
  `recorded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`season_id`) REFERENCES `season_settings` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**주요 필드:**
- ⚠️ **year_month**: MySQL 예약어이므로 쿼리 시 백틱 필수 → \`year_month\`
- `payment_type`: monthly(월납), season(시즌비), product(상품), other(기타)
- `payment_status`: pending(대기), paid(완납), partial(부분납), overdue(연체), cancelled(취소)

### 6. student_performance (학생 성적/실기 기록)

```sql
CREATE TABLE `student_performance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `record_date` date NOT NULL COMMENT '기록 날짜',
  `record_type` enum('mock_exam','physical','competition') DEFAULT NULL COMMENT '기록 유형',
  `performance_data` json DEFAULT NULL COMMENT '성적 또는 실기 데이터',
  `notes` text,
  `recorded_by` int DEFAULT NULL COMMENT '기록한 사용자 ID',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**performance_data JSON 구조:**
```json
// mock_exam (모의고사)
{
  "subjects": [
    {"name": "국어", "score": 90, "max_score": 100},
    {"name": "영어", "score": 85, "max_score": 100}
  ],
  "rank": 5
}

// physical (체력측정)
{
  "events": [
    {"name": "100m 달리기", "record": 12.5, "unit": "초"},
    {"name": "멀리뛰기", "record": 6.2, "unit": "m"}
  ]
}

// competition (대회)
{
  "name": "서울시 체육대회",
  "rank": 2,
  "participants": 50
}
```

---

## 강사 관리

### 7. instructors (강사 정보)

```sql
CREATE TABLE `instructors` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `user_id` int DEFAULT NULL COMMENT '연결된 사용자 계정 ID (있는 경우)',
  `name` varchar(100) NOT NULL COMMENT '강사 이름',
  `phone` varchar(20) DEFAULT NULL COMMENT '연락처',
  `email` varchar(255) DEFAULT NULL,
  `address` text COMMENT '주소',
  `birth_date` date DEFAULT NULL COMMENT '생년월일',
  `resident_number` varchar(14) DEFAULT NULL COMMENT '주민번호 (암호화 필요)',
  `hire_date` date DEFAULT NULL COMMENT '입사일',
  `salary_type` enum('hourly','per_class','monthly','mixed') NOT NULL COMMENT '급여 유형',
  `base_salary` decimal(10,2) DEFAULT '0.00' COMMENT '기본급 (월급제)',
  `hourly_rate` decimal(10,2) DEFAULT '0.00' COMMENT '시급',
  `morning_class_rate` decimal(10,2) DEFAULT '0.00' COMMENT '오전 수업 단가',
  `afternoon_class_rate` decimal(10,2) DEFAULT '0.00' COMMENT '오후 수업 단가',
  `evening_class_rate` decimal(10,2) DEFAULT '0.00' COMMENT '저녁 수업 단가',
  `incentive_rate` decimal(5,2) DEFAULT '0.00' COMMENT '인센티브율 (%)',
  `tax_type` enum('3.3%','insurance','none') DEFAULT '3.3%' COMMENT '세금 공제 유형',
  `bank_name` varchar(100) DEFAULT NULL COMMENT '은행명',
  `account_number` varchar(100) DEFAULT NULL COMMENT '계좌번호',
  `account_holder` varchar(100) DEFAULT NULL COMMENT '예금주',
  `status` enum('active','on_leave','retired') DEFAULT 'active',
  `notes` text COMMENT '특이사항',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at` timestamp NULL DEFAULT NULL COMMENT '소프트 삭제',
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**주요 필드:**
- `salary_type`: hourly(시급), per_class(수업당), monthly(월급), mixed(혼합)
- `tax_type`: 3.3%(간이세금), insurance(4대보험), none(없음)

### 8. salary_records (급여 기록)

```sql
CREATE TABLE `salary_records` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instructor_id` int NOT NULL,
  `year_month` varchar(7) NOT NULL,
  `base_amount` decimal(10,2) NOT NULL,
  `morning_classes` int DEFAULT '0',
  `afternoon_classes` int DEFAULT '0',
  `evening_classes` int DEFAULT '0',
  `total_hours` decimal(5,2) DEFAULT '0.00',
  `incentive_amount` decimal(10,2) DEFAULT '0.00',
  `tax_type` varchar(20) NOT NULL,
  `tax_amount` decimal(10,2) DEFAULT '0.00',
  `insurance_details` json DEFAULT NULL,
  `total_deduction` decimal(10,2) DEFAULT '0.00',
  `net_salary` decimal(10,2) NOT NULL,
  `payment_status` enum('pending','paid') DEFAULT 'pending',
  `payment_date` date DEFAULT NULL,
  `payment_method` enum('account','cash','cheque') DEFAULT 'account',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_instructor_salary` (`instructor_id`,`year_month`),
  FOREIGN KEY (`instructor_id`) REFERENCES `instructors` (`id`) ON DELETE CASCADE
);
```

**주요 필드:**
- ⚠️ **year_month**: MySQL 예약어이므로 쿼리 시 백틱 필수 → \`year_month\`
- `insurance_details`: 4대보험 상세 내역 (JSON)

### 9. instructor_attendance (강사 출근 기록)

```sql
CREATE TABLE `instructor_attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `instructor_id` int NOT NULL,
  `work_date` date NOT NULL,
  `time_slot` enum('morning','afternoon','evening') NOT NULL,
  `check_in_time` time DEFAULT NULL,
  `check_out_time` time DEFAULT NULL,
  `attendance_status` enum('present','absent','late','half_day') DEFAULT 'present',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_instructor_date_slot` (`instructor_id`,`attendance_date`,`time_slot`),
  FOREIGN KEY (`instructor_id`) REFERENCES `instructors` (`id`) ON DELETE CASCADE
);
```

---

## 수업 관리

### 10. classes (반/수업 정의) - NEW

```sql
CREATE TABLE `classes` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `class_name` varchar(100) NOT NULL COMMENT '반 이름 (예: 고3정시반, 고2수시반)',
  `grade` int DEFAULT NULL COMMENT '학년 (1, 2, 3)',
  `grade_type` enum('middle','high') DEFAULT 'high' COMMENT '중등/고등',
  `admission_type` enum('regular','early') DEFAULT 'regular' COMMENT '정시/수시',
  `description` text COMMENT '반 설명',
  `default_time_slot` enum('morning','afternoon','evening') DEFAULT 'afternoon' COMMENT '기본 시간대',
  `status` enum('active','inactive') DEFAULT 'active' COMMENT '반 상태',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_academy_id` (`academy_id`),
  KEY `idx_status` (`status`),
  CONSTRAINT `fk_classes_academy` FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE
);
```

**주요 필드:**
- `class_name`: 반 이름 (고3정시반, 고2수시반 등)
- `grade_type`: middle(중등), high(고등)
- `admission_type`: regular(정시), early(수시)
- `default_time_slot`: 일괄 스케줄 생성 시 기본 시간대

### 11. class_schedules (수업 일정)

```sql
CREATE TABLE `class_schedules` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `class_id` int DEFAULT NULL COMMENT '반 ID (NEW)',
  `class_date` date NOT NULL,
  `time_slot` enum('morning','afternoon','evening') NOT NULL,
  `instructor_id` int DEFAULT NULL,
  `title` varchar(200) DEFAULT NULL,
  `content` text,
  `attendance_taken` tinyint(1) DEFAULT '0',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_class_id` (`class_id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`instructor_id`) REFERENCES `instructors` (`id`) ON DELETE SET NULL
);
```

**NEW: class_id 컬럼 추가됨 (2025-11-26)**
- 반(classes)과 연결하여 일괄 스케줄 생성 지원

### 12. attendance (학생 출석)

```sql
CREATE TABLE `attendance` (
  `id` int NOT NULL AUTO_INCREMENT,
  `class_schedule_id` int NOT NULL,
  `student_id` int NOT NULL,
  `attendance_status` enum('present','absent','late','excused') DEFAULT 'present',
  `notes` text,
  `recorded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_class_student` (`class_schedule_id`,`student_id`),
  FOREIGN KEY (`class_schedule_id`) REFERENCES `class_schedules` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**⚠️ 중요:** attendance는 class_schedules를 참조하므로, 날짜 정보는 JOIN으로 가져와야 함

---

## 재무 관리

### 12. revenues (수입)

```sql
CREATE TABLE `revenues` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `revenue_date` date NOT NULL,
  `category` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `payment_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `description` text,
  `notes` text,
  `recorded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`payment_id`) REFERENCES `student_payments` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**주요 필드:**
- ⚠️ `category` 사용 (revenue_type 아님!)
- 일반적인 카테고리: 'tuition'(수강료), 'season'(시즌비), 'product'(상품판매) 등

### 13. expenses (지출)

```sql
CREATE TABLE `expenses` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `expense_date` date NOT NULL,
  `category` varchar(100) NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `salary_id` int DEFAULT NULL,
  `instructor_id` int DEFAULT NULL,
  `description` text,
  `payment_method` enum('account','card','cash','other') DEFAULT NULL,
  `notes` text,
  `recorded_by` int DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`salary_id`) REFERENCES `salary_records` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`instructor_id`) REFERENCES `instructors` (`id`) ON DELETE SET NULL,
  FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

**주요 필드:**
- ⚠️ `category` 사용 (expense_type 아님!)
- ⚠️ `student_id` 필드 없음 → 학생 정보는 description에 직접 포함
- 일반적인 카테고리: 'salary'(급여), '사무용품', '운동기구', '강사 교통비' 등

---

## 시즌 관리

### 14. season_settings (시즌 설정)

```sql
CREATE TABLE `season_settings` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `season_name` varchar(100) NOT NULL COMMENT '시즌명 (예: 2025 수시, 2025 정시)',
  `season_start_date` date NOT NULL COMMENT '시즌 시작일',
  `season_end_date` date NOT NULL COMMENT '시즌 종료일',
  `non_season_end_date` date NOT NULL COMMENT '비시즌 종강일',
  `default_season_fee` decimal(10,2) DEFAULT NULL COMMENT '기본 시즌비 (참고용)',
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`)
);
```

**주요 필드:**
- ⚠️ `description` 필드 없음!
- `non_season_end_date`: 시즌 시작 전 마지막 수업일

### 15. student_seasons (학생 시즌 등록)

```sql
CREATE TABLE `student_seasons` (
  `id` int NOT NULL AUTO_INCREMENT,
  `student_id` int NOT NULL,
  `season_id` int NOT NULL,
  `season_fee` decimal(10,2) NOT NULL,
  `registration_date` date NOT NULL,
  `payment_status` enum('pending','paid','partial','cancelled') DEFAULT 'pending',
  `paid_amount` decimal(10,2) DEFAULT '0.00',
  `paid_date` date DEFAULT NULL,
  `payment_method` enum('account','card','cash') DEFAULT NULL,
  `after_season_action` enum('regular','reregister','terminate') DEFAULT NULL,
  `is_cancelled` tinyint(1) DEFAULT '0',
  `cancellation_date` date DEFAULT NULL,
  `refund_amount` decimal(10,2) DEFAULT '0.00',
  `refund_calculation` text,
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`season_id`) REFERENCES `season_settings` (`id`) ON DELETE CASCADE
);
```

**주요 필드:**
- `after_season_action`: regular(정규반 전환), reregister(재등록), terminate(종료)

---

## 시스템 관리

### 16. holidays (휴일)

```sql
CREATE TABLE `holidays` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `holiday_date` date NOT NULL,
  `holiday_name` varchar(100) NOT NULL,
  `holiday_type` enum('national','academy','other') DEFAULT 'academy',
  `is_recurring` tinyint(1) DEFAULT '0',
  `notes` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE
);
```

### 17. notifications (알림)

```sql
CREATE TABLE `notifications` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `student_id` int DEFAULT NULL,
  `notification_type` enum('payment_reminder','attendance_alert','system','other') NOT NULL,
  `title` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `is_read` tinyint(1) DEFAULT '0',
  `sent_at` timestamp NULL DEFAULT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE SET NULL
);
```

### 18. audit_logs (감사 로그)

```sql
CREATE TABLE `audit_logs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `academy_id` int NOT NULL,
  `user_id` int DEFAULT NULL,
  `action_type` varchar(50) NOT NULL,
  `table_name` varchar(100) DEFAULT NULL,
  `record_id` int DEFAULT NULL,
  `old_values` json DEFAULT NULL,
  `new_values` json DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
  FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL
);
```

---

## ⚠️ 주요 주의사항

### 1. MySQL 예약어
- `year_month`: 쿼리 시 반드시 백틱 사용 → \`year_month\`

### 2. 필드명 차이
- ❌ `revenue_type` / `expense_type` → ✅ `category`
- ❌ `amount` → ✅ `base_amount` (student_payments)
- ❌ `attendance_date` → ✅ `class_schedule_id` + JOIN (attendance)
- ❌ `status` → ✅ `attendance_status` (attendance)
- ❌ `weekly_schedule` → ✅ `class_days` (students)
- ❌ `description` → ✅ 없음 (season_settings)

### 3. 삭제된 필드
- `season_settings.description` - 존재하지 않음
- `expenses.student_id` - 존재하지 않음 (description에 포함)

### 4. JSON 필드
- `students.class_days`: `[1,3,5]` 형식의 배열
- `student_performance.performance_data`: 타입별로 다른 구조
- `salary_records.insurance_details`: 4대보험 상세 정보

---

**문서 버전**: 1.0.0
**작성일**: 2025-11-24
**기준**: 실제 운영 DB 스키마
