/**
 * 학년 자동 진급 스케줄러
 * 매년 1월 1일에 실행되어 학생 학년을 자동으로 진급 처리
 *
 * 진급 규칙 (높은 학년부터 일괄 처리):
 * - 고3 → N수
 * - 고2 → 고3
 * - 고1 → 고2
 * - 중3 → 고1
 * - 중2 → 중3
 * - 중1 → 중2
 * - N수 → N수 (유지)
 */

const cron = require('node-cron');
const db = require('../config/database');
const {
    GRADE_PROMOTION_ORDER,
    getAdmissionTypeAfterGradeChange,
} = require('../services/studentGradePromotionService');

/**
 * 학년 진급 처리 로직
 * @param {boolean} isDryRun - true면 실제 DB 변경 없이 미리보기만
 */
async function promoteStudentGrades(isDryRun = false) {
    const today = new Date();
    console.log(`[GradePromotionScheduler] Starting grade promotion... (${today.toISOString()})`);

    try {
        let totalPromoted = 0;
        const promotionLog = [];

        // 높은 학년부터 일괄 UPDATE (중복 진급 방지)
        for (const { from, to } of GRADE_PROMOTION_ORDER) {
            // 먼저 대상 인원 조회
            const [targets] = await db.query(
                `SELECT COUNT(*) as cnt FROM students WHERE deleted_at IS NULL AND grade = ?`,
                [from]
            );
            const count = targets[0].cnt;

            if (count === 0) continue;

            if (!isDryRun) {
                const finishesAdvanceClass = getAdmissionTypeAfterGradeChange({
                    fromGrade: from,
                    toGrade: to,
                    admissionType: 'advance',
                }) === 'regular';
                const admissionTypeUpdate = finishesAdvanceClass
                    ? "admission_type = CASE WHEN admission_type = 'advance' THEN 'regular' ELSE admission_type END,"
                    : '';
                await db.query(
                    `UPDATE students
                     SET grade = ?, ${admissionTypeUpdate} updated_at = NOW()
                     WHERE deleted_at IS NULL AND grade = ?`,
                    [to, from]
                );

                // 연결된 상담의 student_grade도 동기화
                await db.query(
                    `UPDATE consultations c
                     INNER JOIN students s ON c.linked_student_id = s.id
                     SET c.student_grade = ?
                     WHERE s.deleted_at IS NULL AND c.student_grade = ? AND c.linked_student_id IS NOT NULL`,
                    [to, from]
                );
            }

            promotionLog.push({ from, to, count });
            totalPromoted += count;
            console.log(`  ${from} → ${to}: ${count}명`);
        }

        console.log(`[GradePromotionScheduler] Completed - Total promoted: ${totalPromoted}명`);

        return {
            promoted: totalPromoted,
            details: promotionLog
        };

    } catch (error) {
        console.error('[GradePromotionScheduler] Error:', error);
        throw error;
    }
}

/**
 * 고3 학생 졸업 처리
 * 고3 중 졸업시킬 학생의 status를 'graduated'로 변경
 * @param {number[]} studentIds - 졸업 처리할 학생 ID 배열
 */
async function graduateStudents(studentIds) {
    if (!studentIds || studentIds.length === 0) {
        return { graduated: 0 };
    }

    try {
        const [result] = await db.query(
            `UPDATE students
             SET status = 'graduated', updated_at = NOW()
             WHERE id IN (?) AND grade = '고3' AND status = 'active'`,
            [studentIds]
        );

        console.log(`[GradePromotionScheduler] Graduated ${result.affectedRows} students`);

        return { graduated: result.affectedRows };
    } catch (error) {
        console.error('[GradePromotionScheduler] Graduation error:', error);
        throw error;
    }
}

/**
 * 스케줄러 초기화
 * 매년 1월 1일 오전 1시에 실행 (한국 시간)
 */
function initGradePromotionScheduler() {
    // 매년 1월 1일 01:00에 실행 (0 1 1 1 *)
    cron.schedule('0 1 1 1 *', async () => {
        console.log('[GradePromotionScheduler] Annual grade promotion starting...');
        await promoteStudentGrades(false);
    }, {
        scheduled: true,
        timezone: 'Asia/Seoul'
    });

    console.log('🎓 학년 자동 진급 스케줄러 초기화 완료 (매년 1월 1일 01:00 실행)');
}

module.exports = {
    initGradePromotionScheduler,
    promoteStudentGrades,
    graduateStudents
};
