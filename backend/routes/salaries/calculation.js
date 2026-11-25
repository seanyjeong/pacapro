/**
 * Salaries Calculation Sub-Router
 * ----------------------------------------------------------------
 * 마운트: routes/salaries/index.js → require('./calculation')(router) (등록 순서 2순위)
 * Endpoint:
 *   - POST /calculate                                       : salaryCalculator 헬퍼로 계산만 수행 (DB 변경 X)
 *   - GET  /work-summary/:instructorId/:yearMonth           : 월별 출근 기록 → 수업 요약 (계산 입력 데이터)
 *   - POST /:id/recalculate                                 : 미지급 급여 재계산 (강사 현재 단가 + 출근 기록)
 *
 * 인증 (ADR-007 보안 영역 무관):
 *   - verifyToken + checkPermission('salaries', 'view'/'edit')
 *
 * DB 패턴 (ADR-005):
 *   - pool.execute(sql, params) 통일.
 *   - IN 절 없음 (ADR-016 해당 X).
 *
 * 한국어 메시지 (ADR-003):
 *   - 사용자 노출 message 한국어 친화. error code 영문 표준화.
 *   - `e.message` 사용자 노출 0건.
 *
 * 응답 표면 보존 (ADR-013):
 *   - POST /calculate                : `{message, instructor:{id,name,salary_type}, salary: <salaryData>}`
 *   - GET  /work-summary/...         : `{message, instructor:{...9키}, work_summary:{...8키 + daily_breakdown}}`
 *   - POST /:id/recalculate          : `{message, salary:{id, base_amount, tax_amount, net_salary, ... 10키}}`
 *   - error                          : `{error: '<영문코드>', message: '<한국어>'}`
 *
 * 보안 헬퍼 (ADR-007):
 *   - decrypt(instructor.name) 시그니처 무변경. utils/salaryCalculator.calculateInstructorSalary 무수정.
 */
const {
    pool,
    verifyToken,
    checkPermission,
    calculateInstructorSalary,
    decrypt,
    logger,
    timeSlotLabels,
} = require('./_utils');
const { lockSalary } = require('../../repositories/salaryRepository');
const { inTransaction, isPaid, recalculate } = require('../../services/salaryService');

module.exports = function(router) {
    /**
     * POST /paca/salaries/calculate
     * salaryCalculator 헬퍼로 급여 계산 (DB 저장 X — 미리보기 용도).
     */
    router.post('/calculate', verifyToken, checkPermission('salaries', 'edit'), async (req, res) => {
        try {
            const { instructor_id, year, month, incentive_amount, total_deduction, work_data } = req.body;

            if (!instructor_id || !year || !month) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '강사 ID, 연도, 월은 필수 항목입니다.'
                });
            }

            const [instructors] = await pool.execute(
                'SELECT * FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructor_id, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            const instructor = instructors[0];

            const salaryData = calculateInstructorSalary(
                instructor,
                { ...(work_data || {}), yearMonth: `${year}-${String(month).padStart(2, '0')}` },
                incentive_amount || 0,
                total_deduction || 0
            );

            res.json({
                message: '급여 계산이 완료되었습니다.',
                instructor: {
                    id: instructor.id,
                    name: decrypt(instructor.name),
                    salary_type: instructor.salary_type
                },
                salary: salaryData
            });
        } catch (error) {
            logger.error('Error calculating salary:', error);
            res.status(500).json({
                error: 'CALCULATE_FAILED',
                message: '급여 계산에 실패했습니다.'
            });
        }
    });

    /**
     * GET /paca/salaries/work-summary/:instructorId/:yearMonth
     * 강사의 월별 근무 요약 조회 (수업 횟수, 시간, 일별 breakdown).
     * 프론트 응답 표면: { message, instructor:{...9키}, work_summary:{...} }
     */
    router.get('/work-summary/:instructorId/:yearMonth', verifyToken, checkPermission('salaries', 'view'), async (req, res) => {
        const instructorId = parseInt(req.params.instructorId);
        const yearMonth = req.params.yearMonth; // YYYY-MM

        try {
            const dateRegex = /^\d{4}-\d{2}$/;
            if (!dateRegex.test(yearMonth)) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '연월 형식이 올바르지 않습니다. (YYYY-MM)'
                });
            }

            const [instructors] = await pool.execute(
                `SELECT id, name, salary_type, hourly_rate, base_salary, tax_type,
                        morning_class_rate, afternoon_class_rate, evening_class_rate
                 FROM instructors
                 WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
                [instructorId, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            const instructor = instructors[0];

            const [attendances] = await pool.execute(
                `SELECT
                    ia.time_slot,
                    ia.attendance_status,
                    ia.check_in_time,
                    ia.check_out_time,
                    ia.work_date
                 FROM instructor_attendance ia
                 WHERE ia.instructor_id = ?
                   AND DATE_FORMAT(ia.work_date, '%Y-%m') = ?
                   AND ia.attendance_status IN ('present', 'late')
                 ORDER BY ia.work_date, ia.time_slot`,
                [instructorId, yearMonth]
            );

            // 수업 요약 계산
            let morningClasses = 0;
            let afternoonClasses = 0;
            let eveningClasses = 0;
            let totalHours = 0;
            const dailyBreakdown = {};

            for (const att of attendances) {
                if (att.time_slot === 'morning') morningClasses++;
                else if (att.time_slot === 'afternoon') afternoonClasses++;
                else if (att.time_slot === 'evening') eveningClasses++;

                if (att.check_in_time && att.check_out_time) {
                    const checkIn = new Date(`2000-01-01 ${att.check_in_time}`);
                    const checkOut = new Date(`2000-01-01 ${att.check_out_time}`);
                    const hours = (checkOut - checkIn) / (1000 * 60 * 60);
                    if (hours > 0) totalHours += hours;
                } else {
                    totalHours += 3; // 기본 3시간
                }

                const dateStr = att.work_date instanceof Date
                    ? att.work_date.toISOString().split('T')[0]
                    : att.work_date;

                if (!dailyBreakdown[dateStr]) {
                    dailyBreakdown[dateStr] = [];
                }
                dailyBreakdown[dateStr].push(timeSlotLabels[att.time_slot] || att.time_slot);
            }

            const totalClasses = morningClasses + afternoonClasses + eveningClasses;

            res.json({
                message: '근무 요약 조회 완료',
                instructor: {
                    id: instructor.id,
                    name: decrypt(instructor.name),
                    salary_type: instructor.salary_type,
                    hourly_rate: instructor.hourly_rate,
                    base_salary: instructor.base_salary,
                    tax_type: instructor.tax_type,
                    morning_class_rate: instructor.morning_class_rate,
                    afternoon_class_rate: instructor.afternoon_class_rate,
                    evening_class_rate: instructor.evening_class_rate
                },
                work_summary: {
                    year_month: yearMonth,
                    morning_classes: morningClasses,
                    afternoon_classes: afternoonClasses,
                    evening_classes: eveningClasses,
                    total_classes: totalClasses,
                    total_hours: Math.round(totalHours * 100) / 100,
                    attendance_days: Object.keys(dailyBreakdown).length,
                    daily_breakdown: dailyBreakdown
                }
            });
        } catch (error) {
            logger.error('Error fetching work summary:', error);
            res.status(500).json({
                error: 'WORK_SUMMARY_FAILED',
                message: '근무 요약을 불러오지 못했습니다.'
            });
        }
    });

    /**
     * POST /paca/salaries/:id/recalculate
     * 미지급 급여 재계산 (현재 강사 단가 + 출근 기록 + 급여 규칙). 조정 항목은 그대로 남는다.
     * - paid 상태는 재계산 불가.
     * - salary_records UPDATE (base_amount, tax_type, tax_amount, net_salary, updated_at).
     */
    router.post('/:id/recalculate', verifyToken, checkPermission('salaries', 'edit'), async (req, res) => {
        const salaryId = parseInt(req.params.id);

        try {
            const outcome = await inTransaction(pool, async conn => {
                const salary = await lockSalary(conn, salaryId, req.user.academyId);
                if (!salary || isPaid(salary)) return { salary };
                return { salary, result: await recalculate(conn, salary) };
            });

            if (!outcome.salary) {
                return res.status(404).json({
                    error: 'NOT_FOUND',
                    message: '급여 기록을 찾을 수 없습니다.'
                });
            }

            // 지급 완료된 급여는 재계산 불가
            if (!outcome.result) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '이미 지급 완료된 급여는 재계산할 수 없습니다.'
                });
            }

            const { result } = outcome;
            res.json({
                message: '급여가 재계산되었습니다.',
                salary: {
                    id: salaryId,
                    base_amount: result.baseAmount,
                    tax_amount: result.taxAmount,
                    net_salary: result.netSalary,
                    incentive_amount: result.incentive,
                    total_deduction: result.deduction,
                    adjustment_amount: result.adjustmentAmount,
                    morning_classes: result.counts.morning,
                    afternoon_classes: result.counts.afternoon,
                    evening_classes: result.counts.evening,
                    total_classes: result.counts.morning + result.counts.afternoon + result.counts.evening,
                    total_hours: Math.round(result.totalHours * 100) / 100
                }
            });
        } catch (error) {
            logger.error('Error recalculating salary:', error);
            res.status(500).json({
                error: 'RECALCULATE_FAILED',
                message: '급여 재계산에 실패했습니다.'
            });
        }
    });
};
