-- Migration: 001_create_classes_table
-- Description: 반(수업) 정의 테이블 생성
-- Date: 2025-11-26

-- 1. classes 테이블 생성 (반/수업 정의)
CREATE TABLE IF NOT EXISTS `classes` (
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
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='반/수업 정의';

-- 2. class_schedules 테이블에 class_id 컬럼 추가
ALTER TABLE `class_schedules`
ADD COLUMN `class_id` int DEFAULT NULL COMMENT '반 ID' AFTER `academy_id`,
ADD KEY `idx_class_id` (`class_id`),
ADD CONSTRAINT `fk_class_schedules_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE SET NULL;

-- 3. instructor_attendance 테이블에 class_schedule_id 컬럼 추가
ALTER TABLE `instructor_attendance`
ADD COLUMN `class_schedule_id` int DEFAULT NULL COMMENT '수업 일정 ID' AFTER `instructor_id`,
ADD KEY `idx_class_schedule_id` (`class_schedule_id`),
ADD CONSTRAINT `fk_instructor_attendance_schedule` FOREIGN KEY (`class_schedule_id`) REFERENCES `class_schedules` (`id`) ON DELETE SET NULL;

-- 4. instructor_attendance의 unique key 수정 (work_date -> attendance_date 확인 필요)
-- 기존 스키마에 attendance_date가 있다면 work_date로 변경
-- ALTER TABLE `instructor_attendance` DROP INDEX `uk_instructor_date_slot`;
-- ALTER TABLE `instructor_attendance` ADD UNIQUE KEY `uk_instructor_date_slot` (`instructor_id`, `work_date`, `time_slot`);
