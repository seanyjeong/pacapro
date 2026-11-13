/**
 * paca/schedules/class-roster.js — 반 명단 출석 조회 (지점·반 2단계)
 *
 * 마운트: routes/schedules/index.js → require('./class-roster')(router), 정적 경로라 /:id 보다 먼저.
 *
 *   GET /class-roster?date=YYYY-MM-DD&class_id=N[&time_slot=morning|afternoon|evening]
 *     → { class, date, time_slot, schedule: { id, attendance_taken } | null, students[] }
 *
 * 수업 요일과 상관없이 그 반의 재원생 전원을 돌려주고, 그 날짜·시간대 수업에 이미 있는 학생은
 * 출결 상태를 붙인다(assigned). 읽기만 한다 — 수업·출석 행을 만들지 않는다.
 * 명단에 없던 학생을 체크할 때는 기존 POST /slot/student 로 넣은 뒤 기존 출결 저장을 쓴다.
 * time_slot 을 안 주면 반의 기본 시간대.
 */

const { db, decrypt, logger } = require('./_utils');
const { verifyToken } = require('../../middleware/auth');

const TIME_SLOTS = ['morning', 'afternoon', 'evening'];

module.exports = function(router) {

router.get('/class-roster', verifyToken, async (req, res) => {
    try {
        const { date, class_id, time_slot } = req.query;
        const classId = Number(class_id);

        if (!/^\d{4}-\d{2}-\d{2}$/.test(date || '') || !Number.isSafeInteger(classId) || classId < 1 ||
            (time_slot !== undefined && !TIME_SLOTS.includes(time_slot))) {
            return res.status(400).json({
                error: 'Bad Request',
                message: 'date(YYYY-MM-DD)와 class_id 는 필수이고, time_slot 은 morning·afternoon·evening 중 하나여야 합니다.'
            });
        }

        const [classes] = await db.query(
            `SELECT id, class_name, branch_id, default_time_slot
             FROM classes
             WHERE id = ? AND academy_id = ?`,
            [classId, req.user.academyId]
        );
        if (classes.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '반을 찾을 수 없습니다.'
            });
        }
        const slot = time_slot || classes[0].default_time_slot || 'afternoon';

        const [schedules] = await db.query(
            `SELECT id, attendance_taken FROM class_schedules
             WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
            [req.user.academyId, date, slot]
        );
        const schedule = schedules[0] || null;

        const [rows] = await db.query(
            `SELECT s.id AS student_id, s.name AS student_name, s.student_number, s.grade, s.phone, s.parent_phone,
                    a.id AS attendance_id, a.attendance_status, a.notes, a.is_makeup
             FROM students s
             LEFT JOIN attendance a ON a.student_id = s.id AND a.class_schedule_id = ?
             WHERE s.academy_id = ? AND s.class_id = ?
             AND s.status = 'active'
             AND s.deleted_at IS NULL`,
            [schedule ? schedule.id : null, req.user.academyId, classId]
        );

        const students = rows.map(({ attendance_id, ...s }) => ({
            ...s,
            student_name: s.student_name ? decrypt(s.student_name) : s.student_name,
            phone: s.phone ? decrypt(s.phone) : s.phone,
            parent_phone: s.parent_phone ? decrypt(s.parent_phone) : s.parent_phone,
            is_makeup: s.is_makeup ? 1 : 0,
            assigned: attendance_id != null
        })).sort((a, b) => (a.student_name || '').localeCompare(b.student_name || '', 'ko'));

        res.json({
            class: { id: classes[0].id, class_name: classes[0].class_name, branch_id: classes[0].branch_id },
            date,
            time_slot: slot,
            schedule,
            students
        });
    } catch (error) {
        logger.error('Error fetching class roster:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '반 명단을 불러오지 못했습니다.'
        });
    }
});

};
