const express = require('express');
const router = express.Router();
const db = require('../../config/database');
const logger = require('../../utils/logger');
const { encrypt, decrypt } = require('../../utils/encryption');

// ============================================
// 재원생 상담 신청 (공개, 로그인 없음)
// 학생 이름 + 전화번호(학생·학부모 아무거나)가 재원생과 맞아야 신청된다.
// 신규 상담과 같은 consultations 표·같은 시간표를 쓴다(시간 공유).
// ============================================

// 우선 일산만 연다(사장님 결정 2026-11-18). 다른 학원은 학원 주소를 여기에 더하면 열린다.
const ENABLED_ACADEMY_SLUGS = ['imaxnew'];
const NOT_MATCHED_ERROR = '이름 또는 전화번호가 맞지 않습니다. 원장님께 문의하세요.';
const LEARNING_TYPE_LABELS = {
    regular: '정기상담',
    admission: '진학상담',
    parent: '학부모상담',
    counseling: '고민상담'
};

// POST /paca/public/consultation/:slug/enrolled/verify - 재원생 확인 (일정 고르기 전에)
router.post('/consultation/:slug/enrolled/verify', async (req, res) => {
    try {
        const academy = await findEnabledAcademy(req.params.slug);
        if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });
        if (academy.is_enabled === 0) return res.status(403).json({ error: '현재 상담 예약이 불가능합니다.' });

        const inputError = validateIdentity(req.body);
        if (inputError) return res.status(400).json({ error: inputError });

        const student = await findEnrolledStudent(academy.id, req.body.studentName, req.body.phone);
        if (!student) return res.status(404).json({ error: NOT_MATCHED_ERROR });

        res.json({ matched: true });
    } catch (error) {
        logger.error('재원생 확인 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

// POST /paca/public/consultation/:slug/enrolled/apply - 재원생 상담 신청
router.post('/consultation/:slug/enrolled/apply', async (req, res) => {
    try {
        const { studentName, phone, learningType, inquiryContent, preferredDate, preferredTime } = req.body;

        const inputError = validateIdentity(req.body);
        if (inputError) return res.status(400).json({ error: inputError });
        if (!LEARNING_TYPE_LABELS[learningType]) {
            return res.status(400).json({ error: '상담 종류를 선택해주세요.' });
        }
        if (!preferredDate || !preferredTime) {
            return res.status(400).json({ error: '상담 일정을 선택해주세요.' });
        }

        const academy = await findEnabledAcademy(req.params.slug);
        if (!academy) return res.status(404).json({ error: '학원을 찾을 수 없습니다.' });
        if (academy.is_enabled === 0) return res.status(403).json({ error: '현재 상담 예약이 불가능합니다.' });

        const student = await findEnrolledStudent(academy.id, studentName, phone);
        if (!student) return res.status(404).json({ error: NOT_MATCHED_ERROR });
        if (!student.grade) {
            return res.status(400).json({ error: '학생 정보에 학년이 없습니다. 원장님께 문의하세요.' });
        }

        // 신규 상담과 같은 시간표: 같은 시간에 잡힌 상담(종류 무관) 수로 마감 확인
        const timeToSave = `${preferredTime}:00`;
        const [existingCount] = await db.query(
            `SELECT COUNT(*) as count FROM consultations
             WHERE academy_id = ? AND preferred_date = ? AND preferred_time = ?
             AND status NOT IN ('cancelled')`,
            [academy.id, preferredDate, timeToSave]
        );
        const maxReservations = academy.max_reservations_per_slot || 1;
        if (existingCount[0].count >= maxReservations) {
            return res.status(409).json({ error: '선택하신 시간대는 이미 예약이 완료되었습니다. 다른 시간을 선택해주세요.' });
        }

        // 원장님이 확인(확정)하기 전까지는 대기. 상담 기록(student_consultations)은 상담을 진행할 때 만들어진다.
        const [result] = await db.query(
            `INSERT INTO consultations (
                academy_id, consultation_type, learning_type, linked_student_id,
                student_name, student_grade, inquiry_content,
                preferred_date, preferred_time, branch_id, status
            ) VALUES (?, 'learning', ?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
            [
                academy.id,
                learningType,
                student.id,
                encrypt(student.name),
                student.grade,
                inquiryContent || null,
                preferredDate,
                timeToSave,
                student.branch_id || null
            ]
        );

        const formattedDate = new Date(preferredDate).toLocaleDateString('ko-KR', {
            month: 'long', day: 'numeric', weekday: 'short'
        });
        // 알림 모듈은 VAPID 키를 읽으며 바로 설정하므로 보낼 때 불러온다(재원생 상담 등록과 같은 방식)
        const pushService = require('../../services/pushService');
        pushService.sendPushToAcademyAdmins(academy.id, {
            title: '재원생 상담 신청',
            body: `${student.name} 학생 ${LEARNING_TYPE_LABELS[learningType]} - ${formattedDate} ${preferredTime}`,
            icon: '/icons/icon-192x192.png',
            badge: '/icons/icon-72x72.png',
            data: {
                type: 'consultation',
                url: '/consultations/enrolled'
            }
        }).catch(err => logger.error('[EnrolledConsultationPush] 오류:', err));

        res.status(201).json({ message: '상담 신청이 완료되었습니다.', consultationId: result.insertId });
    } catch (error) {
        logger.error('재원생 상담 신청 오류:', error);
        res.status(500).json({ error: '서버 오류가 발생했습니다.' });
    }
});

function validateIdentity(body) {
    if (!String(body.studentName || '').trim()) return '학생 이름을 입력해주세요.';
    const digits = digitsOnly(body.phone);
    if (digits.length < 10 || digits.length > 11) return '전화번호를 정확히 입력해주세요.';
    return null;
}

async function findEnabledAcademy(slug) {
    if (!ENABLED_ACADEMY_SLUGS.includes(slug)) return null;
    const [academies] = await db.query(
        `SELECT a.id, a.name, cs.is_enabled, cs.max_reservations_per_slot
         FROM academies a
         LEFT JOIN consultation_settings cs ON a.id = cs.academy_id
         WHERE a.slug = ?`,
        [slug]
    );
    return academies[0] || null;
}

/** 재원생(active) 중 이름이 같고, 학생·학부모 번호 중 하나가 입력한 번호와 같은 학생. 이름·번호는 암호화돼 있어 복호화해서 비교한다. */
async function findEnrolledStudent(academyId, studentName, phone) {
    const [students] = await db.query(
        `SELECT id, name, phone, parent_phone, father_phone, mother_phone, grade, branch_id
         FROM students
         WHERE academy_id = ? AND status = 'active' AND deleted_at IS NULL`,
        [academyId]
    );

    const wantName = normalizeName(studentName);
    const wantPhone = digitsOnly(phone);
    for (const row of students) {
        const name = decrypt(row.name) || row.name;
        if (normalizeName(name) !== wantName) continue;
        const phones = [row.phone, row.parent_phone, row.father_phone, row.mother_phone]
            .map(value => digitsOnly(decrypt(value)));
        if (phones.includes(wantPhone)) {
            return { id: row.id, name, grade: row.grade, branch_id: row.branch_id };
        }
    }
    return null;
}

function normalizeName(value) {
    return String(value || '').replace(/\s/g, '');
}

function digitsOnly(value) {
    return String(value || '').replace(/[^0-9]/g, '');
}

module.exports = router;
