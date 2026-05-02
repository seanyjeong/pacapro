/**
 * routes/instructors/attendance.js
 *
 * 강사 출퇴근 기록 sub-라우터.
 *
 * ## endpoints
 * - POST `/:id/attendance` — 출퇴근 기록 생성/수정 (existing 있으면 update, 없으면 insert).
 *                            성공 후 `updateSalaryFromAttendance(...)` 호출하여 급여 레코드 자동 갱신.
 * - GET  `/:id/attendance` — 출퇴근 기록 목록 (year/month 필터).
 *
 * ## DB 패턴 (ADR-005)
 * 모든 SQL 호출 `pool.execute(sql, params)` 통일. 원본 `db.query(...)` 6건 → 통일.
 * 트랜잭션 없음. IN 절 없음 (ADR-016 해당 X).
 *
 * ## 응답 표면 (ADR-013 보존)
 * - 200: `{message, attendance}` (update), `{message, attendances}` (목록)
 * - 201: `{message, attendance}` (insert)
 * - 400: `{error: 'Validation Error', message}`
 * - 404: `{error: 'Not Found', message}`
 * - 500: `{error: 'Server Error', message}`
 * 프론트 `src/lib/api/instructors.ts` 가 `attendance` / `attendances` root 키 직접 소비.
 *
 * ## 외부 효과 (`updateSalaryFromAttendance`)
 * - 출퇴근 INSERT/UPDATE 후 시급/타임제 강사의 급여 레코드를 자동 생성/갱신.
 * - **`db` 인자로 전달** — `salaryCalculator` 가 내부에서 `db.query(...)` 또는 `db.execute(...)`
 *   직접 사용하므로 시그니처 (`updateSalaryFromAttendance(db, instructorId, academyId, workDate, status)`)
 *   무변경 (ADR-007 외부 헬퍼 시그니처 보존).
 *
 * ## 보안 (ADR-007)
 * - POST `/:id/attendance` 는 `verifyToken` 만 적용 (강사 본인 출퇴근 가능 — 권한 자체 검증
 *   안 함, 원본 정책 보존). GET 은 `checkPermission('instructors', 'view')` 적용.
 *
 * ## 한국어 메시지 (ADR-003)
 * 사용자 노출 메시지 한국어 친화. `error` 코드는 ADR-013 보존.
 */

const {
    pool,
    db,
    verifyToken,
    checkPermission,
    updateSalaryFromAttendance,
    logger
} = require('./_utils');

module.exports = function(router) {

    /**
     * POST /paca/instructors/:id/attendance
     * 출퇴근 기록 (체크인/체크아웃). existing 있으면 update, 없으면 insert.
     * Access: 모든 인증 사용자 (강사 본인 self-check 가능, 원본 정책 보존)
     */
    router.post('/:id/attendance', verifyToken, async (req, res) => {
        const instructorId = parseInt(req.params.id);

        try {
            // 강사 존재 확인 + 급여 정보
            const [instructors] = await pool.execute(
                `SELECT id, name, salary_type, instructor_type, hourly_rate, base_salary, tax_type
                 FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
                [instructorId, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            const { work_date, time_slot, check_in_time, check_out_time, attendance_status, notes } = req.body;

            if (!work_date || !time_slot) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '근무일자(work_date)와 시간대(time_slot)는 필수입니다.'
                });
            }

            // existing 확인
            const [existing] = await pool.execute(
                'SELECT id FROM instructor_attendance WHERE instructor_id = ? AND work_date = ? AND time_slot = ?',
                [instructorId, work_date, time_slot]
            );

            let attendanceResult;
            if (existing.length > 0) {
                // UPDATE
                await pool.execute(
                    `UPDATE instructor_attendance
                    SET check_in_time = ?, check_out_time = ?, attendance_status = ?, notes = ?, updated_at = NOW()
                    WHERE id = ?`,
                    [check_in_time ?? null, check_out_time ?? null, attendance_status || 'present', notes ?? null, existing[0].id]
                );

                const [updated] = await pool.execute(
                    'SELECT * FROM instructor_attendance WHERE id = ?',
                    [existing[0].id]
                );

                attendanceResult = updated[0];
            } else {
                // INSERT
                const [result] = await pool.execute(
                    `INSERT INTO instructor_attendance (
                        instructor_id,
                        work_date,
                        time_slot,
                        check_in_time,
                        check_out_time,
                        attendance_status,
                        notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
                    [instructorId, work_date, time_slot, check_in_time ?? null, check_out_time ?? null, attendance_status || 'present', notes ?? null]
                );

                const [created] = await pool.execute(
                    'SELECT * FROM instructor_attendance WHERE id = ?',
                    [result.insertId]
                );

                attendanceResult = created[0];
            }

            // ============================================
            // 급여 레코드 자동 생성/업데이트 (시급제, 타임제)
            // - salaryCalculator 가 내부에서 db.query 직접 사용 → ADR-007 시그니처 무변경.
            // ============================================
            await updateSalaryFromAttendance(db, instructorId, req.user.academyId, work_date, attendance_status);

            return res.status(existing.length > 0 ? 200 : 201).json({
                message: existing.length > 0 ? 'Attendance updated successfully' : 'Attendance recorded successfully',
                attendance: attendanceResult
            });
        } catch (error) {
            logger.error('Error recording attendance:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '출퇴근 기록에 실패했습니다.'
            });
        }
    });

    /**
     * GET /paca/instructors/:id/attendance
     * 출퇴근 기록 목록 (year/month 필터).
     * Access: instructors view
     */
    router.get('/:id/attendance', verifyToken, checkPermission('instructors', 'view'), async (req, res) => {
        const instructorId = parseInt(req.params.id);
        const { year, month } = req.query;

        try {
            let query = `
                SELECT
                    id,
                    work_date,
                    time_slot,
                    check_in_time,
                    check_out_time,
                    attendance_status,
                    notes,
                    created_at
                FROM instructor_attendance
                WHERE instructor_id = ?
            `;

            const params = [instructorId];

            if (year && month) {
                query += ` AND DATE_FORMAT(work_date, '%Y-%m') = ?`;
                params.push(`${year}-${String(month).padStart(2, '0')}`);
            }

            query += ' ORDER BY work_date DESC';

            const [attendances] = await pool.execute(query, params);

            res.json({
                message: `Found ${attendances.length} attendance records`,
                attendances
            });
        } catch (error) {
            logger.error('Error fetching attendance:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '출퇴근 기록을 불러오지 못했습니다.'
            });
        }
    });

};
