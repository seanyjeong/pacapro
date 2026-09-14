async function createParentNamesFixture(pool) {
    await pool.query(`CREATE TABLE students (
        id INT AUTO_INCREMENT PRIMARY KEY, academy_id INT, student_number VARCHAR(20),
        name VARCHAR(512), phone VARCHAR(512), parent_phone VARCHAR(512), address VARCHAR(512),
        gender VARCHAR(20), student_type VARCHAR(20), school VARCHAR(100), grade VARCHAR(20), age INT,
        admission_type VARCHAR(30), class_days JSON, weekly_count INT DEFAULT 0, monthly_tuition DECIMAL(10,2) DEFAULT 0,
        discount_rate DECIMAL(5,2) DEFAULT 0, discount_reason TEXT, payment_due_day INT,
        enrollment_date DATE, status VARCHAR(20), notes TEXT, memo TEXT, time_slot VARCHAR(20),
        rest_start_date DATE, rest_end_date DATE, rest_reason TEXT, is_trial INT DEFAULT 0,
        trial_remaining INT, trial_dates JSON, is_season_registered INT DEFAULT 0, current_season_id INT,
        class_days_next JSON, class_days_effective_from DATE, deleted_at DATETIME,
        profile_image_url TEXT, profile_image_key TEXT, profile_thumb_key TEXT, profile_image_updated_at DATETIME,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP, updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP)`);
    await pool.query(`CREATE TABLE academies (id INT PRIMARY KEY, name VARCHAR(100))`);
    await pool.query(`INSERT INTO academies VALUES (1,'검증 학원'),(2,'다른 학원')`);
    await pool.query(`CREATE TABLE student_performance (id INT, student_id INT, record_date DATE,
        record_type VARCHAR(20), performance_data JSON, notes TEXT, created_at DATETIME)`);
    await pool.query(`CREATE TABLE student_payments (
        id INT PRIMARY KEY, academy_id INT, student_id INT, \`year_month\` VARCHAR(7), payment_type VARCHAR(20),
        base_amount DECIMAL(10,2), discount_amount DECIMAL(10,2), additional_amount DECIMAL(10,2),
        final_amount DECIMAL(10,2), paid_amount DECIMAL(10,2), paid_date DATE, due_date DATE,
        payment_status VARCHAR(20), payment_method VARCHAR(20), description TEXT, notes TEXT,
        created_at DATETIME, updated_at DATETIME)`);
    await pool.query(`CREATE TABLE rest_credits (student_id INT, academy_id INT, status VARCHAR(20), remaining_amount DECIMAL(10,2))`);
    await pool.query(`INSERT INTO students (id,academy_id,student_number,name,phone,class_days,status,monthly_tuition)
        VALUES (99,1,'2026099','기존학생','010-1111-9999','[]','active',350000)`);
}

module.exports = { createParentNamesFixture };
