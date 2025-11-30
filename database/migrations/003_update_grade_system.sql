-- Migration: 003_update_grade_system
-- Description: 학년 시스템 개편 - grade_type 제거, grade 값 변경, 성인반 지원
-- Date: 2025-11-26

-- =====================================================
-- 1. classes 테이블 수정
-- =====================================================

-- grade_type 컬럼 제거 (중등/고등 구분 불필요)
ALTER TABLE `classes` DROP COLUMN `grade_type`;

-- grade 컬럼을 VARCHAR로 변경하여 다양한 값 지원
-- 기존: int (1, 2, 3)
-- 변경: varchar ('고1', '고2', '고3', 'N수', '성인')
ALTER TABLE `classes` MODIFY COLUMN `grade` VARCHAR(20) DEFAULT NULL COMMENT '학년 (고1, 고2, 고3, N수, 성인)';

-- class_type 컬럼 추가 (입시반/성인반 구분)
ALTER TABLE `classes`
ADD COLUMN `class_type` ENUM('exam', 'adult') DEFAULT 'exam' COMMENT '반 유형 (exam: 입시반, adult: 성인반)' AFTER `class_name`;

-- =====================================================
-- 2. students 테이블 수정
-- =====================================================

-- grade_type 컬럼 제거
ALTER TABLE `students` DROP COLUMN `grade_type`;

-- grade 컬럼을 VARCHAR로 변경
ALTER TABLE `students` MODIFY COLUMN `grade` VARCHAR(20) DEFAULT NULL COMMENT '학년 (고1, 고2, 고3, N수) - 입시 학생용';

-- student_type 컬럼 추가 (입시생/성인 구분)
ALTER TABLE `students`
ADD COLUMN `student_type` ENUM('exam', 'adult') DEFAULT 'exam' COMMENT '학생 유형 (exam: 입시생, adult: 성인)' AFTER `name`;

-- age 컬럼 추가 (성인 학생용)
ALTER TABLE `students`
ADD COLUMN `age` INT DEFAULT NULL COMMENT '나이 (성인 학생용)' AFTER `grade`;

-- admission_type 수정하여 공무원 추가
ALTER TABLE `students` MODIFY COLUMN `admission_type` ENUM('regular', 'early', 'civil_service') DEFAULT 'regular' COMMENT '입시유형 (regular: 정시, early: 수시, civil_service: 공무원)';

-- =====================================================
-- 3. 기존 데이터 마이그레이션
-- =====================================================

-- classes: 기존 grade 값 변환 (1->고1, 2->고2, 3->고3)
UPDATE `classes` SET `grade` = CONCAT('고', `grade`) WHERE `grade` IS NOT NULL AND `grade` REGEXP '^[1-3]$';

-- students: 기존 grade 값 변환
UPDATE `students` SET `grade` = CONCAT('고', `grade`) WHERE `grade` IS NOT NULL AND `grade` REGEXP '^[1-3]$';

-- 기존 데이터는 모두 exam 타입으로 설정 (이미 기본값이므로 별도 작업 불필요)
