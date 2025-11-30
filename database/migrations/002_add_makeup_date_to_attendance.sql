-- Migration: 002_add_makeup_date_to_attendance
-- Description: attendance 테이블에 보충 날짜 컬럼 추가
-- Date: 2025-11-26

-- attendance 테이블에 makeup_date 컬럼 추가
-- 학생이 '보충' 상태로 출석 체크될 때 보충으로 출석할 날짜를 저장
ALTER TABLE `attendance`
ADD COLUMN `makeup_date` date DEFAULT NULL COMMENT '보충 출석 날짜 (보충 상태일 때만 사용)' AFTER `attendance_status`;

-- 인덱스 추가 (보충 날짜로 검색할 때 사용)
ALTER TABLE `attendance`
ADD KEY `idx_makeup_date` (`makeup_date`);
