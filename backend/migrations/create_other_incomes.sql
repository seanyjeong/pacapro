-- 기타수입 테이블 생성
-- 실행: mysql -u root -p paca < create_other_incomes.sql

CREATE TABLE IF NOT EXISTS other_incomes (
    id INT PRIMARY KEY AUTO_INCREMENT,
    academy_id INT NOT NULL,
    income_date DATE NOT NULL,
    category ENUM('clothing', 'shoes', 'equipment', 'beverage', 'snack', 'other') NOT NULL DEFAULT 'other',
    amount DECIMAL(10,2) NOT NULL,
    description VARCHAR(255),
    student_id INT NULL,
    payment_method ENUM('cash', 'card', 'transfer') DEFAULT 'cash',
    notes TEXT,
    recorded_by INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (academy_id) REFERENCES academies(id) ON DELETE CASCADE,
    FOREIGN KEY (student_id) REFERENCES students(id) ON DELETE SET NULL,
    FOREIGN KEY (recorded_by) REFERENCES users(id) ON DELETE SET NULL,
    INDEX idx_academy_date (academy_id, income_date),
    INDEX idx_category (category)
);
