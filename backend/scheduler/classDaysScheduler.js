/**
 * 수업일 변경 예정 자동 반영 스케줄러
 * 매일 00:05에 실행되어 변경 예정일이 된 학생들의 수업일을 자동 반영
 */

const cron = require('node-cron');
const db = require('../config/database');
const logger = require('../utils/logger');

// ===== 요일별 시간대 유틸리티 (하위호환) =====
function parseClassDaysWithSlots(classDays, defaultTimeSlot = 'evening') {
    if (!classDays) return [];
    let arr;
    if (typeof classDays === 'string') {
        try { arr = JSON.parse(classDays); } catch { return []; }
    } else {
        arr = classDays;
    }
    if (!Array.isArray(arr)) return [];
    return arr.map(item => {
        if (typeof item === 'number') return { day: item, timeSlot: defaultTimeSlot };
        return { day: item.day, timeSlot: item.timeSlot || defaultTimeSlot };
    });
}

/**
 * 수업일 변경 예정 반영
 */
async function applyScheduledClassDaysChanges() {
    const now = new Date();
    const koreaDate = now.toLocaleDateString('en-CA', { timeZone: 'Asia/Seoul' }); // YYYY-MM-DD

    try {
        // 변경 예정일이 오늘 이전인 학생들 조회
        const [studentsToUpdate] = await db.query(
            `SELECT id, name, class_days, class_days_next, class_days_effective_from, student_type, time_slot
             FROM students
             WHERE class_days_next IS NOT NULL
               AND class_days_effective_from IS NOT NULL
               AND class_days_effective_from <= ?
               AND deleted_at IS NULL`,
            [koreaDate]
        );

        if (studentsToUpdate.length === 0) {
            return { updated: 0, students: [] };
        }

        logger.info(`[ClassDaysScheduler] ${studentsToUpdate.length}명의 수업일 변경 예정 반영 시작`);

        const updatedStudents = [];

        for (const student of studentsToUpdate) {
            try {
                const newClassDays = parseClassDaysWithSlots(
                    student.class_days_next,
                    student.time_slot || 'evening'
                );
                const newWeeklyCount = newClassDays.length;

                // 학원비 자동 계산
                let newTuition = null;
                if (newWeeklyCount > 0) {
                    const [settings] = await db.query(
                        'SELECT settings FROM academy_settings WHERE academy_id = (SELECT academy_id FROM students WHERE id = ?)',
                        [student.id]
                    );
                    if (settings.length > 0 && settings[0].settings) {
                        const parsed = typeof settings[0].settings === 'string'
                            ? JSON.parse(settings[0].settings)
                            : settings[0].settings;
                        const studentType = student.student_type || 'exam';
                        const tuitionTable = studentType === 'adult' ? parsed.adult_tuition : parsed.exam_tuition;
                        if (tuitionTable) {
                            newTuition = tuitionTable[`weekly_${newWeeklyCount}`] || null;
                        }
                    }
                }

                // 수업일 변경 적용
                await db.query(
                    `UPDATE students
                     SET class_days = ?,
                         weekly_count = ?,
                         ${newTuition !== null ? 'monthly_tuition = ?,' : ''}
                         class_days_next = NULL,
                         class_days_effective_from = NULL,
                         updated_at = NOW()
                     WHERE id = ?`,
                    newTuition !== null
                        ? [JSON.stringify(newClassDays), newWeeklyCount, newTuition, student.id]
                        : [JSON.stringify(newClassDays), newWeeklyCount, student.id]
                );

                updatedStudents.push({
                    id: student.id,
                    oldClassDays: student.class_days,
                    newClassDays: newClassDays,
                    newWeeklyCount,
                    newTuition
                });

                logger.info(`[ClassDaysScheduler] 학생 ${student.id}: 수업일 변경 완료 (주${newWeeklyCount}회, ${newTuition ? newTuition.toLocaleString() + '원' : '학원비 유지'})`);
            } catch (err) {
                logger.error(`[ClassDaysScheduler] 학생 ${student.id} 수업일 변경 실패:`, err);
            }
        }

        logger.info(`[ClassDaysScheduler] 완료: ${updatedStudents.length}명 수업일 변경 반영`);

        return { updated: updatedStudents.length, students: updatedStudents };
    } catch (error) {
        logger.error('[ClassDaysScheduler] 오류:', error);
        return { updated: 0, error: error.message };
    }
}

/**
 * 스케줄러 시작
 * 매일 00:05 (KST) 실행
 */
function startClassDaysScheduler() {
    // 매일 00:05 실행 (한국 시간 기준)
    cron.schedule('5 0 * * *', async () => {
        logger.info('[ClassDaysScheduler] 수업일 변경 예정 자동 반영 시작');
        const result = await applyScheduledClassDaysChanges();
        logger.info(`[ClassDaysScheduler] 결과: ${result.updated}명 반영`);
    }, {
        timezone: 'Asia/Seoul'
    });

    logger.info('[ClassDaysScheduler] 스케줄러 시작됨 (매일 00:05 KST)');
}

module.exports = {
    startClassDaysScheduler,
    applyScheduledClassDaysChanges
};
