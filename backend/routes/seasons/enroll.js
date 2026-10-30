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
 *   5. season.status='active' 이고 학생이 휴원(paused)이 아닐 때만 (휴원생은 복귀 시 배정):
 *      a. removeStudentFromRegularSchedules (정규 스케줄 attendance 삭제)
 *      b. autoAssignStudentToSeasonSchedules (시즌 스케줄 attendance 자동 배정)
 *      → 둘 다 try/catch 로 격리 (실패해도 enrollment 는 성공 유지).
 *
 * 계산(일할·연속할인·수동할인·납부 마감일)과 1~5 반영은 services/seasonEnrollmentService —
 *   AI 연결(MCP season_enroll)이 같은 코드를 쓴다. 라우터는 조회·중복 검사·응답만.
 */

const { pool, decrypt, logger } = require('./_utils');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const {
    parseSeasonTimeSlots,
    planSeasonEnrollment,
    applySeasonEnrollment
} = require('../../services/seasonEnrollmentService');

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
        if (student.status === 'prospect') {
            return res.status(400).json({ error: 'Validation Error', message: '예비생은 재원으로 전환한 뒤 시즌에 등록할 수 있습니다.' });
        }

        const [existing] = await pool.execute(
            `SELECT id FROM student_seasons
            WHERE student_id = ? AND season_id = ? AND payment_status != 'cancelled'`,
            [student_id, seasonId]
        );

        const existingEnrollment = existing[0] || null;

        const plan = planSeasonEnrollment({
            season,
            student,
            seasonFee: season_fee,
            registrationDate: registration_date,
            isContinuous: is_continuous,
            previousSeasonId: previous_season_id,
            manualDiscount
        });

        const parsedTimeSlots = parseSeasonTimeSlots(time_slots);
        if (parsedTimeSlots === false) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Invalid time_slots. Must be array of: morning, afternoon, evening'
            });
        }

        const [existingSeasonPayment] = await pool.execute(
            `SELECT id FROM student_payments
             WHERE student_id = ? AND academy_id = ?
             AND \`year_month\` = ? AND payment_type = 'season'`,
            [student_id, req.user.academyId, plan.yearMonth]
        );

        if (existingSeasonPayment.length > 0) {
            return res.status(existingEnrollment ? 400 : 409).json({
                error: existingEnrollment ? 'Validation Error' : 'Duplicate Payment',
                message: existingEnrollment
                    ? 'Student already enrolled in this season'
                    : `${plan.yearMonth} 시즌비 납부건이 이미 존재합니다.`
            });
        }

        const { enrollmentId, removeResult, seasonAssignResult } = await applySeasonEnrollment(pool, {
            season,
            seasonId,
            student,
            studentId: student_id,
            academyId: req.user.academyId,
            userId: req.user.userId,
            existingEnrollmentId: existingEnrollment?.id,
            plan,
            input: {
                registrationDate: registration_date,
                afterSeasonAction: after_season_action,
                isContinuous: is_continuous,
                previousSeasonId: previous_season_id,
                discountReason: discount_reason,
                timeSlots: parsedTimeSlots
            }
        });

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
            proRatedCalculation: plan.proRated,
            midSeasonProRated: plan.midSeasonProRated,
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
