/**
 * PWA 푸시 알림 스케줄러
 * 매일 아침 7시에 오늘 출석 예정 미납자를 조회하여 관리자에게 푸시 알림 발송
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
 * 오늘 출석 예정 미납자 조회 및 푸시 알림 발송
 */
async function sendUnpaidAttendancePush() {
    const today = new Date();
    const dayOfWeek = today.getDay(); // 0=일, 1=월, ..., 6=토
    const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
    const todayName = dayNames[dayOfWeek];

    const currentYear = today.getFullYear();
    const currentMonth = today.getMonth() + 1;
    const todayStr = today.toISOString().split('T')[0];

    console.log(`[PushScheduler] 미납자 출석 알림 체크 시작: ${todayStr} (${todayName})`);

    try {
        // 각 학원별로 오늘 출석 예정인 미납 학생 조회
        const [unpaidStudents] = await db.query(
            `SELECT
                s.id AS student_id,
                s.name AS student_name,
                s.academy_id,
                a.name AS academy_name,
                p.amount,
                sch.time_slot
            FROM schedules sch
            JOIN students s ON sch.student_id = s.id
            JOIN academies a ON s.academy_id = a.id
            JOIN student_payments p ON p.student_id = s.id
                AND p.year = ? AND p.month = ?
            WHERE sch.${todayName} = TRUE
                AND sch.is_active = TRUE
                AND s.status = 'active'
                AND s.deleted_at IS NULL
                AND p.payment_status IN ('pending', 'partial')
            ORDER BY s.academy_id, s.name`,
            [currentYear, currentMonth]
        );

        if (unpaidStudents.length === 0) {
            console.log(`[PushScheduler] 오늘 출석 예정 미납자 없음`);
            return;
        }

        console.log(`[PushScheduler] 오늘 출석 예정 미납자 ${unpaidStudents.length}명 발견`);

        // 학원별로 그룹화
        const academyGroups = {};
        for (const student of unpaidStudents) {
            const academyId = student.academy_id;
            if (!academyGroups[academyId]) {
                academyGroups[academyId] = {
                    academyName: student.academy_name,
                    students: []
                };
            }
            // 암호화된 이름 복호화
            let studentName = student.student_name;
            try {
                studentName = decrypt(student.student_name);
            } catch {
                // 복호화 실패 시 원본 사용
            }
            academyGroups[academyId].students.push({
                name: studentName,
                amount: student.amount
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

        console.log(`[PushScheduler] 푸시 알림 발송 완료`);
    } catch (error) {
        console.error('[PushScheduler] 스케줄러 오류:', error);
    }
}

/**
 * 학원 관리자에게 푸시 알림 발송
 */
async function sendPushToAcademyAdmins(academyId, academyName, students) {
    try {
        // unpaid_attendance 알림을 활성화한 관리자의 구독만 조회
        const [subscriptions] = await db.query(
            `SELECT ps.*
             FROM push_subscriptions ps
             JOIN users u ON ps.user_id = u.id
             LEFT JOIN user_notification_settings ns ON u.id = ns.user_id
             WHERE u.academy_id = ?
               AND u.role = 'owner'
               AND (ns.unpaid_attendance IS NULL OR ns.unpaid_attendance = TRUE)`,
            [academyId]
        );

        if (subscriptions.length === 0) {
            console.log(`[PushScheduler] 학원 ${academyId}: 등록된 푸시 구독 없음`);
            return;
        }

        // 알림 내용 구성
        const studentNames = students.slice(0, 3).map(s => s.name).join(', ');
        const moreCount = students.length > 3 ? ` 외 ${students.length - 3}명` : '';
        const totalAmount = students.reduce((sum, s) => sum + s.amount, 0);

        const payload = JSON.stringify({
            title: '오늘 출석 미납자 알림',
            body: `${studentNames}${moreCount} (총 ${totalAmount.toLocaleString()}원)`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'unpaid_attendance',
                url: '/m/unpaid',
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
                console.error(`[PushScheduler] 푸시 발송 실패:`, error.message);

                // 만료된 구독 삭제
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                    console.log(`[PushScheduler] 만료된 구독 삭제: ${sub.id}`);
                }
            }
        }

        console.log(`[PushScheduler] 학원 ${academyId} (${academyName}): 푸시 발송 완료 (성공: ${successCount}, 실패: ${failCount})`);
    } catch (error) {
        console.error(`[PushScheduler] 학원 ${academyId} 푸시 발송 오류:`, error);
    }
}

/**
 * 스케줄러 초기화
 * 매일 오후 6시, 9시 (한국 시간)에 실행
 */
function initPushScheduler() {
    // 오후 6시 실행
    cron.schedule('0 18 * * *', async () => {
        console.log('[PushScheduler] 오후 6시 정기 실행');
        await sendUnpaidAttendancePush();
    }, {
        timezone: 'Asia/Seoul'
    });

    // 오후 9시 실행
    cron.schedule('0 21 * * *', async () => {
        console.log('[PushScheduler] 오후 9시 정기 실행');
        await sendUnpaidAttendancePush();
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[PushScheduler] 스케줄러 초기화 완료 (매일 18:00, 21:00 KST)');
}

module.exports = {
    initPushScheduler,
    sendUnpaidAttendancePush
};
