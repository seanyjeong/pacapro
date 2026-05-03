/**
 * Salaries Payment Sub-Router
 * ----------------------------------------------------------------
 * 마운트: routes/salaries/index.js → require('./payment')(router) (등록 순서 1순위)
 * Endpoint:
 *   - POST /bulk-pay     : 미지급 급여 일괄 지급 처리 (year_month 또는 salary_ids 필터)
 *   - POST /:id/pay      : 단일 급여 지급 처리 (1건 + expenses INSERT)
 *
 * 인증 (ADR-007 보안 영역 무관):
 *   - verifyToken + requireRole('owner') — 지급 처리는 owner 만.
 *
 * DB 패턴 (ADR-005):
 *   - pool.execute(sql, params) 통일.
 *   - bulk-pay 의 IN 절 2건 (조회 + UPDATE) 은 ADR-016 표준 (자리표시자 N개 명시 전개 + spread params) 적용.
 *   - bulk INSERT (expenses) 는 자리표시자 N×8 펼침으로 ADR-005 prepared statement 호환.
 *
 * 한국어 메시지 (ADR-003):
 *   - 사용자 노출 message 한국어 친화. error code 영문 표준화.
 *   - `e.message` 사용자 노출 0건 (시스템 정보 누출 차단).
 *
 * 응답 표면 보존 (ADR-013):
 *   - POST /bulk-pay: `{message, paid_count, salaries:[{id, instructor_name, net_salary, year_month}]}`
 *   - POST /:id/pay : `{message, salary: <decryptedRow>}`  (salary 객체 root 키 보존)
 *   - error          : `{error: '<영문코드>', message: '<한국어>'}`
 */
const {
    pool,
    verifyToken,
    requireRole,
    logger,
    decryptInstructorName,
} = require('./_utils');

module.exports = function(router) {
    /**
     * POST /paca/salaries/bulk-pay
     * 미지급 급여 일괄 지급 처리.
     * - salary_ids 우선, 없으면 year_month 로 필터.
     * - salary_records UPDATE + expenses INSERT (multi-row).
     * - ADR-016: IN 절 자리표시자 N개 명시 전개.
     */
    router.post('/bulk-pay', verifyToken, requireRole('owner'), async (req, res) => {
        try {
            const { year_month, salary_ids, payment_date } = req.body;

            let salariesToPay = [];

            if (salary_ids && salary_ids.length > 0) {
                // ADR-016: IN 절 자리표시자 명시 전개
                const placeholders = salary_ids.map(() => '?').join(',');
                const [rows] = await pool.execute(
                    `SELECT s.id, s.instructor_id, s.net_salary, s.\`year_month\`,
                            i.academy_id, i.name as instructor_name
                     FROM salary_records s
                     JOIN instructors i ON s.instructor_id = i.id
                     WHERE s.id IN (${placeholders})
                       AND s.payment_status = 'pending'
                       AND i.academy_id = ?`,
                    [...salary_ids, req.user.academyId]
                );
                salariesToPay = rows;
            } else if (year_month) {
                const [rows] = await pool.execute(
                    `SELECT s.id, s.instructor_id, s.net_salary, s.\`year_month\`,
                            i.academy_id, i.name as instructor_name
                     FROM salary_records s
                     JOIN instructors i ON s.instructor_id = i.id
                     WHERE s.\`year_month\` = ?
                       AND s.payment_status = 'pending'
                       AND i.academy_id = ?`,
                    [year_month, req.user.academyId]
                );
                salariesToPay = rows;
            } else {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: 'year_month 또는 salary_ids 중 하나는 반드시 지정해야 합니다.'
                });
            }

            if (salariesToPay.length === 0) {
                return res.status(200).json({
                    message: '지급 처리할 미지급 급여가 없습니다.',
                    paid_count: 0,
                    salaries: []
                });
            }

            const actualPaymentDate = payment_date || new Date().toISOString().split('T')[0];
            const paidIds = salariesToPay.map(s => s.id);

            // ADR-016: UPDATE IN 절 자리표시자 명시 전개
            const updatePlaceholders = paidIds.map(() => '?').join(',');
            await pool.execute(
                `UPDATE salary_records
                 SET payment_status = 'paid', payment_date = ?, updated_at = NOW()
                 WHERE id IN (${updatePlaceholders})`,
                [actualPaymentDate, ...paidIds]
            );

            // 지출 기록 일괄 INSERT (자리표시자 N×8 명시 전개 — ADR-005 prepared statement 호환)
            if (salariesToPay.length > 0) {
                const valuesPart = salariesToPay.map(() => '(?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
                const insertParams = [];
                for (const s of salariesToPay) {
                    insertParams.push(
                        s.academy_id,
                        actualPaymentDate,
                        'salary',
                        s.net_salary,
                        s.id,
                        s.instructor_id,
                        `급여 지급 (${s.year_month})`,
                        req.user.userId
                    );
                }
                await pool.execute(
                    `INSERT INTO expenses (
                        academy_id, expense_date, category, amount, salary_id, instructor_id, description, recorded_by
                    ) VALUES ${valuesPart}`,
                    insertParams
                );
            }

            res.json({
                message: `${salariesToPay.length}건의 급여가 지급 처리되었습니다.`,
                paid_count: salariesToPay.length,
                salaries: salariesToPay.map(s => ({
                    id: s.id,
                    instructor_name: s.instructor_name,
                    net_salary: s.net_salary,
                    year_month: s.year_month
                }))
            });
        } catch (error) {
            logger.error('Error bulk paying salaries:', error);
            res.status(500).json({
                error: 'BULK_PAY_FAILED',
                message: '급여 일괄 지급에 실패했습니다.'
            });
        }
    });

    /**
     * POST /paca/salaries/:id/pay
     * 단일 급여 지급 처리.
     * - salary_records UPDATE + expenses INSERT (1건).
     */
    router.post('/:id/pay', verifyToken, requireRole('owner'), async (req, res) => {
        const salaryId = parseInt(req.params.id);

        try {
            const { payment_date } = req.body;

            const [salaries] = await pool.execute(
                `SELECT s.*, i.academy_id, i.name as instructor_name
                 FROM salary_records s
                 JOIN instructors i ON s.instructor_id = i.id
                 WHERE s.id = ?`,
                [salaryId]
            );

            if (salaries.length === 0) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: '급여 기록을 찾을 수 없습니다.'
                });
            }

            const salary = salaries[0];

            if (salary.academy_id !== req.user.academyId) {
                return res.status(403).json({
                    error: 'FORBIDDEN',
                    message: '접근 권한이 없습니다.'
                });
            }

            const actualPaymentDate = payment_date || new Date().toISOString().split('T')[0];

            // 지급 상태 업데이트
            await pool.execute(
                `UPDATE salary_records
                 SET payment_status = 'paid', payment_date = ?, updated_at = NOW()
                 WHERE id = ?`,
                [actualPaymentDate, salaryId]
            );

            // 지출 기록
            await pool.execute(
                `INSERT INTO expenses (
                    academy_id,
                    expense_date,
                    category,
                    amount,
                    salary_id,
                    instructor_id,
                    description,
                    recorded_by
                ) VALUES (?, ?, 'salary', ?, ?, ?, ?, ?)`,
                [
                    salary.academy_id,
                    actualPaymentDate,
                    salary.net_salary,
                    salaryId,
                    salary.instructor_id,
                    `급여 지급 (${salary.year_month})`,
                    req.user.userId
                ]
            );

            // 업데이트된 레코드 조회
            const [updated] = await pool.execute(
                `SELECT s.*, i.name as instructor_name
                 FROM salary_records s
                 JOIN instructors i ON s.instructor_id = i.id
                 WHERE s.id = ?`,
                [salaryId]
            );

            res.json({
                message: '급여 지급이 등록되었습니다.',
                salary: decryptInstructorName(updated[0])
            });
        } catch (error) {
            logger.error('Error recording salary payment:', error);
            res.status(500).json({
                error: 'PAY_FAILED',
                message: '급여 지급 등록에 실패했습니다.'
            });
        }
    });
};
