/**
 * 상담 예약 30분 전 알림 스케줄러
 * 매분마다 체크하여 30분 후 상담 예정인 건에 대해 푸시 알림 발송
 */

const cron = require('node-cron');
const db = require('../config/database');
const webpush = require('web-push');
const { decrypt } = require('../utils/encryption');

// VAPID 설정 (pushScheduler와 공유)
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
    webpush.setVapidDetails(
        process.env.VAPID_EMAIL || 'mailto:admin@example.com',
        process.env.VAPID_PUBLIC_KEY,
        process.env.VAPID_PRIVATE_KEY
    );
}

/**
 * 30분 후 상담 예정 건 조회 및 푸시 알림 발송
 */
async function sendConsultationReminders() {
    const now = new Date();
    const koreaTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Seoul' }));

    // 30분 후 시간 계산
    const reminderTime = new Date(koreaTime.getTime() + 30 * 60 * 1000);
    const targetDate = reminderTime.toISOString().split('T')[0];
    const targetHour = reminderTime.getHours().toString().padStart(2, '0');
    const targetMinute = reminderTime.getMinutes().toString().padStart(2, '0');
    const targetTimeStr = `${targetHour}:${targetMinute}:00`;

    // 현재 시간 (로그용)
    const currentTimeStr = `${koreaTime.getHours().toString().padStart(2, '0')}:${koreaTime.getMinutes().toString().padStart(2, '0')}`;

    try {
        // 30분 후 상담 예정 건 조회 (pending 또는 confirmed 상태)
        // 시간은 정각 기준으로 체크 (예: 19:00, 19:30 등)
        const [consultations] = await db.query(
            `SELECT
                c.id,
                c.academy_id,
                c.parent_name,
                c.student_name,
                c.preferred_date,
                c.preferred_time,
                c.consultation_type,
                a.name AS academy_name
            FROM consultations c
            JOIN academies a ON c.academy_id = a.id
            WHERE DATE(c.preferred_date) = ?
                AND c.preferred_time >= ? AND c.preferred_time < ADDTIME(?, '00:01:00')
                AND c.status IN ('pending', 'confirmed')
                AND c.reminder_sent = FALSE`,
            [targetDate, targetTimeStr, targetTimeStr]
        );

        if (consultations.length === 0) {
            return; // 조용히 종료 (매분 실행되므로 로그 최소화)
        }

        console.log(`[ConsultationReminder] ${currentTimeStr} - ${consultations.length}건의 상담 알림 발송`);

        for (const consultation of consultations) {
            // 암호화된 이름 복호화
            let studentName = consultation.student_name;
            let parentName = consultation.parent_name;
            try {
                studentName = decrypt(consultation.student_name);
            } catch { /* 복호화 실패 시 원본 사용 */ }
            try {
                parentName = decrypt(consultation.parent_name);
            } catch { /* 복호화 실패 시 원본 사용 */ }

            const timeStr = consultation.preferred_time.substring(0, 5); // "19:00:00" -> "19:00"
            const typeStr = consultation.consultation_type === 'new_registration' ? '신규등록' : '학습';

            await sendPushToAcademyAdmins(
                consultation.academy_id,
                consultation.academy_name,
                {
                    studentName,
                    parentName,
                    time: timeStr,
                    type: typeStr,
                    consultationId: consultation.id
                }
            );

            // 알림 발송 완료 표시
            await db.query(
                'UPDATE consultations SET reminder_sent = TRUE WHERE id = ?',
                [consultation.id]
            );
        }
    } catch (error) {
        console.error('[ConsultationReminder] 스케줄러 오류:', error);
    }
}

/**
 * 학원 관리자에게 상담 알림 푸시 발송
 */
async function sendPushToAcademyAdmins(academyId, academyName, consultation) {
    try {
        // consultation_reminder 알림을 활성화한 관리자의 구독만 조회
        const [subscriptions] = await db.query(
            `SELECT ps.*
             FROM push_subscriptions ps
             JOIN users u ON ps.user_id = u.id
             LEFT JOIN user_notification_settings ns ON u.id = ns.user_id
             WHERE u.academy_id = ?
               AND u.role IN ('owner', 'admin')
               AND (ns.consultation_reminder IS NULL OR ns.consultation_reminder = TRUE)`,
            [academyId]
        );

        if (subscriptions.length === 0) {
            console.log(`[ConsultationReminder] 학원 ${academyId}: 등록된 푸시 구독 없음`);
            return;
        }

        const payload = JSON.stringify({
            title: '📅 상담 30분 전 알림',
            body: `${consultation.time} ${consultation.studentName} (${consultation.type} 상담)`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'consultation_reminder',
                url: '/consultations',
                academyId,
                consultationId: consultation.consultationId
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
                console.error(`[ConsultationReminder] 푸시 발송 실패:`, error.message);

                // 만료된 구독 삭제
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                    console.log(`[ConsultationReminder] 만료된 구독 삭제: ${sub.id}`);
                }
            }
        }

        console.log(`[ConsultationReminder] 학원 ${academyId}: ${consultation.studentName} 상담 알림 발송 (성공: ${successCount}, 실패: ${failCount})`);
    } catch (error) {
        console.error(`[ConsultationReminder] 학원 ${academyId} 푸시 발송 오류:`, error);
    }
}

/**
 * 스케줄러 초기화
 * 매분 실행하여 30분 후 상담 체크
 */
function initConsultationReminderScheduler() {
    // 매분 실행
    cron.schedule('* * * * *', async () => {
        await sendConsultationReminders();
    }, {
        timezone: 'Asia/Seoul'
    });

    console.log('[ConsultationReminder] 상담 알림 스케줄러 초기화 완료 (매분 실행)');
}

module.exports = {
    initConsultationReminderScheduler,
    sendConsultationReminders
};
