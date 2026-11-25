const { getKoreaDateText } = require('../utils/proratedPaymentDueDate');

const INSTRUCTOR_COLUMNS = `i.academy_id, i.salary_type, i.hourly_rate, i.base_salary, i.tax_type AS instructor_tax_type,
    i.morning_class_rate, i.afternoon_class_rate, i.evening_class_rate`;

async function lockSalary(conn, salaryId, academyId) {
    const [rows] = await conn.execute(
        `SELECT s.*, ${INSTRUCTOR_COLUMNS}
         FROM salary_records s JOIN instructors i ON s.instructor_id = i.id
         WHERE s.id = ? AND i.academy_id = ? FOR UPDATE OF s`,
        [salaryId, academyId]
    );
    return rows[0] || null;
}

async function lockSalaryByMonth(conn, instructorId, yearMonth) {
    const [rows] = await conn.execute(
        `SELECT s.*, ${INSTRUCTOR_COLUMNS}
         FROM salary_records s JOIN instructors i ON s.instructor_id = i.id
         WHERE s.instructor_id = ? AND s.\`year_month\` = ? FOR UPDATE OF s`,
        [instructorId, yearMonth]
    );
    return rows[0] || null;
}

async function monthAttendances(conn, instructorId, yearMonth) {
    const [rows] = await conn.execute(
        `SELECT work_date, time_slot, check_in_time, check_out_time, attendance_status
         FROM instructor_attendance
         WHERE instructor_id = ? AND DATE_FORMAT(work_date, '%Y-%m') = ? AND attendance_status IN ('present', 'late')
         ORDER BY work_date, time_slot`,
        [instructorId, yearMonth]
    );
    return rows;
}

// 시작하는 날이 없는 규칙은 만든 달부터 적용한다(옛 미지급 급여를 바꾸지 않는다)
async function monthRules(conn, instructorId, yearMonth) {
    const [rows] = await conn.execute(
        `SELECT r.*, se.season_name FROM instructor_pay_rules r LEFT JOIN seasons se ON se.id = r.season_id
         WHERE r.instructor_id = ? AND DATE_FORMAT(COALESCE(r.start_date, r.created_at), '%Y-%m') <= ?
           AND (r.end_date IS NULL OR DATE_FORMAT(r.end_date, '%Y-%m') >= ?)
           AND NOT (r.pay_type = 'fixed_total' AND r.start_date IS NULL AND r.end_date IS NULL)
         ORDER BY r.start_date, r.id`,
        [instructorId, yearMonth, yearMonth]
    );
    return rows;
}

async function monthInstallments(conn, instructorId, yearMonth) {
    const [rows] = await conn.execute(
        `SELECT p.amount, r.id AS rule_id, r.memo, r.taxable, se.season_name,
                (SELECT COUNT(*) FROM pay_rule_installments x WHERE x.pay_rule_id = r.id) AS count,
                (SELECT COUNT(*) FROM pay_rule_installments x WHERE x.pay_rule_id = r.id AND x.pay_year_month <= p.pay_year_month) AS sequence
         FROM pay_rule_installments p
         JOIN instructor_pay_rules r ON r.id = p.pay_rule_id
         LEFT JOIN seasons se ON se.id = r.season_id
         WHERE r.instructor_id = ? AND r.pay_type = 'fixed_total' AND p.pay_year_month = ?
         ORDER BY r.start_date, r.id`,
        [instructorId, yearMonth]
    );
    return rows;
}

async function listAdjustments(conn, salaryId) {
    const [rows] = await conn.execute(
        `SELECT id, salary_record_id, label, amount, taxable, memo, created_by, created_at
         FROM salary_adjustments WHERE salary_record_id = ? ORDER BY id`,
        [salaryId]
    );
    return rows;
}

async function createEmptySalary(conn, instructorId, yearMonth, taxType) {
    await conn.execute(
        `INSERT IGNORE INTO salary_records (instructor_id, \`year_month\`, base_amount, incentive_amount, total_deduction,
            tax_type, tax_amount, net_salary, payment_status) VALUES (?, ?, 0, 0, 0, ?, 0, 0, 'pending')`,
        [instructorId, yearMonth, taxType || 'none']
    );
}

// 분할 지급 달이 왔는데 급여 줄이 없는 강사(출근이 없던 달)
async function missingInstallmentSalaries(conn, throughMonth, instructorId = null) {
    const [rows] = await conn.execute(
        `SELECT DISTINCT r.instructor_id, i.academy_id, i.tax_type, p.pay_year_month
         FROM pay_rule_installments p
         JOIN instructor_pay_rules r ON r.id = p.pay_rule_id AND r.pay_type = 'fixed_total'
         JOIN instructors i ON i.id = r.instructor_id AND i.deleted_at IS NULL
         LEFT JOIN salary_records s ON s.instructor_id = r.instructor_id AND s.\`year_month\` = p.pay_year_month
         WHERE s.id IS NULL AND p.pay_year_month <= ? ${instructorId ? 'AND r.instructor_id = ?' : ''}`,
        instructorId ? [throughMonth, instructorId] : [throughMonth]
    );
    return rows;
}

const currentMonth = () => getKoreaDateText().slice(0, 7);

module.exports = { lockSalary, lockSalaryByMonth, monthAttendances, monthRules, monthInstallments, listAdjustments,
    createEmptySalary, missingInstallmentSalaries, currentMonth };
