-- Migration: 005_add_season_grade_to_schedules
-- Description: class_schedules에 season_id, target_grade 추가
-- Date: 2025-11-27

-- =====================================================
-- class_schedules 테이블 수정
-- =====================================================

-- season_id 컬럼 추가 (시즌 기반 스케줄용)
ALTER TABLE `class_schedules`
ADD COLUMN `season_id` INT DEFAULT NULL
COMMENT '시즌 ID (시즌 기반 스케줄)' AFTER `class_id`;

-- target_grade 컬럼 추가 (시즌 스케줄의 대상 학년)
ALTER TABLE `class_schedules`
ADD COLUMN `target_grade` VARCHAR(20) DEFAULT NULL
COMMENT '대상 학년 (고3, N수 등 - 시즌 스케줄용)' AFTER `season_id`;

-- 인덱스 추가
ALTER TABLE `class_schedules`
ADD KEY `idx_season_id` (`season_id`),
ADD KEY `idx_target_grade` (`target_grade`);

-- 외래 키 제약 추가
ALTER TABLE `class_schedules`
ADD CONSTRAINT `fk_schedules_season`
FOREIGN KEY (`season_id`) REFERENCES `seasons` (`id`) ON DELETE SET NULL;
