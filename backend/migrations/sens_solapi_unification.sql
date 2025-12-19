-- SENS 알림톡 솔라피 통일 마이그레이션
-- 실행일: 2025-12-19
-- 목적: SENS를 솔라피와 동일한 4개 템플릿 + 수업일 기반 자동발송 구조로 변경

-- =====================================================
-- 1. 새 컬럼 추가 (솔라피와 동일한 구조)
-- =====================================================

-- SENS 납부안내 버튼/이미지 (기존 template_code, template_content 재사용)
ALTER TABLE notification_settings ADD COLUMN sens_buttons TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_image_url VARCHAR(500);

-- SENS 수업일 기반 자동발송 (기존 날짜 기반 대체)
ALTER TABLE notification_settings ADD COLUMN sens_auto_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE notification_settings ADD COLUMN sens_auto_hour TINYINT DEFAULT 10;

-- SENS 상담확정 (신규)
ALTER TABLE notification_settings ADD COLUMN sens_consultation_template_code VARCHAR(50);
ALTER TABLE notification_settings ADD COLUMN sens_consultation_template_content TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_consultation_buttons TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_consultation_image_url VARCHAR(500);

-- SENS 체험수업 (신규)
ALTER TABLE notification_settings ADD COLUMN sens_trial_template_code VARCHAR(50);
ALTER TABLE notification_settings ADD COLUMN sens_trial_template_content TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_trial_buttons TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_trial_image_url VARCHAR(500);
ALTER TABLE notification_settings ADD COLUMN sens_trial_auto_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE notification_settings ADD COLUMN sens_trial_auto_hour TINYINT DEFAULT 9;

-- SENS 미납자 (신규)
ALTER TABLE notification_settings ADD COLUMN sens_overdue_template_code VARCHAR(50);
ALTER TABLE notification_settings ADD COLUMN sens_overdue_template_content TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_overdue_buttons TEXT;
ALTER TABLE notification_settings ADD COLUMN sens_overdue_image_url VARCHAR(500);
ALTER TABLE notification_settings ADD COLUMN sens_overdue_auto_enabled TINYINT(1) DEFAULT 0;
ALTER TABLE notification_settings ADD COLUMN sens_overdue_auto_hour TINYINT DEFAULT 9;

-- =====================================================
-- 2. 기존 데이터 마이그레이션
-- =====================================================

-- is_enabled가 TRUE인 학원의 설정을 새 컬럼으로 이관
UPDATE notification_settings
SET sens_auto_enabled = is_enabled,
    sens_auto_hour = COALESCE(auto_send_hour, 10)
WHERE is_enabled = 1;

-- =====================================================
-- 3. 불필요한 컬럼 제거 (날짜 기반 발송 관련)
-- =====================================================

ALTER TABLE notification_settings DROP COLUMN auto_send_day;
ALTER TABLE notification_settings DROP COLUMN auto_send_days;
ALTER TABLE notification_settings DROP COLUMN auto_send_hour;
