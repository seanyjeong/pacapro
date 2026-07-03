const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const webpush = require('web-push');
const logger = require('../../utils/logger');
const { decrypt } = require('../../utils/encryption');

router.get('/reservation/:reservationNumber', async (req, res) => {
    await handleReservationLookup(req, res);
});

router.get('/consultation/:academySlug/reservation/:reservationNumber', async (req, res) => {
    await handleReservationLookup(req, res, req.params.academySlug);
});

router.put('/reservation/:reservationNumber', async (req, res) => {
    await handleReservationUpdate(req, res);
});

router.put('/consultation/:academySlug/reservation/:reservationNumber', async (req, res) => {
    await handleReservationUpdate(req, res, req.params.academySlug);
});

async function handleReservationLookup(req, res, academySlug = null) {
    try {
        const phoneLast4 = req.query.phoneLast4;
        if (!normalizeLast4(phoneLast4)) {
            return res.status(400).json({ error: '예약자 연락처 끝 4자리를 입력해주세요.' });
        }

        const consultation = await findReservation(req.params.reservationNumber, academySlug);
        if (!consultation || !verifyReservationContact(consultation, phoneLast4)) {
            return res.status(404).json({ error: '예약번호 또는 연락처를 확인해주세요.' });
        }

        const blocked = reservationBlockedResponse(consultation);
        if (blocked) return res.status(400).json(blocked);

        res.json(toReservationResponse(consultation));
    } catch (error) {
        logger.error('예약 조회 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

async function handleReservationUpdate(req, res, academySlug = null) {
    try {
        const { preferredDate, preferredTime, phoneLast4 } = req.body;

        if (!preferredDate || !preferredTime) {
            return res.status(400).json({ error: '날짜와 시간을 선택해주세요.' });
        }
        if (!normalizeLast4(phoneLast4 || req.query.phoneLast4)) {
            return res.status(400).json({ error: '예약자 연락처 끝 4자리를 입력해주세요.' });
        }

        const consultation = await findReservation(req.params.reservationNumber, academySlug);
        if (!consultation || !verifyReservationContact(consultation, phoneLast4 || req.query.phoneLast4)) {
            return res.status(404).json({ error: '예약번호 또는 연락처를 확인해주세요.' });
        }

        const blocked = reservationBlockedResponse(consultation, '수정할 수 없는 상태입니다.');
        if (blocked) return res.status(400).json(blocked);

        const timeToCheck = preferredTime.length === 5 ? `${preferredTime}:00` : preferredTime;
        const [existingCount] = await db.query(
            `SELECT COUNT(*) as count FROM consultations
             WHERE academy_id = ? AND preferred_date = ? AND preferred_time = ?
             AND status NOT IN ('cancelled') AND id != ?`,
            [consultation.academy_id, preferredDate, timeToCheck, consultation.id]
        );

        const [settings] = await db.query(
            'SELECT max_reservations_per_slot FROM consultation_settings WHERE academy_id = ?',
            [consultation.academy_id]
        );

        const maxReservations = settings[0]?.max_reservations_per_slot || 1;
        if (existingCount[0].count >= maxReservations) {
            return res.status(409).json({ error: '선택하신 시간대는 이미 예약이 완료되었습니다.' });
        }

        await db.query(
            `UPDATE consultations
             SET preferred_date = ?, preferred_time = ?, status = 'pending'
             WHERE id = ? AND academy_id = ?`,
            [preferredDate, timeToCheck, consultation.id, consultation.academy_id]
        );

        sendReservationChangePush(consultation.academy_id, consultation.academy_name, {
            reservationNumber: consultation.reservation_number,
            studentName: consultation.student_name,
            newDate: preferredDate,
            newTime: preferredTime
        }).catch(err => logger.error('[ReservationChangePush] 오류:', err));

        res.json({
            message: '예약이 수정되었습니다. 관리자 확인 후 다시 확정됩니다.',
            newStatus: 'pending'
        });
    } catch (error) {
        logger.error('예약 수정 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
}

async function findReservation(reservationNumber, academySlug = null) {
    const where = ['c.reservation_number = ?'];
    const params = [reservationNumber];

    if (academySlug) {
        where.push('a.slug = ?');
        params.push(academySlug);
    }

    const [consultations] = await db.query(
        `SELECT c.*, a.name as academy_name, a.slug
         FROM consultations c
         JOIN academies a ON c.academy_id = a.id
         WHERE ${where.join(' AND ')}
         LIMIT 1`,
        params
    );

    return consultations[0] || null;
}

function verifyReservationContact(consultation, phoneLast4) {
    const expected = normalizeLast4(phoneLast4);
    if (!expected) return false;

    return [consultation.parent_phone]
        .map(value => digitsOnly(decrypt(value)))
        .some(phone => phone.length >= 4 && phone.slice(-4) === expected);
}

function normalizeLast4(value) {
    const digits = digitsOnly(value);
    return digits.length === 4 ? digits : null;
}

function digitsOnly(value) {
    return String(value || '').replace(/[^0-9]/g, '');
}

function reservationBlockedResponse(consultation, fallback = null) {
    if (consultation.status === 'cancelled') {
        return { error: fallback || '취소된 예약입니다.', status: 'cancelled' };
    }
    if (consultation.status === 'completed') {
        return { error: fallback || '이미 완료된 상담입니다.', status: 'completed' };
    }
    return null;
}

function toReservationResponse(consultation) {
    return {
        id: consultation.id,
        reservationNumber: consultation.reservation_number,
        studentName: decrypt(consultation.student_name) || consultation.student_name,
        studentGrade: consultation.student_grade,
        preferredDate: consultation.preferred_date,
        preferredTime: consultation.preferred_time.substring(0, 5),
        status: consultation.status,
        academyName: consultation.academy_name,
        academySlug: consultation.slug
    };
}

async function sendReservationChangePush(academyId, academyName, info) {
    try {
        const [subscriptions] = await db.query(
            `SELECT ps.*
             FROM push_subscriptions ps
             JOIN users u ON ps.user_id = u.id
             LEFT JOIN user_notification_settings ns ON u.id = ns.user_id
             WHERE u.academy_id = ?
               AND u.role = 'owner'
               AND (ns.new_consultation IS NULL OR ns.new_consultation = TRUE)`,
            [academyId]
        );

        if (subscriptions.length === 0) {
            logger.info('[ReservationChangePush] 구독자 없음');
            return;
        }

        const studentName = decrypt(info.studentName) || info.studentName;
        const newDateStr = new Date(info.newDate).toLocaleDateString('ko-KR', {
            month: 'long',
            day: 'numeric'
        });

        const payload = JSON.stringify({
            title: '상담 일정 변경',
            body: `${studentName} - ${newDateStr} ${info.newTime}`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'consultation_changed',
                url: '/consultations',
                academyId,
                reservationNumber: info.reservationNumber
            }
        });

        for (const sub of subscriptions) {
            try {
                await webpush.sendNotification({
                    endpoint: sub.endpoint,
                    keys: { p256dh: sub.p256dh, auth: sub.auth }
                }, payload);
            } catch (error) {
                if (error.statusCode === 410 || error.statusCode === 404) {
                    await db.query('DELETE FROM push_subscriptions WHERE id = ?', [sub.id]);
                }
            }
        }

        logger.info(`[ReservationChangePush] 학원 ${academyId}: 일정 변경 알림 발송 완료`);
    } catch (error) {
        logger.error('[ReservationChangePush] 오류:', error);
    }
}

module.exports = router;
