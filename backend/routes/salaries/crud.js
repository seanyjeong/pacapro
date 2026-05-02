/**
 * Salaries CRUD Sub-Router
 * ----------------------------------------------------------------
 * 마운트: routes/salaries/index.js → require('./crud')(router) (등록 순서 3순위, 와일드카드 마지막)
 * Endpoint:
 *   - GET    /        : 급여 목록 조회 (필터: instructor_id, year+month, payment_status)
 *   - GET    /:id     : 급여 상세 조회 + 출근 요약/일별 breakdown
 *   - POST   /        : 급여 기록 신규 등록 (수동 입력값 저장)
 *   - PUT    /:id     : 급여 수정 (incentive/deduction/payment_status/payment_date)
 *   - DELETE /:id     : 급여 삭제
 *
 * 인증 (ADR-007 보안 영역 무관):
 *   - GET 계열: verifyToken + checkPermission('salaries', 'view')
 *   - POST    : verifyToken + checkPermission('salaries', 'edit')
 *   - PUT/DEL : verifyToken + requireRole('owner')
 *
 * DB 패턴 (ADR-005):
 *   - pool.execute(sql, params) 통일.
 *   - PUT 의 dynamic UPDATE 빌드는 자리표시자 명시 (필드 없이 SQL 조합 X).
 *   - IN 절 없음 (ADR-016 해당 X).
 *
 * 한국어 메시지 (ADR-003):
 *   - 사용자 노출 message 한국어 친화. error code 영문 표준화.
 *   - `e.message` 사용자 노출 0건.
 *
 * 응답 표면 보존 (ADR-013):
 *   - GET    /          : `{message, salaries: [<decryptedRow>...]}`
 *   - GET    /:id       : `{salary: <decryptedRow>, attendance_summary:{...}}`
 *   - POST   /          : `{message, salary: <decryptedRow>}` (status 201)
 *   - PUT    /:id       : `{message, salary: <decryptedRow>}`
 *   - DELETE /:id       : `{message, salary:{id, instructor_name, year_month}}` (instructor_name 암호화 X — 원본 보존)
 *   - error             : `{error: '<영문코드>', message: '<한국어>'}`
 *
 * 보안 헬퍼 (ADR-007):
 *   - decryptInstructorName / decryptSalaryArray 시그니처 무변경.
 *   - DELETE 응답의 `instructor_name` 은 원본도 복호화 안 함 (ADR-013 표면 보존, 기존 동작 유지).
 *
 * 분리 미루기 (ADR-015) — 적용 안 함:
 *   - 본 모듈 5 endpoint 합산 ~400줄로 임계 미만. PUT 의 dynamic 필드는 5개로 강결합 위험 작음.
 *   - 추가 분리 시도하지 않음.
 */
const {
    pool,
    verifyToken,
    requireRole,
    checkPermission,
    logger,
    decryptInstructorName,
    decryptSalaryArray,
    timeSlotLabels,
} = require('./_utils');

module.exports = function(router) {
    /**
     * GET /paca/salaries
     * 급여 목록 조회 (필터링).
     * 응답 표면: { message: 'Found N salary records', salaries: [...] }
     * NOTE: message 의 영문 prefix `Found N salary records` 는 기존 동작 보존 (ADR-013).
     *       프론트는 message 를 표시하지 않고 salaries 배열만 소비.
     */
    router.get('/', verifyToken, checkPermission('salaries', 'view'), async (req, res) => {
        try {
            const { instructor_id, year, month, payment_status } = req.query;

            let query = `
                SELECT
                    s.id,
                    s.instructor_id,
                    i.name as instructor_name,
                    s.\`year_month\`,
                    s.base_amount,
                    s.incentive_amount,
                    s.total_deduction,
                    s.tax_type,
                    s.tax_amount,
                    s.insurance_details,
                    s.net_salary,
                    s.payment_date,
                    s.payment_status,
                    s.created_at
                FROM salary_records s
                JOIN instructors i ON s.instructor_id = i.id
                WHERE i.academy_id = ?
            `;

            const params = [req.user.academyId];

            if (instructor_id) {
                query += ' AND s.instructor_id = ?';
                params.push(parseInt(instructor_id));
            }

            if (year && month) {
                query += ` AND s.\`year_month\` = ?`;
                params.push(`${year}-${String(month).padStart(2, '0')}`);
            }

            if (payment_status) {
                query += ' AND s.payment_status = ?';
                params.push(payment_status);
            }

            query += ' ORDER BY s.`year_month` DESC, i.name ASC';

            const [salaries] = await pool.execute(query, params);

            res.json({
                message: `${salaries.length}건의 급여 기록을 찾았습니다.`,
                salaries: decryptSalaryArray(salaries)
            });
        } catch (error) {
            logger.error('Error fetching salaries:', error);
            res.status(500).json({
                error: 'FETCH_SALARIES_FAILED',
                message: '급여 목록을 불러오지 못했습니다.'
            });
        }
    });

    /**
     * GET /paca/salaries/:id
     * 급여 상세 조회 + 해당 월 출근 기록 요약/일별 breakdown.
     * 응답 표면: { salary: {...}, attendance_summary: {...} }  (message 키 없음 — 기존 동작 보존)
     */
    router.get('/:id', verifyToken, checkPermission('salaries', 'view'), async (req, res) => {
        const salaryId = parseInt(req.params.id);

        try {
            const [salaries] = await pool.execute(
                `SELECT
                    s.*,
                    i.name as instructor_name,
                    i.salary_type,
                    i.hourly_rate,
                    i.base_salary,
                    i.tax_type as instructor_tax_type,
                    i.morning_class_rate,
                    i.afternoon_class_rate,
                    i.evening_class_rate
                 FROM salary_records s
                 JOIN instructors i ON s.instructor_id = i.id
                 WHERE s.id = ?
                   AND i.academy_id = ?`,
                [salaryId, req.user.academyId]
            );

            if (salaries.length === 0) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: '급여 기록을 찾을 수 없습니다.'
                });
            }

            const salary = salaries[0];
            const attendanceYearMonth = salary.year_month;

            const [attendances] = await pool.execute(
                `SELECT
                    work_date,
                    time_slot,
                    check_in_time,
                    check_out_time,
                    attendance_status,
                    notes
                 FROM instructor_attendance
                 WHERE instructor_id = ?
                   AND DATE_FORMAT(work_date, '%Y-%m') = ?
                   AND attendance_status IN ('present', 'late', 'half_day')
                 ORDER BY work_date, time_slot`,
                [salary.instructor_id, attendanceYearMonth]
            );

            // 일별 그룹화
            const dailyBreakdown = {};

            for (const att of attendances) {
                const dateStr = att.work_date instanceof Date
                    ? att.work_date.toISOString().split('T')[0]
                    : att.work_date;

                if (!dailyBreakdown[dateStr]) {
                    dailyBreakdown[dateStr] = {
                        slots: [],
                        details: []
                    };
                }

                dailyBreakdown[dateStr].slots.push(timeSlotLabels[att.time_slot] || att.time_slot);
                dailyBreakdown[dateStr].details.push({
                    time_slot: att.time_slot,
                    time_slot_label: timeSlotLabels[att.time_slot] || att.time_slot,
                    check_in_time: att.check_in_time,
                    check_out_time: att.check_out_time,
                    attendance_status: att.attendance_status
                });
            }

            // 요약 정보 계산
            let morningClasses = 0, afternoonClasses = 0, eveningClasses = 0, totalMinutes = 0;
            for (const att of attendances) {
                if (att.time_slot === 'morning') morningClasses++;
                else if (att.time_slot === 'afternoon') afternoonClasses++;
                else if (att.time_slot === 'evening') eveningClasses++;

                if (att.check_in_time && att.check_out_time) {
                    const [inH, inM] = att.check_in_time.split(':').map(Number);
                    const [outH, outM] = att.check_out_time.split(':').map(Number);
                    const inMins = inH * 60 + inM;
                    const outMins = outH * 60 + outM;
                    if (outMins > inMins) {
                        totalMinutes += (outMins - inMins);
                    }
                }
            }

            res.json({
                salary: decryptInstructorName(salary),
                attendance_summary: {
                    work_year_month: attendanceYearMonth,
                    attendance_days: Object.keys(dailyBreakdown).length,
                    total_classes: morningClasses + afternoonClasses + eveningClasses,
                    morning_classes: morningClasses,
                    afternoon_classes: afternoonClasses,
                    evening_classes: eveningClasses,
                    total_hours: Math.round((totalMinutes / 60) * 100) / 100,
                    daily_breakdown: dailyBreakdown
                }
            });
        } catch (error) {
            logger.error('Error fetching salary:', error);
            res.status(500).json({
                error: 'FETCH_SALARY_FAILED',
                message: '급여 정보를 불러오지 못했습니다.'
            });
        }
    });

    /**
     * POST /paca/salaries
     * 급여 기록 신규 등록.
     * - 동일 강사 + 동일 year_month 중복 방지.
     * - status 201 + { message, salary }.
     */
    router.post('/', verifyToken, checkPermission('salaries', 'edit'), async (req, res) => {
        try {
            const {
                instructor_id,
                year_month,
                base_amount,
                incentive_amount,
                total_deduction,
                tax_type,
                tax_amount,
                insurance_details,
                net_salary
            } = req.body;

            if (!instructor_id || !year_month || !base_amount || !tax_type || !net_salary) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '필수 항목 누락: 강사, 연월, 기본급, 세금 유형, 실수령액'
                });
            }

            // 강사 존재 확인
            const [instructors] = await pool.execute(
                'SELECT id FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            // 중복 확인
            const [existing] = await pool.execute(
                'SELECT id FROM salary_records WHERE instructor_id = ? AND `year_month` = ?',
                [instructor_id, year_month]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: `${year_month} 급여 기록이 이미 존재합니다.`
                });
            }

            // INSERT
            const [result] = await pool.execute(
                `INSERT INTO salary_records (
                    instructor_id,
                    \`year_month\`,
                    base_amount,
                    incentive_amount,
                    total_deduction,
                    tax_type,
                    tax_amount,
                    insurance_details,
                    net_salary,
                    payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    instructor_id,
                    year_month,
                    base_amount,
                    incentive_amount || 0,
                    total_deduction || 0,
                    tax_type,
                    tax_amount || 0,
                    insurance_details ? JSON.stringify(insurance_details) : null,
                    net_salary
                ]
            );

            // 생성된 레코드 조회
            const [created] = await pool.execute(
                `SELECT s.*, i.name as instructor_name
                 FROM salary_records s
                 JOIN instructors i ON s.instructor_id = i.id
                 WHERE s.id = ?`,
                [result.insertId]
            );

            res.status(201).json({
                message: '급여 기록이 등록되었습니다.',
                salary: decryptInstructorName(created[0])
            });
        } catch (error) {
            logger.error('Error creating salary:', error);
            res.status(500).json({
                error: 'CREATE_SALARY_FAILED',
                message: '급여 기록 등록에 실패했습니다.'
            });
        }
    });

    /**
     * PUT /paca/salaries/:id
     * 급여 수정 (incentive_amount, total_deduction, payment_status, payment_date 만 변경 가능).
     * - incentive 또는 deduction 변경 시 net_salary 자동 재계산.
     */
    router.put('/:id', verifyToken, requireRole('owner'), async (req, res) => {
        const salaryId = parseInt(req.params.id);

        try {
            // 기존 레코드 조회 (재계산 입력값 포함)
            const [salaries] = await pool.execute(
                `SELECT s.id, s.base_amount, s.incentive_amount, s.total_deduction, s.tax_amount,
                        i.academy_id
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

            if (salaries[0].academy_id !== req.user.academyId) {
                return res.status(403).json({
                    error: 'FORBIDDEN',
                    message: '접근 권한이 없습니다.'
                });
            }

            const { incentive_amount, total_deduction, payment_status, payment_date } = req.body;

            const updates = [];
            const params = [];

            if (incentive_amount !== undefined) {
                updates.push('incentive_amount = ?');
                params.push(incentive_amount);
            }
            if (total_deduction !== undefined) {
                updates.push('total_deduction = ?');
                params.push(total_deduction);
            }
            if (payment_status !== undefined) {
                updates.push('payment_status = ?');
                params.push(payment_status);
            }
            if (payment_date !== undefined) {
                updates.push('payment_date = ?');
                params.push(payment_date);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '수정할 항목이 없습니다.'
                });
            }

            // 인센티브/공제액 변경 시 net_salary 자동 재계산
            if (incentive_amount !== undefined || total_deduction !== undefined) {
                const currentSalary = salaries[0];
                const newIncentive = incentive_amount !== undefined
                    ? parseFloat(incentive_amount)
                    : parseFloat(currentSalary.incentive_amount) || 0;
                const newDeduction = total_deduction !== undefined
                    ? parseFloat(total_deduction)
                    : parseFloat(currentSalary.total_deduction) || 0;
                const baseAmount = parseFloat(currentSalary.base_amount) || 0;
                const taxAmount = parseFloat(currentSalary.tax_amount) || 0;

                // 실수령액 = 기본급 + 인센티브 - 공제액 - 세금 (10원 단위 이하 버림)
                const netSalary = Math.floor((baseAmount + newIncentive - newDeduction - taxAmount) / 10) * 10;
                updates.push('net_salary = ?');
                params.push(netSalary);
            }

            updates.push('updated_at = NOW()');
            params.push(salaryId);

            await pool.execute(
                `UPDATE salary_records SET ${updates.join(', ')} WHERE id = ?`,
                params
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
                message: '급여 기록이 수정되었습니다.',
                salary: decryptInstructorName(updated[0])
            });
        } catch (error) {
            logger.error('Error updating salary:', error);
            res.status(500).json({
                error: 'UPDATE_SALARY_FAILED',
                message: '급여 기록 수정에 실패했습니다.'
            });
        }
    });

    /**
     * DELETE /paca/salaries/:id
     * 급여 삭제.
     * 응답 표면: { message, salary:{id, instructor_name, year_month} }
     * NOTE: 응답의 instructor_name 은 원본도 복호화하지 않음 (ADR-013 보존, 기존 동작 유지).
     */
    router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
        const salaryId = parseInt(req.params.id);

        try {
            const [salaries] = await pool.execute(
                `SELECT s.id, i.academy_id, i.name as instructor_name, s.\`year_month\`
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

            if (salaries[0].academy_id !== req.user.academyId) {
                return res.status(403).json({
                    error: 'FORBIDDEN',
                    message: '접근 권한이 없습니다.'
                });
            }

            await pool.execute('DELETE FROM salary_records WHERE id = ?', [salaryId]);

            res.json({
                message: '급여 기록이 삭제되었습니다.',
                salary: {
                    id: salaryId,
                    instructor_name: salaries[0].instructor_name,
                    year_month: salaries[0].year_month
                }
            });
        } catch (error) {
            logger.error('Error deleting salary:', error);
            res.status(500).json({
                error: 'DELETE_SALARY_FAILED',
                message: '급여 기록 삭제에 실패했습니다.'
            });
        }
    });
};
