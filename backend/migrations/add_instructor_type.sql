-- 강사 유형 및 사무보조 근무설정 추가
-- 실행: mysql -u root -p8320 paca < migrations/add_instructor_type.sql

-- 1. instructors 테이블에 컬럼 추가
ALTER TABLE instructors
ADD COLUMN instructor_type ENUM('teacher', 'assistant') DEFAULT 'teacher' AFTER salary_type,
ADD COLUMN work_days JSON DEFAULT NULL COMMENT '사무보조 출근 요일 [1,3,5] (0=일~6=토)' AFTER instructor_type,
ADD COLUMN work_start_time TIME DEFAULT NULL COMMENT '사무보조 출근 시간' AFTER work_days,
ADD COLUMN work_end_time TIME DEFAULT NULL COMMENT '사무보조 퇴근 시간' AFTER work_start_time;

-- 2. 초과근무 승인 테이블
CREATE TABLE IF NOT EXISTS overtime_approvals (
    id INT AUTO_INCREMENT PRIMARY KEY,
    academy_id INT NOT NULL,
    instructor_id INT NOT NULL,
    work_date DATE NOT NULL,
    time_slot ENUM('morning', 'afternoon', 'evening') DEFAULT NULL,
    request_type ENUM('overtime', 'extra_day') NOT NULL COMMENT 'overtime: 시간초과, extra_day: 비근무일 출근',
    original_end_time TIME DEFAULT NULL COMMENT '원래 퇴근시간 (시간대 또는 설정)',
    actual_end_time TIME DEFAULT NULL COMMENT '실제 퇴근시간',
    overtime_minutes INT DEFAULT 0 COMMENT '초과 근무 분',
    status ENUM('pending', 'approved', 'rejected') DEFAULT 'pending',
    approved_by INT DEFAULT NULL COMMENT '승인자 user_id',
    approved_at TIMESTAMP DEFAULT NULL,
    notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    FOREIGN KEY (approved_by) REFERENCES users(id) ON DELETE SET NULL,

    UNIQUE KEY unique_approval (instructor_id, work_date, time_slot)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 3. 인덱스 추가
CREATE INDEX idx_overtime_status ON overtime_approvals(academy_id, status);
CREATE INDEX idx_overtime_date ON overtime_approvals(work_date);
