const {
    pool,
    decrypt,
    logger,
    parseWeeklyDays,
} = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { planSeasonEnrollment } = require('../../services/seasonEnrollmentService');

module.exports = function(router) {
router.get('/:id/preview', verifyToken, checkPermission('seasons', 'edit'), async (req, res) => {
    const seasonId = parseInt(req.params.id);

    try {
        const { student_id } = req.query;

        if (!student_id) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required field: student_id'
            });
        }

        const [seasons] = await pool.execute(
            'SELECT * FROM seasons WHERE id = ? AND academy_id = ?',
            [seasonId, req.user.academyId]
        );

        if (seasons.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Season not found'
            });
        }

        const [existingEnrollment] = await pool.execute(
            `SELECT ss.id, s.season_name
             FROM student_seasons ss
             JOIN seasons s ON ss.season_id = s.id
             WHERE ss.student_id = ? AND ss.season_id = ? AND ss.is_cancelled = 0`,
            [student_id, seasonId]
        );

        if (existingEnrollment.length > 0) {
            return res.status(409).json({
                error: 'Already Enrolled',
                message: `이미 ${existingEnrollment[0].season_name}에 등록되어 있습니다.`,
                enrolled: true
            });
        }

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

        const season = seasons[0];
        const student = students[0];
        student.name = decrypt(student.name);

        const weeklyDays = parseWeeklyDays(student.class_days);
        const nonSeasonEnd = new Date(season.non_season_end_date);
        const seasonStart = new Date(season.season_start_date);

        // 등록(POST /:id/enroll)과 같은 계산 — 미리보기 금액이 실제 청구 금액이다
        const { registration_date, season_fee, discount_amount, is_continuous, previous_season_id } = req.query;
        const baseSeasonFee = season_fee !== undefined && season_fee !== ''
            ? parseFloat(season_fee) || 0
            : parseFloat(season.default_season_fee) || 0;
        const manualDiscount = parseFloat(discount_amount) > 0 ? parseFloat(discount_amount) : 0;
        const plan = planSeasonEnrollment({
            season,
            student,
            seasonFee: baseSeasonFee,
            registrationDate: registration_date,
            isContinuous: is_continuous === 'true',
            previousSeasonId: previous_season_id ? parseInt(previous_season_id) : null,
            manualDiscount
        });
        const proRated = plan.proRated;
        const midSeasonProRated = plan.midSeasonProRated;

        const gapStart = new Date(nonSeasonEnd);
        gapStart.setDate(gapStart.getDate() + 1);
        const gapEnd = new Date(seasonStart);
        gapEnd.setDate(gapEnd.getDate() - 1);
        const hasGap = gapStart <= gapEnd;

        let continuousDiscount = null;
        if (season.allows_continuous && season.continuous_discount_type !== 'none') {
            continuousDiscount = {
                type: season.continuous_discount_type,
                rate: season.continuous_discount_rate,
                description: season.continuous_discount_type === 'free'
                    ? '연속등록 시 무료'
                    : `연속등록 시 ${season.continuous_discount_rate}% 할인`
            };
        }

        const preview = {
            student: {
                id: student.id,
                name: student.name,
                student_number: student.student_number || '',
                class_days: weeklyDays,
                monthly_tuition: student.monthly_tuition,
                discount_rate: student.discount_rate || '0'
            },
            season: {
                id: season.id,
                season_name: season.season_name,
                start_date: season.season_start_date,
                end_date: season.season_end_date,
                non_season_end_date: season.non_season_end_date,
                season_fee: season.default_season_fee
            },
            prorated: {
                total_days: proRated.totalMonthlyClasses || 30,
                pro_rated_days: proRated.classCountUntilEnd || 0,
                daily_rate: proRated.perClassFee || 0,
                original_monthly: parseFloat(student.monthly_tuition) || 0,
                discount_rate: parseFloat(student.discount_rate) || 0,
                final_amount: proRated.proRatedFee || 0
            },
            mid_season_prorated: midSeasonProRated ? {
                is_mid_season: true,
                original_fee: midSeasonProRated.originalFee,
                prorated_fee: midSeasonProRated.proRatedFee,
                discount: midSeasonProRated.discount,
                total_days: midSeasonProRated.totalDays,
                remaining_days: midSeasonProRated.remainingDays,
                details: midSeasonProRated.details
            } : null,
            continuous_discount: continuousDiscount ? {
                is_continuous: true,
                discount_type: continuousDiscount.type,
                discount_rate: continuousDiscount.rate || 0,
                discount_amount: 0
            } : null,
            final_calculation: {
                season_fee: midSeasonProRated ? midSeasonProRated.proRatedFee : baseSeasonFee,
                original_season_fee: baseSeasonFee,
                mid_season_discount: midSeasonProRated ? midSeasonProRated.discount : 0,
                prorated_fee: 0,
                discount_amount: plan.discountAmount - manualDiscount,
                manual_discount: manualDiscount,
                total_due: plan.finalSeasonFee
            },
            non_season_prorated_info: proRated.proRatedFee > 0 ? {
                amount: proRated.proRatedFee,
                days: proRated.proRatedDays || 0,
                message: hasGap
                    ? '비시즌 일할은 시즌 전달 학원비에서 별도 청구됩니다.'
                    : '비시즌 추가 청구 구간이 없습니다.'
            } : null
        };

        res.json({
            message: 'Season transition preview calculated',
            preview
        });
    } catch (error) {
        logger.error('Error calculating preview:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '시즌 미리보기 계산에 실패했습니다.'
        });
    }
});
};
