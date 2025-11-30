-- 온보딩 관련 필드 추가
-- 실행: mysql -u root -p paca < add_onboarding_fields.sql

-- academy_settings 테이블에 온보딩 완료 필드 추가
ALTER TABLE academy_settings
ADD COLUMN onboarding_completed BOOLEAN DEFAULT FALSE,
ADD COLUMN onboarding_completed_at TIMESTAMP NULL;

-- users 테이블에 튜토리얼 완료 상태 필드 추가
ALTER TABLE users
ADD COLUMN tutorial_completed JSON DEFAULT NULL;
-- 예시: {"dashboard": true, "students": true, "schedules": false}
