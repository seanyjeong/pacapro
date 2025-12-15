/**
 * 휴원 종료 알림 스케줄러
 * 매일 아침 9시에 내일/오늘 휴원 종료 예정 학생 알림
 */

const cron = require('node-cron');
const db = require('../config/database');
const webpush = require('web-push');
const { decrypt } = require('../utils/encryption');

// VAPID 설정
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

/**
 * 휴원 종료 예정 학생 조회 및 푸시 알림 발송
 */
async function sendPauseEndingPush() {
    const today = new Date();
    const koreaTime = new Date(today.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));
    const todayStr = koreaTime.toISOString().split('T')[0];

    // 내일 날짜
    const tomorrow = new Date(koreaTime);
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split('T')[0];

    console.log(`[PauseEndingScheduler] 휴원 종료 알림 체크: ${todayStr}`);

    try {
        // 오늘 또는 내일 휴원 종료 예정인 학생 조회
        const [students] = await db.query(
            `SELECT
                s.id,
                s.name,
                s.academy_id,
                s.rest_end_date,
                a.name AS academy_name
            FROM students s
            JOIN academies a ON s.academy_id = a.id
            WHERE s.status = 'paused'
                AND s.rest_end_date IN (?, ?)
                AND s.deleted_at IS NULL`,
            [todayStr, tomorrowStr]
        );

        if (students.length === 0) {
            console.log(`[PauseEndingScheduler] 휴원 종료 예정 학생 없음`);
            return;
        }

        console.log(`[PauseEndingScheduler] 휴원 종료 예정 학생 ${students.length}명 발견`);

        // 학원별로 그룹화
        const academyGroups = {};
        for (const student of students) {
            const academyId = student.academy_id;
            if (!academyGroups[academyId]) {
                academyGroups[academyId] = {
                    academyName: student.academy_name,
                    students: []
                };
            }

            // 암호화된 이름 복호화
            let studentName = student.name;
            try {
                studentName = decrypt(student.name);
            } catch { /* 복호화 실패 시 원본 사용 */ }

            const isToday = student.rest_end_date.toISOString().split('T')[0] === todayStr;

            academyGroups[academyId].students.push({
                name: studentName,
                endDate: student.rest_end_date,
                isToday
            });
        }

        // 각 학원의 관리자에게 푸시 알림 발송
        for (const academyId of Object.keys(academyGroups)) {
            const group = academyGroups[academyId];
            await sendPushToAcademyAdmins(
                parseInt(academyId),
                group.academyName,
                group.students
            );
        }

        console.log(`[PauseEndingScheduler] 푸시 알림 발송 완료`);
    } catch (error) {
        console.error('[PauseEndingScheduler] 스케줄러 오류:', error);
    }
}

/**
 * 학원 관리자에게 푸시 알림 발송
 */
async function sendPushToAcademyAdmins(academyId, academyName, students) {
    try {
        // pause_ending 알림을 활성화한 관리자의 구독만 조회
        const [subscriptions] = await db.query(
            `SELECT ps.*
             FROM push_subscriptions ps
             JOIN users u ON ps.user_id = u.id
             LEFT JOIN user_notification_settings ns ON u.id = ns.user_id
             WHERE u.academy_id = ?
               AND u.role IN ('owner', 'admin')
               AND (ns.pause_ending IS NULL OR ns.pause_ending = TRUE)`,
            [academyId]
        );

        if (subscriptions.length === 0) {
            console.log(`[PauseEndingScheduler] 학원 ${academyId}: 등록된 푸시 구독 없음`);
            return;
        }

        // 오늘 종료 / 내일 종료 분리
        const todayStudents = students.filter(s => s.isToday);
        const tomorrowStudents = students.filter(s => !s.isToday);

        let body = '';
        if (todayStudents.length > 0) {
            body += `오늘 복귀: ${todayStudents.map(s => s.name).join(', ')}`;
        }
        if (tomorrowStudents.length > 0) {
            if (body) body += ' / ';
            body += `내일 복귀: ${tomorrowStudents.map(s => s.name).join(', ')}`;
        }

        const payload = JSON.stringify({
            title: '📋 휴원 종료 알림',
            body,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'pause_ending',
                url: '/students?status=paused',
                academyId,
                count: students.length
            }
        });

        let successCount = 0;
        let failCount = 0;

        for (const sub of subscriptions) {
            const pushSubscription = {
                endpoint: sub.endpoint,
                keys: {
                    p256dh: sub.p256dh,
                    auth: sub.auth
                }
            };

            try {
                await webpush.sendNotification(pushSubscription, payload);
                successCount++;
            } catch (error) {
                failCount++;
                console.error(`[PauseEndingScheduler] 푸시 발송 실패:`, error.message);

                // 만료된 구독 삭제
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                    console.log(`[PauseEndingScheduler] 만료된 구독 삭제: ${sub.id}`);
                }
            }
        }

        console.log(`[PauseEndingScheduler] 학원 ${academyId}: 휴원 종료 알림 발송 (성공: ${successCount}, 실패: ${failCount})`);
    } catch (error) {
        console.error(`[PauseEndingScheduler] 학원 ${academyId} 푸시 발송 오류:`, error);
    }
}

/**
 * 스케줄러 초기화
 * 매일 오전 9시 (한국 시간)에 실행
 */
function initPauseEndingScheduler() {
    cron.schedule('0 9 * * *', async () => {
        console.log('[PauseEndingScheduler] 오전 9시 정기 실행');
        await sendPauseEndingPush();
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[PauseEndingScheduler] 스케줄러 초기화 완료 (매일 09:00 KST)');
}

module.exports = {
    initPauseEndingScheduler,
    sendPauseEndingPush
};
