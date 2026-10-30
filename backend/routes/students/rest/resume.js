const { omitStudentParentNames } = require('../../../services/studentParentNameService');
const pool = require('../../../config/database');
const { verifyToken, checkPermission } = require('../../../middleware/auth');
const logger = require('../../../utils/logger');
const {
    getKoreaDateText,
} = require('../../../utils/proratedPaymentDueDate');
const {
    RestCreditRecalculationConflictError,
    RestCreditRecalculationValidationError,
    recalculateRestCreditsOnResume,
} = require('../../../services/restCreditRecalculationService');
const { autoAssignStudentToSchedules } = require('../_utils');
const {
    autoAssignStudentToSeasonSchedules,
    findResumeSeasonEnrollment,
    removeStudentFromRegularSchedules,
} = require('../../seasons/_utils');
const { processResumePayment, normalizeResumeClassDays } = require('../../../services/resumePaymentService');

module.exports = function registerResumeRoute(router) {
// State, credit, billing and attendance must either all commit or all roll back.
router.post('/:id/resume', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { resume_date } = req.body;

    const resumeDateStr = resume_date || getKoreaDateText();
    let connection = null;
    let transactionActive = false;
    let student;
    let creditRecalculation = null;
    let reassignResult = null;
    let paymentCreated = null;
    let paymentAdjusted = null;
    let updatedStudent;

    try {
        connection = await pool.getConnection();
        await connection.beginTransaction();
        transactionActive = true;

        // 복귀 상태와 크레딧을 함께 잠가 중복 복귀·중복 재계산을 막는다.
        const [students] = await connection.execute(
            `SELECT s.id, s.academy_id, s.name, s.status, s.class_days,
                    s.monthly_tuition, s.discount_rate, s.rest_start_date, s.rest_end_date, s.time_slot,
                    s.grade, s.student_type,
                    COALESCE(s.payment_due_day, ast.tuition_due_day, 5) as due_day
             FROM students s
             LEFT JOIN academy_settings ast ON s.academy_id = ast.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL
             FOR UPDATE`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            transactionActive = false;
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        student = students[0];

        if (student.status !== 'paused') {
            await connection.rollback();
            transactionActive = false;
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '휴식 상태인 학생만 복귀할 수 있습니다.'
            });
        }

        creditRecalculation = await recalculateRestCreditsOnResume({
            connection,
            student,
            resumeDate: resumeDateStr,
        });

        const classDays = normalizeResumeClassDays(student.class_days);
        ({ paymentCreated = null, paymentAdjusted = null } = await processResumePayment({
            connection, student, resumeDate: resumeDateStr, classDays,
            creditRecalculation, recordedBy: req.user.userId,
        }));
        if (classDays.length > 0) {
            reassignResult = await autoAssignStudentToSchedules(
                connection, studentId, req.user.academyId, classDays,
                resumeDateStr, student.time_slot || 'evening', { includeFutureMonth: true }
            );
        }

        // 진행 중인 시즌 등록생은 시즌 기간을 정규 대신 시즌 스케줄로 채운다 (시즌 등록 시와 같은 순서).
        const seasonEnrollment = await findResumeSeasonEnrollment(
            connection, studentId, req.user.academyId, resumeDateStr
        );
        if (seasonEnrollment) {
            const { season, timeSlots } = seasonEnrollment;
            const removeFrom = resumeDateStr > season.season_start_date ? resumeDateStr : season.season_start_date;
            await removeStudentFromRegularSchedules(
                studentId, req.user.academyId, removeFrom, season.season_end_date, connection
            );
            reassignResult = await autoAssignStudentToSeasonSchedules(
                studentId, req.user.academyId, season, student.grade || '', student.student_type,
                timeSlots, resumeDateStr, connection
            );
        }

        // 상태를 active로 변경하고 휴식 정보 초기화
        await connection.execute(
            `UPDATE students SET
                status = 'active',
                rest_start_date = NULL,
                rest_end_date = NULL,
                rest_reason = NULL,
                updated_at = NOW()
             WHERE id = ? AND academy_id = ?`,
            [studentId, req.user.academyId]
        );

        const [updatedStudents] = await connection.execute(
            'SELECT * FROM students WHERE id = ? AND academy_id = ?',
            [studentId, req.user.academyId]
        );
        updatedStudent = updatedStudents[0];
        await connection.commit();
        transactionActive = false;
    } catch (error) {
        if (transactionActive && connection) {
            try {
                await connection.rollback();
            } catch (rollbackError) {
                logger.error('Error rolling back resume transaction:', rollbackError);
            }
        }

        if (error instanceof RestCreditRecalculationConflictError) {
            return res.status(409).json({
                error: 'REST_CREDIT_RECALCULATION_CONFLICT',
                message: error.message,
            });
        }
        if (error instanceof RestCreditRecalculationValidationError) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: error.message,
            });
        }

        logger.error('Error resuming student:', error);
        return res.status(500).json({
            error: 'RESUME_FAILED',
            message: '복귀 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    } finally {
        if (connection) connection.release();
    }

    const messageParts = [`${resumeDateStr} 복귀 처리가 완료되었습니다.`];
    if (creditRecalculation?.adjusted) {
        messageParts.push(
            `휴식 크레딧이 ${creditRecalculation.previousAmount.toLocaleString()}원에서 `
            + `${creditRecalculation.creditAmount.toLocaleString()}원으로 재계산되었습니다.`
        );
    }
    if (paymentCreated) {
        messageParts.push(
            `${paymentCreated.yearMonth} 학원비 `
            + `${paymentCreated.finalAmount.toLocaleString()}원이 생성되었습니다.`
        );
    }

    if (paymentAdjusted) {
        messageParts.push(`${paymentAdjusted.yearMonth} 학원비가 ${paymentAdjusted.finalAmount.toLocaleString()}원으로 조정되었습니다.`);
    }

    res.json({
        message: messageParts.join(' '),
        student: omitStudentParentNames(updatedStudent),
        scheduleAssigned: reassignResult,
        paymentCreated,
        paymentAdjusted,
        creditRecalculation,
        resumeDate: resumeDateStr
    });
});
};
