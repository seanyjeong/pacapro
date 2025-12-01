-- 휴식 기간 관리 기능 추가
-- 실행일: 2024-12-01

-- 1. students 테이블에 휴식 관련 필드 추가
ALTER TABLE students
ADD COLUMN rest_start_date DATE NULL COMMENT '휴식 시작일' AFTER status,
ADD COLUMN rest_end_date DATE NULL COMMENT '휴식 종료일 (NULL이면 무기한)' AFTER rest_start_date,
ADD COLUMN rest_reason VARCHAR(255) NULL COMMENT '휴식 사유' AFTER rest_end_date;

-- 2. student_payments 테이블에 이월/환불 관련 필드 추가
ALTER TABLE student_payments
ADD COLUMN carryover_amount INT DEFAULT 0 COMMENT '이월 차감 금액' AFTER additional_amount,
ADD COLUMN refund_amount INT DEFAULT 0 COMMENT '환불 처리 금액' AFTER carryover_amount,
ADD COLUMN rest_credit_id INT NULL COMMENT '휴식 크레딧 참조 ID' AFTER refund_amount;

-- 3. rest_credits 테이블 생성 (휴식으로 인한 이월/환불 기록)
CREATE TABLE IF NOT EXISTS rest_credits (
    id INT PRIMARY KEY AUTO_INCREMENT,
    student_id INT NOT NULL,
    academy_id INT NOT NULL,
    source_payment_id INT NULL COMMENT '원본 학원비 ID (이미 납부한 경우)',
    rest_start_date DATE NOT NULL COMMENT '휴식 시작일',
    rest_end_date DATE NOT NULL COMMENT '휴식 종료일',
    rest_days INT NOT NULL COMMENT '휴식 일수',
    credit_amount INT NOT NULL COMMENT '이월/환불 가능 금액',
    remaining_amount INT NOT NULL COMMENT '남은 금액 (부분 적용 가능)',
    credit_type ENUM('carryover', 'refund') NOT NULL COMMENT '처리 유형',
    status ENUM('pending', 'partial', 'applied', 'refunded', 'cancelled') DEFAULT 'pending' COMMENT '상태',
    applied_to_payment_id INT NULL COMMENT '적용된 학원비 ID',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    processed_at TIMESTAMP NULL COMMENT '처리 완료일',
    notes TEXT NULL COMMENT '메모',
    INDEX idx_student_id (student_id),
    INDEX idx_academy_id (academy_id),
    INDEX idx_status (status),
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE CASCADE,
    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='휴식 크레딧 (이월/환불) 기록';

-- 4. final_amount 계산 시 carryover_amount 고려하도록 기존 데이터 업데이트
-- (기존 데이터는 carryover_amount가 0이므로 영향 없음)
