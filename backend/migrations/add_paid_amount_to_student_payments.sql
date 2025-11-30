-- student_payments 테이블에 paid_amount 컬럼 추가 (부분 납부 지원)
-- 실행: mysql -u root -p paca < add_paid_amount_to_student_payments.sql

ALTER TABLE student_payments
ADD COLUMN paid_amount DECIMAL(12,2) DEFAULT 0 AFTER final_amount;

-- 이미 paid 상태인 레코드들은 final_amount로 paid_amount 설정
UPDATE student_payments
SET paid_amount = final_amount
WHERE payment_status = 'paid';
