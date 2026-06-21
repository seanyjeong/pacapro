/**
 * Excused Credit Scheduler
 * 공결 크레딧 자동 정산 스케줄러
 *
 * 매월 말일 23:00에 실행
 * - 5주차 보너스로 공결 상쇄
 * - 보충 수업으로 공결 상쇄
 * - 남은 공결에 대해 크레딧 생성 → 다음달 학원비에서 차감
 */

const cron = require('node-cron');
const db = require('../config/database');
const { truncateToThousands, getFifthWeekClassCount, parseWeeklyDays } = require('../utils/seasonCalculator');

/**
 * 공결 크레딧 정산 로직
 * 매월 말일에 실행되어 모든 active 학생의 공결을 정산
 */
async function processExcusedCredits() {
    console.log('[ExcusedCreditScheduler] Starting excused credit processing...');

    const today = new Date();
    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const yearMonth = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;

    // 해당 월의 시작일과 종료일
    const monthStart = `${yearMonth}-01`;
    const monthEnd = new Date(currentYear, currentMonth, 0).toISOString().split('T')[0];

    try {
        // 모든 학원 조회
        const [academies] = await db.query(`SELECT id as academy_id FROM academies`);

        let totalProcessed = 0;
        let totalCreditsGenerated = 0;
        let totalCreditAmount = 0;

        for (const academy of academies) {
            // 해당 학원의 재원생 조회 (월중 등록 제외)
            // - status = 'active'
            // - 월 1일 이전 등록
            // - 월수강료 > 0 (체험생 제외)
            const [students] = await db.query(`
                SELECT
                    s.id,
                    s.name,
                    s.monthly_tuition,
                    s.class_days
                FROM students s
                WHERE s.academy_id = ?
                AND s.status = 'active'
                AND s.deleted_at IS NULL
                AND s.monthly_tuition > 0
                AND s.class_days IS NOT NULL
                AND s.class_days != '[]'
                AND DATE(s.created_at) < ?
            `, [academy.academy_id, monthStart]);

            for (const student of students) {
                try {
                    const result = await processStudentExcused(student, academy.academy_id, currentYear, currentMonth, monthStart, monthEnd);
                    if (result) {
                        totalProcessed++;
                        if (result.creditGenerated) {
                            totalCreditsGenerated++;
                            totalCreditAmount += result.creditAmount;
                        }
                    }
                } catch (err) {
                    console.error(`[ExcusedCreditScheduler] Error processing student ${student.id}:`, err);
                }
            }
        }

        console.log(`[ExcusedCreditScheduler] Completed. Processed ${totalProcessed} students, generated ${totalCreditsGenerated} credits (${totalCreditAmount.toLocaleString()}원)`);
        return { totalProcessed, totalCreditsGenerated, totalCreditAmount };

    } catch (error) {
        console.error('[ExcusedCreditScheduler] Error:', error);
        throw error;
    }
}

/**
 * 개별 학생 공결 정산
 */
async function processStudentExcused(student, academyId, year, month, monthStart, monthEnd) {
    const classDays = parseWeeklyDays(student.class_days);
    if (!classDays || classDays.length === 0) {
        return null;
    }

    // 1. 해당 월 공결 횟수 조회
    const [excusedRecords] = await db.query(`
        SELECT COUNT(*) as excused_count
        FROM attendance a
        JOIN class_schedules cs ON a.class_schedule_id = cs.id
        WHERE a.student_id = ?
        AND a.attendance_status = 'excused'
        AND cs.schedule_date BETWEEN ? AND ?
    `, [student.id, monthStart, monthEnd]);

    const excusedCount = excusedRecords[0]?.excused_count || 0;

    // 공결 0회면 패스
    if (excusedCount === 0) {
        return { creditGenerated: false, creditAmount: 0 };
    }

    // 2. 5주차 보너스 계산
    const fifthWeekBonus = getFifthWeekClassCount(year, month, classDays);

    // 3. 보충 수업 횟수 조회 (정규 수업일 외 추가 출석)
    // 해당 월 총 출석 횟수 - 정규 수업일 출석 = 보충
    const [attendanceRecords] = await db.query(`
        SELECT
            COUNT(CASE WHEN a.attendance_status IN ('present', 'late') THEN 1 END) as total_attendance,
            COUNT(*) as total_records
        FROM attendance a
        JOIN class_schedules cs ON a.class_schedule_id = cs.id
        WHERE a.student_id = ?
        AND cs.schedule_date BETWEEN ? AND ?
    `, [student.id, monthStart, monthEnd]);

    const totalAttendance = attendanceRecords[0]?.total_attendance || 0;
    const expectedClasses = classDays.length * 4;

    // 보충 횟수 = is_makeup = 1 인 출석 기록 카운트
    const [makeupRecords] = await db.query(`
        SELECT COUNT(*) as makeup_count
        FROM attendance a
        JOIN class_schedules cs ON a.class_schedule_id = cs.id
        WHERE a.student_id = ?
        AND cs.schedule_date BETWEEN ? AND ?
        AND (
            a.is_makeup = 1
            OR a.notes LIKE '%보충%'
        )
        AND a.attendance_status IN ('present', 'late')
    `, [student.id, monthStart, monthEnd]);

    const makeupCount = makeupRecords[0]?.makeup_count || 0;

    // 4. 상쇄 계산
    const offsetTotal = fifthWeekBonus + makeupCount;
    const remainingExcused = Math.max(0, excusedCount - offsetTotal);

    // 남은 공결 없으면 크레딧 생성 안함
    if (remainingExcused === 0) {
        console.log(`[ExcusedCreditScheduler] Student ${student.id} (${student.name}): ${excusedCount} excused, offset ${offsetTotal} (5th week: ${fifthWeekBonus}, makeup: ${makeupCount}) - No credit needed`);
        return { creditGenerated: false, creditAmount: 0 };
    }

    // 5. 크레딧 금액 계산
    const monthlyTuition = parseFloat(student.monthly_tuition);
    const perClassFee = monthlyTuition / expectedClasses;
    const creditAmount = truncateToThousands(perClassFee * remainingExcused);

    if (creditAmount <= 0) {
        return { creditGenerated: false, creditAmount: 0 };
    }

    // 6. 기존 동일 월 공결 크레딧 확인 (중복 방지)
    const [existingCredit] = await db.query(`
        SELECT id FROM rest_credits
        WHERE student_id = ?
        AND academy_id = ?
        AND credit_type = 'excused'
        AND notes LIKE ?
    `, [student.id, academyId, `%${year}년 ${month}월%`]);

    if (existingCredit.length > 0) {
        console.log(`[ExcusedCreditScheduler] Student ${student.id} (${student.name}): Credit already exists for ${year}년 ${month}월`);
        return { creditGenerated: false, creditAmount: 0 };
    }

    // 7. rest_credits 테이블에 크레딧 생성
    await db.query(`
        INSERT INTO rest_credits (
            student_id,
            academy_id,
            source_payment_id,
            rest_start_date,
            rest_end_date,
            rest_days,
            credit_amount,
            remaining_amount,
            credit_type,
            status,
            notes,
            created_at
        ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'excused', 'pending', ?, NOW())
    `, [
        student.id,
        academyId,
        monthStart,
        monthEnd,
        remainingExcused,
        creditAmount,
        creditAmount,
        `${year}년 ${month}월 공결 ${remainingExcused}회 크레딧 (5주차 보너스: ${fifthWeekBonus}, 보충: ${makeupCount})`
    ]);

    console.log(`[ExcusedCreditScheduler] Student ${student.id} (${student.name}): Generated ${creditAmount.toLocaleString()}원 credit (${remainingExcused} excused after offset)`);

    return { creditGenerated: true, creditAmount };
}

/**
 * 스케줄러 초기화
 * 매월 말일 23:00에 실행
 */
function initScheduler() {
    // 매월 말일 23:00에 실행
    // 크론 표현식으로 "말일"을 직접 지정할 수 없어서
    // 매일 23:00에 실행하고 내부에서 말일 체크
    cron.schedule('0 23 * * *', async () => {
        const today = new Date();
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);

        // 내일이 1일이면 오늘이 말일
        if (tomorrow.getDate() === 1) {
            console.log('[ExcusedCreditScheduler] Running scheduled task (last day of month) at', new Date().toISOString());
            try {
                await processExcusedCredits();
            } catch (error) {
                console.error('[ExcusedCreditScheduler] Scheduled task failed:', error);
            }
        }
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[ExcusedCreditScheduler] Scheduler initialized - runs at 23:00 KST on the last day of each month');
}

module.exports = {
    initScheduler,
    processExcusedCredits
};
