-- 직원 권한 시스템을 위한 마이그레이션
-- 실행: mysql -u root -p paca < add_staff_permissions.sql

-- 0. role 컬럼에 'staff' 추가 (ENUM인 경우)
ALTER TABLE users MODIFY COLUMN role ENUM('owner', 'admin', 'teacher', 'staff') DEFAULT 'owner';

-- 1. users 테이블에 직급과 권한 컬럼 추가
ALTER TABLE users
ADD COLUMN position VARCHAR(50) DEFAULT NULL COMMENT '직급 (부원장, 경리, 실장 등)',
ADD COLUMN permissions JSON DEFAULT NULL COMMENT '페이지별 권한 {page: {view: bool, edit: bool}}',
ADD COLUMN created_by INT DEFAULT NULL COMMENT '생성자 ID (원장)',
ADD COLUMN instructor_id INT DEFAULT NULL COMMENT '연결된 강사 ID';

-- 2. created_by 외래키 설정
ALTER TABLE users
ADD CONSTRAINT fk_users_created_by
FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL;

-- 3. instructor_id 외래키 설정
ALTER TABLE users
ADD CONSTRAINT fk_users_instructor_id
FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE SET NULL;

-- 4. 기본 권한 구조 예시 (참고용 - 실제 저장 시 JSON으로 저장됨)
-- {
--   "students": { "view": true, "edit": true },
--   "instructors": { "view": true, "edit": false },
--   "payments": { "view": true, "edit": true },
--   "salaries": { "view": false, "edit": false },
--   "schedules": { "view": true, "edit": true },
--   "reports": { "view": true, "edit": false },
--   "expenses": { "view": true, "edit": true },
--   "incomes": { "view": true, "edit": true },
--   "seasons": { "view": true, "edit": false },
--   "settings": { "view": false, "edit": false },
--   "staff": { "view": false, "edit": false }
-- }
