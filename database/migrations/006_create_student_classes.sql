-- Migration: 006_create_student_classes
-- Description: 학생-반 배정 테이블 생성 (공무원/성인용)
-- Date: 2025-11-27

-- =====================================================
-- student_classes 테이블 생성
-- =====================================================

CREATE TABLE IF NOT EXISTS `student_classes` (
    `id` INT NOT NULL AUTO_INCREMENT,
    `academy_id` INT NOT NULL COMMENT '학원 ID',
    `student_id` INT NOT NULL COMMENT '학생 ID',
    `class_id` INT NOT NULL COMMENT '반 ID',
    `assigned_date` DATE NOT NULL COMMENT '배정일',
    `status` ENUM('active', 'inactive') DEFAULT 'active' COMMENT '상태',
    `notes` TEXT DEFAULT NULL COMMENT '비고',
    `created_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    `updated_at` TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (`id`),
    UNIQUE KEY `uk_student_class` (`student_id`, `class_id`),
    KEY `idx_academy_id` (`academy_id`),
    KEY `idx_student_id` (`student_id`),
    KEY `idx_class_id` (`class_id`),
    KEY `idx_status` (`status`),
    CONSTRAINT `fk_sc_academy` FOREIGN KEY (`academy_id`) REFERENCES `academies` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sc_student` FOREIGN KEY (`student_id`) REFERENCES `students` (`id`) ON DELETE CASCADE,
    CONSTRAINT `fk_sc_class` FOREIGN KEY (`class_id`) REFERENCES `classes` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='학생-반 배정 (공무원/성인용)';
