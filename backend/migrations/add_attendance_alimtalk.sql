-- 출결관리 알림톡 — notification_settings 컬럼 추가
-- 실행 (n100): sudo mysql paca < add_attendance_alimtalk.sql
--
-- ⚠️ LIVE 적용은 카카오 템플릿 승인 후 배포 시점에. 그 전까지 적용 보류.
-- 사전 백업 필수:
--   sudo mysqldump paca notification_settings > /home/sean/backup/notif_settings_pre_attendance_$(date +%F).sql
--
-- 무손실: 전 컬럼 nullable / default 0 → 기존 행 영향 없음. 이미 있는 컬럼 에러는 무시.

-- Solapi 출결관리
ALTER TABLE notification_settings ADD COLUMN solapi_attendance_template_id VARCHAR(100) DEFAULT NULL;
ALTER TABLE notification_settings ADD COLUMN solapi_attendance_template_content TEXT DEFAULT NULL;
ALTER TABLE notification_settings ADD COLUMN solapi_attendance_buttons TEXT DEFAULT NULL;
ALTER TABLE notification_settings ADD COLUMN solapi_attendance_image_url VARCHAR(500) DEFAULT NULL;

-- SENS 출결관리
ALTER TABLE notification_settings ADD COLUMN sens_attendance_template_code VARCHAR(50) DEFAULT NULL;
ALTER TABLE notification_settings ADD COLUMN sens_attendance_template_content TEXT DEFAULT NULL;
ALTER TABLE notification_settings ADD COLUMN sens_attendance_buttons TEXT DEFAULT NULL;
ALTER TABLE notification_settings ADD COLUMN sens_attendance_image_url VARCHAR(500) DEFAULT NULL;

-- 출결 알림톡 발송 ON/OFF (기본 OFF — 카카오 승인 후 설정화면에서 ON)
ALTER TABLE notification_settings ADD COLUMN attendance_alimtalk_enabled TINYINT(1) DEFAULT 0;

-- 롤백:
-- ALTER TABLE notification_settings
--   DROP COLUMN solapi_attendance_template_id, DROP COLUMN solapi_attendance_template_content,
--   DROP COLUMN solapi_attendance_buttons, DROP COLUMN solapi_attendance_image_url,
--   DROP COLUMN sens_attendance_template_code, DROP COLUMN sens_attendance_template_content,
--   DROP COLUMN sens_attendance_buttons, DROP COLUMN sens_attendance_image_url,
--   DROP COLUMN attendance_alimtalk_enabled;
