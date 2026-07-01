/**
 * paca/seasons/enroll.js — 시즌 학생 등록 라우터
 *
 * 마운트: paca.js → routes/seasons/index.js → require('./enroll')(router)
 *         mount path: '/paca/seasons'
 *
 * Endpoint:
 *   - POST /:id/enroll   — 학생을 시즌에 등록 (일할계산 + 연속할인 + 수동할인 + active 시 스케줄 자동 배정)
 *
 * 인증: verifyToken + checkPermission('seasons', 'edit').
 *
 * 응답 표면 보존 (ADR-013) — 프론트 src/lib/api/seasons.ts (enrollStudent / getProRatedPreview):
 *     - POST /:id/enroll  → 201 { message, enrollment, proRatedCalculation, midSeasonProRated,
 *                                  schedule_assignment: { removed_from_regular, assigned_to_season } }
 *     - 4xx/5xx           → { error, message }
 *
 * DB 호출 (ADR-005): pool.execute. db.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007):
 *   - decrypt(value) 시그니처 무변경 (학생 이름 복호화).
 *   - 결제(student_payments) INSERT + 미납 월회비 정리만 — payments / toss 미접촉, 외부 결제 시스템 미호출 → 학사 데이터.
 *   - bcrypt/JWT 직접 사용 X → 자율 진행 가능 (ADR-017).
 *
 * 사이드이펙트 (POST /:id/enroll):
 *   1. student_seasons INSERT 또는 누락 시즌비 복구
 *   2. students UPDATE (is_season_registered, current_season_id)
 *   3. student_payments INSERT (시즌비 청구)
 *   4. season_monthly_policy='season_replaces_monthly' 이면 시즌 기간 미납 월회비 삭제
 *   5. season.status='active' 일 때만:
 *      a. removeStudentFromRegularSchedules (정규 스케줄 attendance 삭제)
 *      b. autoAssignStudentToSeasonSchedules (시즌 스케줄 attendance 자동 배정)
 *      → 둘 다 try/catch 로 격리 (실패해도 enrollment 는 성공 유지).
 *
 * 거대 dynamic 분리 미루기 (ADR-015):
 *   POST /:id/enroll 은 ~340줄의 단일 핸들러로 (a) 일할계산 + (b) 연속할인 + (c) 수동할인 +
 *   (d) NaN 안전 검사 + (e) student_seasons INSERT + (f) student_payments INSERT +
 *   (g) 스케줄 자동 배정까지 강결합. 본 phase 는 ADR-005/003 + JSDoc 정렬만 단독 진행.
 *   별도 트랙 (응답 표준화 + autoAssign 분리 + dynamic insert 분리) 진입 시 본격 분리 검토.
 */

const {
    pool,
    decrypt,
    logger,
    calculateProRatedFee,
    calculateMidSeasonFee,
    parseWeeklyDays,
    truncateToThousands,
    autoAssignStudentToSeasonSchedules,
    removeStudentFromRegularSchedules
} = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { deleteUnpaidMonthlyPaymentsForSeason } = require('./monthly-cleanup');

function shouldUseLegacySeasonPaymentInsert(error) {
    if (!error) return false;
    const message = String(error.message || '');
    const missingSeasonIdColumn = (error.code === 'ER_BAD_FIELD_ERROR' || error.errno === 1054)
        && message.includes('season_id');
    const invalidSeasonIdReference = error.code === 'ER_NO_REFERENCED_ROW_2'
        && (message.includes('season_id') || message.includes('student_payments_ibfk_3'));
    return missingSeasonIdColumn || invalidSeasonIdReference;
}

async function insertSeasonPayment(payment) {
    const params = [
        payment.studentId,
        payment.academyId,
        payment.yearMonth,
        payment.seasonId,
        payment.baseAmount,
        payment.additionalAmount,
        payment.finalAmount,
        payment.dueDate,
        payment.description,
        payment.recordedBy
    ];

    try {
        return await pool.execute(
            `INSERT INTO student_payments (
                student_id,
                academy_id,
                \`year_month\`,
                payment_type,
                season_id,
                base_amount,
                discount_amount,
                additional_amount,
                final_amount,
                due_date,
                payment_status,
                description,
                recorded_by
            ) VALUES (?, ?, ?, 'season', ?, ?, 0, ?, ?, ?, 'pending', ?, ?)`,
            params
        );
    } catch (error) {
        if (!shouldUseLegacySeasonPaymentInsert(error)) {
            throw error;
        }

        logger.warn('student_payments.season_id is not usable; using legacy season payment insert');
        return pool.execute(
            `INSERT INTO student_payments (
                student_id,
                academy_id,
                \`year_month\`,
                payment_type,
                base_amount,
                discount_amount,
                additional_amount,
                final_amount,
                due_date,
                payment_status,
                description,
                recorded_by
            ) VALUES (?, ?, ?, 'season', ?, 0, ?, ?, ?, 'pending', ?, ?)`,
            [
                payment.studentId,
                payment.academyId,
                payment.yearMonth,
                payment.baseAmount,
                payment.additionalAmount,
                payment.finalAmount,
                payment.dueDate,
                payment.description,
                payment.recordedBy
            ]
        );
    }
}

module.exports = function(router) {

router.post('/:id/enroll', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const {
            student_id,
            season_fee,
            registration_date,
            after_season_action,
            is_continuous,
            previous_season_id,
            time_slots,
            discount_amount: manualDiscount,
            discount_reason
        } = req.body;

        if (!student_id || season_fee === undefined || season_fee === null) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required fields: student_id, season_fee'
            });
        }

        const [seasons] = await pool.execute(
            `SELECT * FROM seasons WHERE id = ? AND academy_id = ? AND status != 'ended'`,
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found or ended'
            });
        }

        const season = seasons[0];

        const [students] = await pool.execute(
            'SELECT * FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const student = students[0];

        const [existing] = await pool.execute(
            `SELECT id FROM student_seasons
            WHERE student_id = ? AND season_id = ? AND payment_status != 'cancelled'`,
            [student_id, seasonId]
        );

        const existingEnrollment = existing[0] || null;

        let proRated = { proRatedFee: 0 };
        let proRatedMonth = null;

        if (student.class_days && season.non_season_end_date) {
            try {
                const weeklyDays = parseWeeklyDays(student.class_days);
                const nonSeasonEnd = new Date(season.non_season_end_date);
                proRatedMonth = `${nonSeasonEnd.getFullYear()}-${String(nonSeasonEnd.getMonth() + 1).padStart(2, '0')}`;

                proRated = calculateProRatedFee({
                    monthlyFee: parseFloat(student.monthly_tuition) || 0,
                    weeklyDays,
                    nonSeasonEndDate: nonSeasonEnd,
                    discountRate: parseFloat(student.discount_rate) || 0
                });
            } catch (proRateError) {
                logger.info('ProRated calculation skipped:', proRateError.message);
            }
        }

        const regDate = new Date(registration_date || new Date());
        const seasonStartDate = new Date(season.season_start_date);
        const seasonEndDate = new Date(season.season_end_date);
        const yearMonth = `${seasonStartDate.getFullYear()}-${String(seasonStartDate.getMonth() + 1).padStart(2, '0')}`;

        let baseSeasonFee = parseFloat(season_fee) || 0;
        let midSeasonProRated = null;

        if (regDate > seasonStartDate && season.operating_days) {
            try {
                const operatingDays = typeof season.operating_days === 'string'
                    ? JSON.parse(season.operating_days)
                    : season.operating_days;

                if (Array.isArray(operatingDays) && operatingDays.length > 0) {
                    const dayMap = { '일': 0, '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6 };
                    const weeklyDaysForSeason = operatingDays.map(d => typeof d === 'string' ? dayMap[d] : d).filter(d => d !== undefined);

                    midSeasonProRated = calculateMidSeasonFee({
                        seasonFee: baseSeasonFee,
                        seasonStartDate: seasonStartDate,
                        seasonEndDate: seasonEndDate,
                        joinDate: regDate,
                        weeklyDays: weeklyDaysForSeason
                    });

                    baseSeasonFee = midSeasonProRated.proRatedFee;
                }
            } catch (midSeasonError) {
                logger.info('Mid-season prorated calculation skipped:', midSeasonError.message);
            }
        }

        let discountType = 'none';
        let discountAmount = 0;
        let finalSeasonFee = baseSeasonFee;

        if (is_continuous && previous_season_id && season.continuous_discount_type !== 'none') {
            discountType = season.continuous_discount_type;
            if (discountType === 'free') {
                discountAmount = finalSeasonFee;
                finalSeasonFee = 0;
            } else if (discountType === 'rate' && season.continuous_discount_rate > 0) {
                discountAmount = truncateToThousands(finalSeasonFee * (season.continuous_discount_rate / 100));
                finalSeasonFee -= discountAmount;
            }
        }

        if (manualDiscount && parseFloat(manualDiscount) > 0) {
            const manualDiscountValue = parseFloat(manualDiscount) || 0;
            discountAmount += manualDiscountValue;
            finalSeasonFee -= manualDiscountValue;
            if (finalSeasonFee < 0) finalSeasonFee = 0;
            if (discountType === 'none') discountType = 'manual';
        }

        if (isNaN(baseSeasonFee)) baseSeasonFee = parseFloat(season_fee) || 0;
        if (isNaN(finalSeasonFee)) finalSeasonFee = baseSeasonFee;
        if (isNaN(discountAmount)) discountAmount = 0;

        const validTimeSlots = ['morning', 'afternoon', 'evening'];
        let parsedTimeSlots = null;
        if (time_slots && Array.isArray(time_slots) && time_slots.length > 0) {
            parsedTimeSlots = time_slots.filter(ts => validTimeSlots.includes(ts));
            if (parsedTimeSlots.length === 0) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Invalid time_slots. Must be array of: morning, afternoon, evening'
                });
            }
        }

        const [existingSeasonPayment] = await pool.execute(
            `SELECT id FROM student_payments
             WHERE student_id = ? AND academy_id = ?
             AND \`year_month\` = ? AND payment_type = 'season'`,
            [student_id, req.user.academyId, yearMonth]
        );

        if (existingSeasonPayment.length > 0) {
            return res.status(existingEnrollment ? 400 : 409).json({
                error: existingEnrollment ? 'Validation Error' : 'Duplicate Payment',
                message: existingEnrollment
                    ? 'Student already enrolled in this season'
                    : `${yearMonth} 시즌비 납부건이 이미 존재합니다.`
            });
        }

        let enrollmentId = existingEnrollment?.id;
        if (!enrollmentId) {
            const [result] = await pool.execute(
                `INSERT INTO student_seasons (
                    student_id,
                    season_id,
                    season_fee,
                    registration_date,
                    after_season_action,
                    prorated_month,
                    prorated_amount,
                    prorated_details,
                    is_continuous,
                    previous_season_id,
                    discount_type,
                    discount_amount,
                    discount_reason,
                    time_slots,
                    payment_status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
                [
                    student_id,
                    seasonId,
                    finalSeasonFee || 0,
                    registration_date || new Date().toISOString().split('T')[0],
                    after_season_action || 'regular',
                    proRatedMonth,
                    proRated?.proRatedFee || 0,
                    JSON.stringify(proRated || { proRatedFee: 0 }),
                    is_continuous || false,
                    previous_season_id || null,
                    discountType,
                    discountAmount || 0,
                    discount_reason || null,
                    parsedTimeSlots ? JSON.stringify(parsedTimeSlots) : null
                ]
            );
            enrollmentId = result.insertId;
        }

        await pool.execute(
            `UPDATE students SET is_season_registered = true, current_season_id = ? WHERE id = ?`,
            [seasonId, student_id]
        );

        let actualDueDate;
        if (season.payment_due_date) {
            // 시즌 설정에 납부 마감일이 있으면 등록일 무관 항상 그 날짜 (미납자 판정 기준)
            actualDueDate = new Date(season.payment_due_date);
        } else {
            const dueDate = new Date(regDate);
            dueDate.setDate(dueDate.getDate() + 7);
            if (regDate > seasonStartDate) {
                actualDueDate = dueDate;
            } else {
                actualDueDate = dueDate < seasonStartDate ? dueDate : seasonStartDate;
            }
        }

        let seasonFeeDescription = `${season.season_name} 시즌비`;
        if (midSeasonProRated && midSeasonProRated.isProRated) {
            seasonFeeDescription += ` (중간합류 일할: ${midSeasonProRated.details})`;
        }

        await insertSeasonPayment({
            studentId: student_id,
            academyId: req.user.academyId,
            yearMonth,
            seasonId,
            baseAmount: parseFloat(season_fee) || 0,
            additionalAmount: discountAmount + (midSeasonProRated?.discount || 0),
            finalAmount: finalSeasonFee || 0,
            dueDate: actualDueDate.toISOString().split('T')[0],
            description: seasonFeeDescription,
            recordedBy: req.user.userId
        });

        await deleteUnpaidMonthlyPaymentsForSeason(student_id, req.user.academyId, season);

        let removeResult = null;
        let seasonAssignResult = null;

        if (season.status === 'active') {
            try {
                removeResult = await removeStudentFromRegularSchedules(
                    student_id,
                    req.user.academyId,
                    season.season_start_date,
                    season.season_end_date
                );
            } catch (removeError) {
                logger.error('Remove from regular schedules failed:', removeError);
            }

            try {
                const studentGrade = student.grade || '';
                const regDateStr = registration_date || new Date().toISOString().split('T')[0];
                seasonAssignResult = await autoAssignStudentToSeasonSchedules(
                    student_id,
                    req.user.academyId,
                    season,
                    studentGrade,
                    student.student_type,
                    parsedTimeSlots,
                    regDateStr
                );
            } catch (assignError) {
                logger.error('Season auto-assign failed:', assignError);
            }
        } else {
            logger.info(`Season ${seasonId} is not active (status: ${season.status}), skipping auto-assignment`);
        }

        const [enrollment] = await pool.execute(
            `SELECT
                ss.*,
                s.name as student_name,
                se.season_name,
                se.season_type
            FROM student_seasons ss
            JOIN students s ON ss.student_id = s.id
            JOIN seasons se ON ss.season_id = se.id
            WHERE ss.id = ?`,
            [enrollmentId]
        );

        if (enrollment[0]) {
            enrollment[0].student_name = decrypt(enrollment[0].student_name);
        }

        res.status(201).json({
            message: 'Student enrolled in season successfully',
            enrollment: enrollment[0],
            proRatedCalculation: proRated,
            midSeasonProRated: midSeasonProRated,
            schedule_assignment: {
                removed_from_regular: removeResult,
                assigned_to_season: seasonAssignResult
            }
        });
    } catch (error) {
        logger.error('Error enrolling student:', error);
        logger.error('Request body:', req.body);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 학생 등록에 실패했습니다.'
        });
    }
});

};
