-- Additive audit only. Existing invoices, receipts and revenues are retained.
CREATE TABLE max_engine_payment_settlements (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  academy_id INT NOT NULL,
  student_id INT NOT NULL,
  payment_id INT NOT NULL,
  action ENUM('cancel','adjust','refund') NOT NULL,
  settlement_date DATE NOT NULL,
  before_final_amount DECIMAL(12,2) NOT NULL,
  before_paid_amount DECIMAL(12,2) NOT NULL,
  after_final_amount DECIMAL(12,2) NOT NULL,
  after_paid_amount DECIMAL(12,2) NOT NULL,
  waived_amount DECIMAL(12,2) NOT NULL,
  refund_amount DECIMAL(12,2) NOT NULL,
  expense_id INT NULL,
  reason VARCHAR(255) NOT NULL,
  recorded_by INT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_settlement_student (academy_id, student_id, id),
  INDEX idx_settlement_payment (academy_id, payment_id, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
