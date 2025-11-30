-- Migration: 004_add_grade_time_slots_to_seasons
-- Description: 시즌에 학년별 시간대 설정 추가
-- Date: 2025-11-27

-- =====================================================
-- seasons 테이블에 grade_time_slots 컬럼 추가
-- =====================================================

-- 학년별 시간대 설정
-- 예: {"고3": "evening", "N수": "morning"}
ALTER TABLE `seasons`
ADD COLUMN `grade_time_slots` JSON DEFAULT NULL
COMMENT '학년별 시간대 설정: {"고3":"evening","N수":"morning"}' AFTER `operating_days`;
