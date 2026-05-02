/**
 * routes/instructors/overtime.js
 *
 * 강사 미배정 출근 / 추가 근무 승인 워크플로우 sub-라우터.
 *
 * ## endpoints
 * - GET  `/overtime/pending`           — 대기 중인 승인 요청 목록 조회
 * - GET  `/overtime/history`           — 승인 이력 조회 (year/month/instructor_id 필터)
 * - PUT  `/overtime/:approvalId/approve` — 승인 / 거부 처리
 * - POST `/:id/overtime`               — 강사 단위 미배정 출근 / 추가 근무 요청 생성
 *
 * ## DB 패턴 (ADR-005)
 * 모든 SQL 호출 `pool.execute(sql, params)` 통일. 원본 `db.query(...)` 9건 → 통일.
 * IN 절 없음 (ADR-016 해당 X).
 *
 * ## 응답 표면 (ADR-013 보존)
 * - 200: `{message, requests}` (목록), `{message, overtime}` (단건)
 * - 201: `{message, overtime}`
 * - 400: `{error: 'Validation Error'|'Invalid State'|'Duplicate', message}`
 * - 404: `{error: 'Not Found', message}`
 * - 500: `{error: 'Server Error', message}`
 * 프론트 `src/lib/api/instructors.ts` 가 `requests` / `overtime` root 키 직접 소비.
 *
 * ## 보안 (ADR-007)
 * - `decrypt(name)` 헬퍼만 사용. 시그니처 무변경.
 * - 모든 endpoint 에 `verifyToken` + `checkPermission('overtime_approval'|'instructors', ...)` 적용.
 *
 * ## 한국어 메시지 (ADR-003)
 * 사용자 노출 메시지는 한국어 친화. 에러 코드 (`error` 키) 는 프론트 인터셉터 호환을
 * 위해 영문 라벨 그대로 유지 (ADR-013).
 */

const {
    pool,
    verifyToken,
    checkPermission,
    decrypt,
    logger
} = require('./_utils');

module.exports = function(router) {

    /**
     * GET /paca/instructors/overtime/pending
     * 대기 중인 승인 요청 목록.
     * Access: overtime_approval view
     */
    router.get('/overtime/pending', verifyToken, checkPermission('overtime_approval', 'view'), async (req, res) => {
        try {
            const [requests] = await pool.execute(`
                SELECT
                    oa.*,
                    i.name as instructor_name,
                    i.salary_type,
                    i.hourly_rate
                FROM overtime_approvals oa
                JOIN instructors i ON oa.instructor_id = i.id
                WHERE oa.academy_id = ?
                AND oa.status = 'pending'
                ORDER BY oa.created_at DESC
            `, [req.user.academyId]);

            // 강사 이름 복호화
            const decryptedRequests = requests.map(r => ({
                ...r,
                instructor_name: decrypt(r.instructor_name)
            }));

            res.json({
                message: `Found ${requests.length} pending requests`,
                requests: decryptedRequests
            });
        } catch (error) {
            logger.error('Error fetching overtime requests:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '대기 중인 승인 요청을 불러오지 못했습니다.'
            });
        }
    });

    /**
     * GET /paca/instructors/overtime/history
     * 승인 이력 (year/month/instructor_id 필터).
     * Access: instructors view
     */
    router.get('/overtime/history', verifyToken, checkPermission('instructors', 'view'), async (req, res) => {
        const { year, month, instructor_id } = req.query;

        try {
            let query = `
                SELECT
                    oa.*,
                    i.name as instructor_name,
                    i.salary_type,
                    i.hourly_rate,
                    u.name as approved_by_name
                FROM overtime_approvals oa
                JOIN instructors i ON oa.instructor_id = i.id
                LEFT JOIN users u ON oa.approved_by = u.id
                WHERE oa.academy_id = ?
            `;
            const params = [req.user.academyId];

            if (year && month) {
                query += ` AND DATE_FORMAT(oa.work_date, '%Y-%m') = ?`;
                params.push(`${year}-${String(month).padStart(2, '0')}`);
            }

            if (instructor_id) {
                query += ' AND oa.instructor_id = ?';
                params.push(instructor_id);
            }

            query += ' ORDER BY oa.work_date DESC, oa.created_at DESC';

            const [requests] = await pool.execute(query, params);

            // 복호화
            const decryptedRequests = requests.map(r => ({
                ...r,
                instructor_name: r.instructor_name ? decrypt(r.instructor_name) : r.instructor_name,
                approved_by_name: r.approved_by_name ? decrypt(r.approved_by_name) : r.approved_by_name
            }));

            res.json({
                message: `Found ${requests.length} overtime records`,
                requests: decryptedRequests
            });
        } catch (error) {
            logger.error('Error fetching overtime history:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '승인 이력을 불러오지 못했습니다.'
            });
        }
    });

    /**
     * PUT /paca/instructors/overtime/:approvalId/approve
     * 승인 또는 거부 처리.
     * Access: overtime_approval edit
     */
    router.put('/overtime/:approvalId/approve', verifyToken, checkPermission('overtime_approval', 'edit'), async (req, res) => {
        const approvalId = parseInt(req.params.approvalId);

        try {
            const { status, notes } = req.body;  // status: 'approved' | 'rejected'

            if (!status || !['approved', 'rejected'].includes(status)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '승인 상태는 approved 또는 rejected 중 하나여야 합니다.'
                });
            }

            // 요청 존재 확인
            const [requests] = await pool.execute(
                'SELECT * FROM overtime_approvals WHERE id = ? AND academy_id = ?',
                [approvalId, req.user.academyId]
            );

            if (requests.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '승인 요청을 찾을 수 없습니다.'
                });
            }

            if (requests[0].status !== 'pending') {
                return res.status(400).json({
                    error: 'Invalid State',
                    message: '이미 처리된 요청입니다.'
                });
            }

            await pool.execute(
                `UPDATE overtime_approvals
                 SET status = ?, approved_by = ?, approved_at = NOW(), notes = COALESCE(?, notes)
                 WHERE id = ?`,
                [status, req.user.id, notes ?? null, approvalId]
            );

            const [updated] = await pool.execute(
                'SELECT * FROM overtime_approvals WHERE id = ?',
                [approvalId]
            );

            res.json({
                message: `Overtime request ${status}`,
                overtime: updated[0]
            });
        } catch (error) {
            logger.error('Error approving overtime:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '승인 처리에 실패했습니다.'
            });
        }
    });

    /**
     * POST /paca/instructors/:id/overtime
     * 강사별 미배정 출근 / 추가 근무 요청 생성.
     * Access: overtime_approval edit
     *
     * `:id` 와일드카드 패턴이지만 `/:id/overtime` 으로 다른 `/:id/...` 엔드포인트들과
     * 구분되어 충돌 X.
     */
    router.post('/:id/overtime', verifyToken, checkPermission('overtime_approval', 'edit'), async (req, res) => {
        const instructorId = parseInt(req.params.id);

        try {
            const {
                work_date,
                time_slot,
                request_type,       // 'overtime' | 'extra_day'
                original_end_time,
                actual_end_time,
                overtime_minutes,
                notes
            } = req.body;

            if (!work_date || !request_type) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '근무일자(work_date)와 요청 유형(request_type)은 필수입니다.'
                });
            }

            // 강사 존재 확인
            const [instructors] = await pool.execute(
                'SELECT id, name, instructor_type FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructorId, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            // 중복 확인
            const [existing] = await pool.execute(
                `SELECT id FROM overtime_approvals
                 WHERE instructor_id = ? AND work_date = ? AND time_slot <=> ?`,
                [instructorId, work_date, time_slot ?? null]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    error: 'Duplicate',
                    message: '해당 일자/시간대에 이미 등록된 요청이 있습니다.'
                });
            }

            const [result] = await pool.execute(
                `INSERT INTO overtime_approvals (
                    academy_id,
                    instructor_id,
                    work_date,
                    time_slot,
                    request_type,
                    original_end_time,
                    actual_end_time,
                    overtime_minutes,
                    notes
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                [
                    req.user.academyId,
                    instructorId,
                    work_date,
                    time_slot ?? null,
                    request_type,
                    original_end_time ?? null,
                    actual_end_time ?? null,
                    overtime_minutes ?? 0,
                    notes ?? null
                ]
            );

            const [created] = await pool.execute(
                'SELECT * FROM overtime_approvals WHERE id = ?',
                [result.insertId]
            );

            res.status(201).json({
                message: 'Overtime request created',
                overtime: created[0]
            });
        } catch (error) {
            logger.error('Error creating overtime request:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '추가 근무 요청 생성에 실패했습니다.'
            });
        }
    });

};
