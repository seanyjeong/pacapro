/**
 * paca/students/enrollment.js — 등록·진급·퇴원·휴원 종료·시즌 이력 라우터
 *
 * 마운트: paca.js → routes/students/index.js → require('./enrollment')(router)
 *         mount path: '/paca/students'
 *
 * Endpoint (5건, fixed paths 우선 등록):
 *   - GET  /rest-ended       — 휴원 종료일 경과 학생 목록 (복귀 대기, days_overdue 포함)
 *   - POST /:id/withdraw     — 학생 퇴원 처리 + 미래 출결 예약 정리
 *   - POST /grade-upgrade    — 일괄 학년/상태 진급 (트랜잭션)
 *   - POST /auto-promote     — 신학기 자동 진급 + 졸업 처리 (트랜잭션, dry_run 지원)
 *   - GET  /:id/seasons      — 학생 시즌 등록 이력
 *
 * 인증: 모두 verifyToken. requireRole(owner/admin/staff) 또는 checkPermission('students','edit') 추가.
 *
 * 응답 표면 보존 (ADR-013):
 *   프론트 src/lib/api/students.ts (withdrawStudent / autoPromote / getRestEndedStudents) +
 *   src/lib/api/seasons.ts (getStudentSeasonHistory) + src/app/page.tsx 가 root 키 직접 소비.
 *   리팩 범위에서 응답 root 키 절대 변경 X. 표준화는 별도 "응답 통일 트랙"으로.
 *     - GET  /rest-ended      → { message, students: [...] }
 *     - POST /:id/withdraw    → { message, student: {...} }
 *     - POST /grade-upgrade   → { message, updated_count }
 *     - POST /auto-promote    → { message, dry_run, promoted, graduated, summary, details }
 *     - GET  /:id/seasons     → { message, student, seasons }
 *     - 에러                  → { error: '<영문코드>', message: '<한국어 친화 메시지>' }
 *
 * DB 호출 패턴 (ADR-005):
 *   - 단일 query: pool.execute(sql, params)
 *   - 트랜잭션: pool.getConnection() → conn.execute → conn.commit/rollback/release
 *   - db.query / connection.query 잔존 0건 (mysql2 promise pool prepared statement 강제).
 *
 * 보안 (ADR-007): decrypt(value) 시그니처 무변경. auth/JWT/암호화/결제 영역 X (학사 데이터만).
 *
 * 분리 결정 (ADR-006): 472→해당 파일 줄. 500줄 임계 부근이라 본 phase 분리 X.
 *   향후 신규 endpoint 로 임계 초과 시 도메인별 sub-모듈 (rest-ended/withdraw/promotion/seasons) 분리 고려.
 *
 * 회귀 테스트: __tests__/routes/students/enrollment.test.js (supertest mini-app + 외부 의존성 모킹)
 */

const pool = require('../../config/database');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');

module.exports = function(router) {

/**
 * GET /paca/students/rest-ended — 휴원 종료 학생 (복귀 대기) 목록 + days_overdue.
 * Access: owner, admin, staff. 응답: { message, students } (ADR-013 보존).
 */
router.get('/rest-ended', verifyToken, requireRole('owner', 'admin', 'staff'), async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const today = new Date().toISOString().split('T')[0];

        const [students] = await pool.execute(
            `SELECT
                id, name, phone, school, grade,
                rest_start_date, rest_end_date, rest_reason,
                class_days, time_slot, monthly_tuition, discount_rate
             FROM students
             WHERE academy_id = ?
             AND deleted_at IS NULL
             AND status = 'paused'
             AND rest_end_date IS NOT NULL
             AND rest_end_date < ?
             ORDER BY rest_end_date ASC`,
            [academyId, today]
        );

        // 이름/전화번호 복호화 + 경과일 계산 (decrypt 시그니처 무변경, ADR-007)
        const decryptedStudents = students.map(s => {
            const restEndDate = new Date(s.rest_end_date);
            const todayDate = new Date(today);
            const daysOverdue = Math.floor((todayDate - restEndDate) / (1000 * 60 * 60 * 24));

            return {
                ...s,
                name: decrypt(s.name),
                phone: s.phone ? decrypt(s.phone) : null,
                days_overdue: daysOverdue
            };
        });

        res.json({
            message: 'Success',
            students: decryptedStudents
        });
    } catch (error) {
        logger.error('Error fetching rest-ended students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '휴원 종료 학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

/**
 * POST /paca/students/:id/withdraw — 퇴원 처리 (status='withdrawn' + 미래 미체크 출결 삭제).
 * 결제(payments) 미변경 (학사 데이터만). Access: students.edit 권한.
 * 응답: { message, student } (ADR-013 보존).
 */
router.post('/:id/withdraw', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { reason, withdrawal_date } = req.body;

    try {
        const [students] = await pool.execute(
            'SELECT id, name, status FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        if (students[0].status === 'withdrawn') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 퇴원 처리된 학생입니다.'
            });
        }

        const finalWithdrawalDate = withdrawal_date || new Date().toISOString().split('T')[0];

        await pool.execute(
            `UPDATE students
             SET status = 'withdrawn',
                 withdrawal_date = ?,
                 withdrawal_reason = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [finalWithdrawalDate, reason || null, studentId]
        );

        // 출결 정리 정책 (사장님 확정 2026-05-04):
        //  - 과거 (< today): 출석 이력 보존 (삭제 X)
        //  - 당일 (= today): 무조건 삭제 (체크된 것도 — 퇴원했으니 그날 깨끗하게)
        //  - 미래 (> today): 미체크 (NULL) 만 삭제 (이미 출석 처리된 것은 보존)
        const today = new Date().toISOString().split('T')[0];
        await pool.execute(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
               AND (
                 cs.class_date = ?
                 OR (cs.class_date > ? AND a.attendance_status IS NULL)
               )`,
            [studentId, today, today]
        );

        res.json({
            message: '퇴원 처리되었습니다',
            student: {
                id: studentId,
                name: students[0].name,
                status: 'withdrawn',
                withdrawal_date: finalWithdrawalDate,
                withdrawal_reason: reason
            }
        });
    } catch (error) {
        logger.error('Error withdrawing student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '퇴원 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

/**
 * POST /paca/students/grade-upgrade — bulk 진급 (트랜잭션). Access: students.edit 권한.
 * 응답: { message, updated_count } (ADR-013 보존).
 */
router.post('/grade-upgrade', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    try {
        const { upgrades } = req.body;

        if (!Array.isArray(upgrades) || upgrades.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '진급 대상 목록이 비어 있습니다.'
            });
        }

        const validGrades = ['고1', '고2', '고3', 'N수', null];
        const validStatuses = ['active', 'inactive', 'graduated'];

        for (const upgrade of upgrades) {
            if (!upgrade.student_id) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '학생 ID가 누락된 항목이 있습니다.'
                });
            }

            if (upgrade.new_grade !== null && upgrade.new_grade !== undefined && !validGrades.includes(upgrade.new_grade)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `유효하지 않은 학년입니다: ${upgrade.new_grade}. 허용: 고1, 고2, 고3, N수`
                });
            }

            if (upgrade.new_status && !validStatuses.includes(upgrade.new_status)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `유효하지 않은 상태입니다: ${upgrade.new_status}. 허용: active, inactive, graduated`
                });
            }
        }

        // 학원 소속 검증.
        // 주의: pool.execute (prepared statement) 는 자리표시자 1:1 매핑 → IN 절은 N개 ? 로 명시 전개 필요.
        // (mysql2 의 pool.query 만 IN (?) + 배열 1개 자동 펼침 지원)
        const studentIds = upgrades.map(u => u.student_id);
        const placeholders = studentIds.map(() => '?').join(',');
        const [existingStudents] = await pool.execute(
            `SELECT id FROM students
             WHERE id IN (${placeholders})
             AND academy_id = ?
             AND deleted_at IS NULL`,
            [...studentIds, req.user.academyId]
        );

        if (existingStudents.length !== studentIds.length) {
            const foundIds = existingStudents.map(s => s.id);
            const missingIds = studentIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                error: 'Validation Error',
                message: `일부 학생을 찾을 수 없습니다: ${missingIds.join(', ')}`
            });
        }

        // 트랜잭션 (ADR-005: conn.execute)
        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            let updatedCount = 0;

            for (const upgrade of upgrades) {
                const updates = [];
                const params = [];

                if (upgrade.new_grade !== undefined) {
                    updates.push('grade = ?');
                    params.push(upgrade.new_grade);
                }

                if (upgrade.new_status) {
                    updates.push('status = ?');
                    params.push(upgrade.new_status);
                }

                if (updates.length > 0) {
                    updates.push('updated_at = NOW()');
                    params.push(upgrade.student_id);

                    await connection.execute(
                        `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
                        params
                    );
                    updatedCount++;
                }
            }

            await connection.commit();

            res.json({
                message: `${updatedCount}명의 학생 정보가 업데이트되었습니다.`,
                updated_count: updatedCount
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        logger.error('Error upgrading student grades:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 진급 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

/**
 * POST /paca/students/auto-promote — 학년 자동 진급 (3월 신학기). 트랜잭션 + dry_run 지원.
 * 진급 규칙: 중1→중2→중3→고1→고2→고3→N수 (N수 유지).
 * Body (선택): { dry_run, graduate_student_ids } — 고3 중 graduate_student_ids 는 'graduated'.
 * Access: owner only. 응답: { message, dry_run, promoted, graduated, summary, details } (ADR-013 보존).
 */
router.post('/auto-promote', verifyToken, requireRole('owner'), async (req, res) => {
    try {
        const { dry_run = false, graduate_student_ids = [] } = req.body;
        const academyId = req.user.academyId;

        const GRADE_PROMOTION_MAP = {
            '중1': '중2',
            '중2': '중3',
            '중3': '고1',
            '고1': '고2',
            '고2': '고3',
            '고3': 'N수',
            'N수': 'N수'
        };

        const [students] = await pool.execute(`
            SELECT id, name, grade, status
            FROM students
            WHERE academy_id = ?
              AND deleted_at IS NULL
              AND status IN ('active', 'paused')
              AND grade IS NOT NULL
            ORDER BY grade
        `, [academyId]);

        if (students.length === 0) {
            return res.json({
                message: '진급 대상 학생이 없습니다',
                promoted: 0,
                graduated: 0,
                details: []
            });
        }

        const promotionDetails = [];
        let promotedCount = 0;
        let graduatedCount = 0;

        const connection = await pool.getConnection();
        await connection.beginTransaction();

        try {
            for (const student of students) {
                const currentGrade = student.grade;
                const newGrade = GRADE_PROMOTION_MAP[currentGrade];

                const shouldGraduate = currentGrade === '고3' &&
                    graduate_student_ids.includes(student.id);

                if (shouldGraduate) {
                    if (!dry_run) {
                        await connection.execute(
                            `UPDATE students SET status = 'graduated', updated_at = NOW() WHERE id = ?`,
                            [student.id]
                        );

                        // 졸업생 미래 스케줄 삭제
                        const today = new Date().toISOString().split('T')[0];
                        await connection.execute(
                            `DELETE a FROM attendance a
                             JOIN class_schedules cs ON a.class_schedule_id = cs.id
                             WHERE a.student_id = ?
                             AND cs.academy_id = ?
                             AND cs.class_date >= ?
                             AND (a.attendance_status IS NULL OR a.attendance_status = 'absent')`,
                            [student.id, academyId, today]
                        );
                    }
                    promotionDetails.push({
                        studentId: student.id,
                        name: student.name,
                        from: currentGrade,
                        to: '졸업',
                        action: 'graduated'
                    });
                    graduatedCount++;
                } else if (newGrade && currentGrade !== newGrade) {
                    if (!dry_run) {
                        await connection.execute(
                            `UPDATE students SET grade = ?, updated_at = NOW() WHERE id = ?`,
                            [newGrade, student.id]
                        );
                    }
                    promotionDetails.push({
                        studentId: student.id,
                        name: student.name,
                        from: currentGrade,
                        to: newGrade,
                        action: 'promoted'
                    });
                    promotedCount++;
                }
            }

            if (!dry_run) {
                await connection.commit();
            } else {
                await connection.rollback();
            }
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        const summary = {};
        promotionDetails.forEach(d => {
            const key = `${d.from} → ${d.to}`;
            summary[key] = (summary[key] || 0) + 1;
        });

        res.json({
            message: dry_run
                ? `진급 미리보기: ${promotedCount}명 진급, ${graduatedCount}명 졸업 예정`
                : `진급 완료: ${promotedCount}명 진급, ${graduatedCount}명 졸업 처리`,
            dry_run,
            promoted: promotedCount,
            graduated: graduatedCount,
            summary,
            details: promotionDetails
        });

    } catch (error) {
        logger.error('Auto-promote error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학년 자동 진급 처리에 실패했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

/**
 * GET /paca/students/:id/seasons — 학생의 시즌 등록 이력 (student_seasons + seasons join).
 * Access: verifyToken (학원 소속 검증은 SQL where 절). 응답: { message, student, seasons } (ADR-013 보존).
 */
router.get('/:id/seasons', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        const [students] = await pool.execute(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        const [seasons] = await pool.execute(
            `SELECT
                ss.id as enrollment_id,
                ss.season_id,
                ss.season_fee,
                ss.registration_date,
                ss.after_season_action,
                ss.prorated_month,
                ss.prorated_amount,
                ss.prorated_details,
                ss.is_continuous,
                ss.previous_season_id,
                ss.discount_type,
                ss.discount_amount,
                ss.payment_status,
                ss.paid_date,
                ss.paid_amount,
                ss.payment_method,
                ss.is_cancelled,
                ss.cancellation_date,
                ss.refund_amount,
                ss.time_slots,
                ss.created_at,
                s.season_name,
                s.season_type,
                s.season_start_date,
                s.season_end_date,
                s.non_season_end_date,
                s.status as season_status,
                s.operating_days,
                s.grade_time_slots
            FROM student_seasons ss
            JOIN seasons s ON ss.season_id = s.id
            WHERE ss.student_id = ?
            ORDER BY ss.registration_date DESC`,
            [studentId]
        );

        res.json({
            message: `Found ${seasons.length} season enrollments`,
            student: students[0],
            seasons
        });
    } catch (error) {
        logger.error('Error fetching student seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 시즌 이력을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.'
        });
    }
});

};
