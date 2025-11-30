-- 강사 근무 일정 테이블
-- 각 날짜/타임슬롯별로 어떤 강사가 근무 예정인지 저장
-- 시급제 강사는 예정 시작/종료 시간 입력 가능

CREATE TABLE IF NOT EXISTS instructor_schedules (
    id INT AUTO_INCREMENT PRIMARY KEY,
    academy_id INT NOT NULL,
    instructor_id INT NOT NULL,
    work_date DATE NOT NULL,
    time_slot ENUM('morning', 'afternoon', 'evening') NOT NULL,

    -- 시급제 강사용: 예정 근무 시간
    scheduled_start_time TIME DEFAULT NULL,
    scheduled_end_time TIME DEFAULT NULL,

    created_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,

    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
    FOREIGN KEY (instructor_id) REFERENCES instructors(id) ON DELETE CASCADE,
    FOREIGN KEY (created_by) REFERENCES users(id) ON DELETE SET NULL,

    -- 같은 날짜/타임슬롯에 같은 강사 중복 방지
    UNIQUE KEY unique_schedule (academy_id, instructor_id, work_date, time_slot),

    -- 조회 성능을 위한 인덱스
    INDEX idx_date_academy (academy_id, work_date),
    INDEX idx_instructor_date (instructor_id, work_date)
);
