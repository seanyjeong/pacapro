/**
 * 2026-01 학원비 due_date 마이그레이션 스크립트
 *
 * 납부일 이후 첫 출석일로 due_date 수정
 */

const db = require('../config/database');
const { calculateDueDate } = require('../utils/dueDateCalculator');

async function fixJanuary2026DueDates() {
    console.log('[Migration] Starting fix for 2026-01 due_dates...');

    try {
        // 1. 2026-01 학원비 조회
        const [payments] = await db.query(`
            SELECT
                p.id,
                p.student_id,
                p.due_date,
                s.class_days,
                s.name as student_name,
                COALESCE(s.payment_due_day, ast.tuition_due_day, 5) as due_day
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            LEFT JOIN academy_settings ast ON s.academy_id = ast.academy_id
            WHERE p.year_month = '2026-01'
        `);

        console.log(`[Migration] Found ${payments.length} payments for 2026-01`);

        let updatedCount = 0;

        for (const payment of payments) {
            // class_days 파싱 (JSON 배열 또는 쉼표 구분 문자열 지원)
            let classDays = [];
            if (payment.class_days) {
                if (Array.isArray(payment.class_days)) {
                    classDays = payment.class_days;
                } else if (typeof payment.class_days === 'string') {
                    try {
                        classDays = JSON.parse(payment.class_days);
                    } catch (e) {
                        // JSON 파싱 실패 시 쉼표 구분 문자열로 시도
                        classDays = payment.class_days.split(',').map(d => parseInt(d.trim(), 10)).filter(d => !isNaN(d));
                    }
                }
            }

            // 새 due_date 계산
            const newDueDate = calculateDueDate(2026, 1, payment.due_day, classDays);

            // 변경이 필요한 경우만 업데이트
            const currentDueDate = payment.due_date ?
                new Date(payment.due_date).toISOString().split('T')[0] : null;

            if (currentDueDate !== newDueDate) {
                await db.query(
                    'UPDATE student_payments SET due_date = ? WHERE id = ?',
                    [newDueDate, payment.id]
                );
                console.log(`[Migration] Updated payment ${payment.id} (${payment.student_name}): ${currentDueDate} -> ${newDueDate}`);
                updatedCount++;
            }
        }

        console.log(`[Migration] Completed. Updated ${updatedCount} of ${payments.length} payments.`);
        return { total: payments.length, updated: updatedCount };

    } catch (error) {
        console.error('[Migration] Error:', error);
        throw error;
    }
}

// 직접 실행 시
if (require.main === module) {
    fixJanuary2026DueDates()
        .then(result => {
            console.log('[Migration] Result:', result);
            process.exit(0);
        })
        .catch(err => {
            console.error('[Migration] Failed:', err);
            process.exit(1);
        });
}

module.exports = { fixJanuary2026DueDates };
