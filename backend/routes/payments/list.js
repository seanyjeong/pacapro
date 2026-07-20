/**
 * paca/payments/list.js — 결제 목록/미납 조회 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./list')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (3건 — 모두 정적 경로):
 *   - GET /              — 전체 결제 목록 (필터: student_id/payment_status/payment_type/year/month/include_previous_unpaid/paid_year/paid_month)
 *   - GET /unpaid        — 미납/연체 결제 목록 (학원 전체)
 *   - GET /unpaid-today  — 오늘 출석 예정 학생 중 미납자 (PACA 자동화 계정 호환 — verifyToken 만)
 *
 * 인증:
 *   - GET / + GET /unpaid: verifyToken + checkPermission('payments', 'view')
 *   - GET /unpaid-today: verifyToken 만 (PACA 자동화 계정 호환)
 *
 * 응답 표면 보존 (ADR-013):
 *   GET /             → { message, payments }
 *   GET /unpaid       → { message, payments }
 *   GET /unpaid-today → { message, date, day_of_week, day_name, count, payments }
 *   5xx               → { error:'Server Error', message:'...' }
 *
 * DB 호출 (ADR-005): pool.execute (3건). db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 * ADR-007: decrypt 시그니처 무변경 (decryptPaymentArray 헬퍼 — 학생 이름 복호화).
 *
 * 분리 결정 (ADR-006): ~210줄 — 분리 불요.
 */

const { pool, decryptPaymentArray, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { remainingAmountSql, dueUnpaidSql } = require('../../utils/paymentAmountSql');

module.exports = function(router) {

/**
 * GET /paca/payments
 * Get all payment records with filters
 * Access: owner, admin, staff (with payments view permission)
 */
router.get('/', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const { student_id, payment_status, payment_type, year, month, paid_year, paid_month, include_previous_unpaid } = req.query;

        let query = `
            SELECT
                p.id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.grade,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.additional_amount,
                p.final_amount,
                COALESCE(p.paid_amount, 0) as paid_amount,
                ${remainingAmountSql('p')} as remaining_amount,
                p.paid_date,
                p.due_date,
                p.payment_status,
                p.payment_method,
                p.description,
                p.notes,
                p.created_at,
                COALESCE((
                    SELECT SUM(rc.remaining_amount)
                    FROM rest_credits rc
                    WHERE rc.student_id = p.student_id
                    AND rc.academy_id = p.academy_id
                    AND rc.status IN ('pending', 'partial')
                    AND rc.remaining_amount > 0
                ), 0) as credit_balance
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            AND s.academy_id = p.academy_id
            WHERE p.academy_id = ?
        `;

        const params = [req.user.academyId];

        if (student_id) {
            query += ' AND p.student_id = ?';
            params.push(parseInt(student_id));
        }

        if (payment_status) {
            query += ' AND p.payment_status = ?';
            params.push(payment_status);
        }

        if (payment_type) {
            query += ' AND p.payment_type = ?';
            params.push(payment_type);
        }

        if (year && month) {
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            if (include_previous_unpaid === 'true') {
                // 해당 월 + 이전 달 미납자 (paid가 아닌 것)
                query += ` AND (p.year_month = ? OR (p.year_month < ? AND p.payment_status != 'paid'))`;
                params.push(yearMonth, yearMonth);
            } else {
                query += ` AND p.year_month = ?`;
                params.push(yearMonth);
            }
        }

        // paid_year, paid_month: 실제 납부일 기준 필터 (리포트 매출용)
        if (paid_year && paid_month) {
            query += ` AND DATE_FORMAT(p.paid_date, '%Y-%m') = ?`;
            params.push(`${paid_year}-${String(paid_month).padStart(2, '0')}`);
        }

        // 미납/부분납 먼저, 완납은 맨 뒤로 정렬
        query += ' ORDER BY CASE WHEN p.payment_status = \'paid\' THEN 1 ELSE 0 END, p.due_date DESC';

        const [payments] = await pool.execute(query, params);

        res.json({
            message: `Found ${payments.length} payment records`,
            payments: decryptPaymentArray(payments)
        });
    } catch (error) {
        logger.error('Error fetching payments:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역을 불러오는데 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/unpaid
 * Get all unpaid/overdue payments
 * Access: owner, admin
 */
router.get('/unpaid', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    try {
        const [payments] = await pool.execute(
            `SELECT
                p.id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.phone,
                s.parent_phone,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.additional_amount,
                p.final_amount,
                COALESCE(p.paid_amount, 0) as paid_amount,
                ${remainingAmountSql('p')} as remaining_amount,
                p.due_date,
                p.payment_status,
                DATEDIFF(CURDATE(), p.due_date) as days_overdue
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            AND s.academy_id = p.academy_id
            WHERE p.academy_id = ?
            AND p.payment_status IN ('pending', 'partial')
            AND ${dueUnpaidSql('p')}
            AND ${remainingAmountSql('p')} > 0
            ORDER BY p.due_date ASC`,
            [req.user.academyId]
        );

        res.json({
            message: `Found ${payments.length} unpaid payments`,
            payments: decryptPaymentArray(payments)
        });
    } catch (error) {
        logger.error('Error fetching unpaid payments:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '미납 내역을 불러오는데 실패했습니다.'
        });
    }
});

/**
 * GET /paca/payments/unpaid-today
 * Get unpaid payments for students who have class today
 * 오늘 수업이 있는 학생 중 미납자만 반환
 * Access: owner, admin, PACA automation account (verifyToken 만)
 */
router.get('/unpaid-today', verifyToken, async (req, res) => {
    try {
        // 오늘 요일 (0=일, 1=월, ..., 6=토)
        const today = new Date();
        const dayOfWeek = today.getDay();
        const year = today.getFullYear();
        const month = today.getMonth() + 1;
        const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
        const todayStr = today.toISOString().split('T')[0];

        const [payments] = await pool.execute(
            `SELECT
                p.id,
                p.student_id,
                s.name as student_name,
                s.student_number,
                s.grade,
                s.phone,
                s.parent_phone,
                s.class_days,
                p.year_month,
                p.payment_type,
                p.base_amount,
                p.discount_amount,
                p.additional_amount,
                p.final_amount,
                COALESCE(p.paid_amount, 0) as paid_amount,
                ${remainingAmountSql('p')} as remaining_amount,
                p.due_date,
                p.payment_status,
                DATEDIFF(CURDATE(), p.due_date) as days_overdue,
                (
                    SELECT a.attendance_status
                    FROM attendance a
                    JOIN class_schedules cs ON a.class_schedule_id = cs.id
                    WHERE a.student_id = s.id
                    AND cs.class_date = ?
                    AND cs.academy_id = ?
                    ORDER BY a.id DESC
                    LIMIT 1
                ) as today_attendance
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            AND s.academy_id = p.academy_id
            WHERE p.academy_id = ?
            AND p.payment_status IN ('pending', 'partial')
            AND ${dueUnpaidSql('p')}
            AND ${remainingAmountSql('p')} > 0
            AND p.year_month <= ?
            AND s.status = 'active'
            AND s.deleted_at IS NULL
            AND (
                JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
                OR JSON_CONTAINS(COALESCE(s.class_days, '[]'), CAST(? AS JSON))
            )
            HAVING today_attendance IS NULL OR today_attendance NOT IN ('absent', 'excused')
            ORDER BY p.year_month DESC, s.name ASC`,
            [todayStr, req.user.academyId, req.user.academyId, yearMonth, JSON.stringify(dayOfWeek), JSON.stringify({ day: dayOfWeek })]
        );

        res.json({
            message: `오늘(${['일', '월', '화', '수', '목', '금', '토'][dayOfWeek]}요일) 수업 있는 미납자 ${payments.length}명`,
            date: todayStr,
            day_of_week: dayOfWeek,
            day_name: ['일', '월', '화', '수', '목', '금', '토'][dayOfWeek],
            count: payments.length,
            payments: decryptPaymentArray(payments)
        });
    } catch (error) {
        logger.error('Error fetching unpaid-today payments:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '오늘 미납 내역을 불러오는데 실패했습니다.'
        });
    }
});

};
