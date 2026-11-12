/**
 * 비시즌 종강 일할 청구 — 시즌이 그 달 중간에 시작해 그 달 월회비가 시즌으로 빠질 때,
 * 그 달 1일~비시즌 종강일 정규 수업료를 그 달 월회비 청구로 따로 만든다 (2026-11-01 주인님 결정).
 * 금액은 시즌 등록 때 계산해 둔 student_seasons.prorated_amount(prorated_month = 그 달)를 그대로 쓴다.
 * 매월 1일 자동 청구·화면 일괄 청구·AI 연결(monthly_payment_create)이 같은 규칙을 쓴다. 이미 그 달 월회비 청구가 있으면 만들지 않는다.
 */
const { calculateDueDate } = require('../utils/dueDateCalculator');
const { seasonMonthlyExclusionSql, seasonMonthlyExclusionParams } = require('../repositories/seasonMonthlyExclusion');

function classDaysOf(value) {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    try { return JSON.parse(value); } catch { return String(value).split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d)); }
}

// 학생 한 명당 한 건 — 같은 달 시작 시즌이 둘이면 먼저 등록한 것
async function nonSeasonProratedCandidates(db, academyId, yearMonth, studentId = null) {
    const [rows] = await db.query(
        `SELECT ss.id AS enrollment_id, ss.student_id, ss.prorated_amount, ss.prorated_details,
            se.season_name, DATE_FORMAT(se.non_season_end_date, '%Y-%m-%d') AS non_season_end_date, s.class_days,
            COALESCE(s.payment_due_day, (SELECT ast.tuition_due_day FROM academy_settings ast WHERE ast.academy_id = s.academy_id ORDER BY ast.id LIMIT 1), 5) AS due_day
        FROM student_seasons ss
        JOIN seasons se ON se.id = ss.season_id
        JOIN students s ON s.id = ss.student_id AND s.academy_id = se.academy_id
        WHERE se.academy_id = ? AND ss.prorated_month = ? AND ss.prorated_amount > 0
          AND COALESCE(ss.is_cancelled, 0) = 0 AND ss.payment_status != 'cancelled'
          AND DATE_FORMAT(se.season_start_date, '%Y-%m') = ?
          AND s.status = 'active' AND s.deleted_at IS NULL${studentId ? ' AND s.id = ?' : ''}
          AND NOT ${seasonMonthlyExclusionSql('s')}
          AND NOT EXISTS (SELECT 1 FROM student_payments p WHERE p.student_id = s.id AND p.\`year_month\` = ? AND p.payment_type = 'monthly')
        ORDER BY ss.id`,
        [academyId, yearMonth, yearMonth, ...(studentId ? [studentId] : []), ...seasonMonthlyExclusionParams(yearMonth), yearMonth]
    );
    return rows.filter((row, index) => rows.findIndex(other => other.student_id === row.student_id) === index);
}

function planNonSeasonProrated(candidate, yearMonth) {
    const [year, month] = yearMonth.split('-').map(Number);
    let details = candidate.prorated_details;
    if (typeof details === 'string') { try { details = JSON.parse(details); } catch { details = null; } }
    const formula = details?.calculationDetails?.formula;
    return {
        yearMonth,
        amount: Number(candidate.prorated_amount),
        dueDate: calculateDueDate(year, month, candidate.due_day, classDaysOf(candidate.class_days)),
        description: `${month}월 학원비 (비시즌 종강 일할)`,
        notes: `[비시즌 종강 일할] ${candidate.season_name} 비시즌 종강 ${candidate.non_season_end_date}까지${formula ? `\n${formula}` : ''}`
    };
}

async function insertNonSeasonProrated(db, academyId, candidate, plan, recordedBy = null) {
    const [result] = await db.query(
        `INSERT INTO student_payments (
            student_id, academy_id, \`year_month\`, payment_type,
            base_amount, discount_amount, additional_amount, carryover_amount, final_amount,
            due_date, payment_status, description, notes, recorded_by
        ) VALUES (?, ?, ?, 'monthly', ?, 0, 0, 0, ?, ?, 'pending', ?, ?, ?)`,
        [candidate.student_id, academyId, plan.yearMonth, plan.amount, plan.amount, plan.dueDate, plan.description, plan.notes, recordedBy]
    );
    return result.insertId;
}

module.exports = { nonSeasonProratedCandidates, planNonSeasonProrated, insertNonSeasonProrated };
