/**
 * 체험생 만료 스케줄러
 * 마지막 체험수업 일정 + 2일이 지나면 미등록관리(pending)로 자동 전환
 */

const cron = require('node-cron');
const db = require('../config/database');
const { decrypt } = require('../utils/encryption');

/**
 * 만료된 체험생을 미등록관리로 전환
 */
async function expireTrialStudents() {
    const today = new Date();
    const koreaTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = koreaTime.toISOString().split('T')[0];

    console.log(`[TrialExpireScheduler] 체험생 만료 체크: ${todayStr}`);

    try {
        // 체험생(trial) 중 trial_dates가 있는 학생 조회
        const [trialStudents] = await db.query(
            `SELECT id, name, trial_dates, academy_id
             FROM students
             WHERE status = 'trial'
               AND is_trial = 1
               AND trial_dates IS NOT NULL
               AND deleted_at IS NULL`
        );

        if (trialStudents.length === 0) {
            console.log(`[TrialExpireScheduler] 체험생 없음`);
            return;
        }

        console.log(`[TrialExpireScheduler] 체험생 ${trialStudents.length}명 확인 중...`);

        let expiredCount = 0;

        for (const student of trialStudents) {
            try {
                // trial_dates 파싱
                let trialDates = [];
                if (typeof student.trial_dates === 'string') {
                    trialDates = JSON.parse(student.trial_dates);
                } else if (Array.isArray(student.trial_dates)) {
                    trialDates = student.trial_dates;
                }

                if (trialDates.length === 0) {
                    continue;
                }

                // 마지막 체험일 찾기
                const lastTrialDate = trialDates
                    .map(t => t.date)
                    .sort()
                    .pop();

                if (!lastTrialDate) {
                    continue;
                }

                // 마지막 체험일 + 1일 계산
                const lastDate = new Date(lastTrialDate);
                lastDate.setDate(lastDate.getDate() + 1);
                const expireDate = lastDate.toISOString().split('T')[0];

                // 오늘이 만료일 이후인지 확인
                if (todayStr >= expireDate) {
                    // 미등록관리로 전환
                    await db.query(
                        `UPDATE students
                         SET status = 'pending',
                             is_trial = 0,
                             memo = CONCAT(IFNULL(memo, ''), '\n[', ?, '] 체험 만료 → 미등록관리 자동전환')
                         WHERE id = ?`,
                        [todayStr, student.id]
                    );

                    let studentName = student.name;
                    try {
                        studentName = decrypt(student.name);
                    } catch { /* 복호화 실패 시 원본 사용 */ }

                    console.log(`[TrialExpireScheduler] 체험 만료: ${studentName} (마지막 체험일: ${lastTrialDate})`);
                    expiredCount++;
                }
            } catch (parseError) {
                console.error(`[TrialExpireScheduler] 학생 ${student.id} 처리 오류:`, parseError);
            }
        }

        console.log(`[TrialExpireScheduler] 완료 - 만료 전환: ${expiredCount}명`);
    } catch (error) {
        console.error('[TrialExpireScheduler] 스케줄러 오류:', error);
    }
}

/**
 * 스케줄러 초기화
 * 매일 오전 0시 5분 (한국 시간)에 실행
 */
function initTrialExpireScheduler() {
    cron.schedule('5 0 * * *', async () => {
        console.log('[TrialExpireScheduler] 자정 정기 실행');
        await expireTrialStudents();
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[TrialExpireScheduler] 스케줄러 초기화 완료 (매일 00:05 KST)');
}

module.exports = {
    initTrialExpireScheduler,
    expireTrialStudents
};
