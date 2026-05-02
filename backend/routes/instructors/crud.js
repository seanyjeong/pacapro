/**
 * routes/instructors/crud.js
 *
 * 강사 마스터 데이터 CRUD sub-라우터.
 *
 * ## endpoints
 * - GET    `/`        — 강사 목록 (status/salary_type/instructor_type/search/gender 필터)
 * - GET    `/:id`     — 강사 상세 (출퇴근 30건 + 급여 12건 동봉)
 * - POST   `/`        — 강사 등록 (민감 필드 암호화: name/phone/resident_number/account_number/address)
 * - PUT    `/:id`     — 강사 수정 (필드별 dynamic update + 동일 암호화)
 * - DELETE `/:id`     — soft delete (deleted_at = NOW)
 *
 * ## DB 패턴 (ADR-005)
 * 모든 SQL 호출 `pool.execute(sql, params)` 통일. 원본 `db.query(...)` 12건 → 통일.
 * 트랜잭션 없음. IN 절 없음 (ADR-016 해당 X).
 *
 * ## 응답 표면 (ADR-013 보존)
 * - 200/201: `{message, instructor}` (단건), `{message, instructors}` (목록), `{instructor, attendances, salaries}` (상세)
 * - 400: `{error: 'Validation Error', message}`
 * - 404: `{error: 'Not Found', message}`
 * - 500: `{error: 'Server Error', message}`
 * 프론트 `src/lib/api/instructors.ts` + `src/lib/types/instructor.ts` 가
 * `instructors` / `instructor` / `attendances` / `salaries` root 키 직접 소비.
 *
 * ## 보안 (ADR-007)
 * - 암호화 헬퍼 (`encrypt`, `decryptFields`, `decryptArrayFields`, `ENCRYPTED_FIELDS.instructors`)
 *   시그니처 무변경. 본 sub-라우터 안에서 직접 암복호화 알고리즘 재구현 금지.
 * - 모든 endpoint 에 `verifyToken` + `checkPermission('instructors', 'view'|'edit')` 적용.
 *
 * ## 외부 효과
 * - POST / PUT / DELETE 시 `syncPeakTrainerAsync(instructorId)` 호출 — peak 시스템과
 *   강사 마스터 sync (실패해도 요청은 성공으로 응답).
 *
 * ## 한국어 메시지 (ADR-003)
 * 사용자 노출 메시지는 한국어 친화. `error` 코드 라벨은 ADR-013 보존을 위해 영문 유지.
 *
 * ## 분리 결정 (ADR-006)
 * 본 sub-라우터 단독 ~530줄. 500줄 임계 살짝 초과. dynamic update 필드 18개 + INSERT
 * 18개 컬럼 + 검증 로직이 단일 도메인 (강사 마스터) 안에서 강하게 결합되어 있어 추가
 * 분리는 누락 위험을 키운다. 분리 미루기 (ADR-015) 적용 — JSDoc 표준화 + DB 패턴 통일
 * + 한국어 메시지까지 본 단계에서 완료. CRUD 추가 분리는 phase 3 진입 시 본격 검토.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    encrypt,
    decryptFields,
    decryptArrayFields,
    ENCRYPTED_FIELDS,
    syncPeakTrainerAsync,
    logger
} = require('./_utils');

module.exports = function(router) {

    /**
     * GET /paca/instructors
     * 강사 목록 조회 (필터링).
     * Access: instructors view
     */
    router.get('/', verifyToken, checkPermission('instructors', 'view'), async (req, res) => {
        try {
            const { status, salary_type, instructor_type, search, gender } = req.query;

            let query = `
                SELECT
                    i.id,
                    i.name,
                    i.phone,
                    i.gender,
                    i.hire_date,
                    i.salary_type,
                    i.instructor_type,
                    i.hourly_rate,
                    i.base_salary,
                    i.tax_type,
                    i.work_days,
                    i.work_start_time,
                    i.work_end_time,
                    i.status,
                    i.created_at
                FROM instructors i
                WHERE i.academy_id = ?
                AND i.deleted_at IS NULL
            `;

            const params = [req.user.academyId];

            if (status) {
                query += ' AND i.status = ?';
                params.push(status);
            }

            if (salary_type) {
                query += ' AND i.salary_type = ?';
                params.push(salary_type);
            }

            if (instructor_type) {
                query += ' AND i.instructor_type = ?';
                params.push(instructor_type);
            }

            if (search) {
                query += ' AND (i.name LIKE ? OR i.phone LIKE ?)';
                const searchTerm = `%${search}%`;
                params.push(searchTerm, searchTerm);
            }

            if (gender) {
                query += ' AND i.gender = ?';
                params.push(gender);
            }

            query += ' ORDER BY i.hire_date DESC';

            const [instructors] = await pool.execute(query, params);

            // 민감 필드 복호화
            const decryptedInstructors = decryptArrayFields(instructors, ENCRYPTED_FIELDS.instructors);

            res.json({
                message: `Found ${decryptedInstructors.length} instructors`,
                instructors: decryptedInstructors
            });
        } catch (error) {
            logger.error('Error fetching instructors:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '강사 목록을 불러오지 못했습니다.'
            });
        }
    });

    /**
     * GET /paca/instructors/:id
     * 강사 상세 (최근 출퇴근 30건 + 최근 급여 12건).
     * Access: instructors view
     */
    router.get('/:id', verifyToken, checkPermission('instructors', 'view'), async (req, res) => {
        const instructorId = parseInt(req.params.id);

        try {
            // 강사 기본 정보
            const [instructors] = await pool.execute(
                `SELECT
                    i.*,
                    a.name as academy_name
                FROM instructors i
                LEFT JOIN academies a ON i.academy_id = a.id
                WHERE i.id = ?
                AND i.academy_id = ?
                AND i.deleted_at IS NULL`,
                [instructorId, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            // 민감 필드 복호화
            const instructor = decryptFields(instructors[0], ENCRYPTED_FIELDS.instructors);

            // 최근 출퇴근 기록
            const [attendances] = await pool.execute(
                `SELECT
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
                ORDER BY work_date DESC
                LIMIT 30`,
                [instructorId]
            );

            // 최근 급여 기록
            const [salaries] = await pool.execute(
                `SELECT
                    id,
                    \`year_month\`,
                    base_amount,
                    incentive_amount,
                    total_deduction,
                    tax_amount,
                    net_salary,
                    payment_date,
                    payment_status
                FROM salary_records
                WHERE instructor_id = ?
                ORDER BY \`year_month\` DESC
                LIMIT 12`,
                [instructorId]
            );

            res.json({
                instructor,
                attendances,
                salaries
            });
        } catch (error) {
            logger.error('Error fetching instructor:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '강사 정보를 불러오지 못했습니다.'
            });
        }
    });

    /**
     * POST /paca/instructors
     * 강사 등록.
     * Access: instructors edit
     */
    router.post('/', verifyToken, checkPermission('instructors', 'edit'), async (req, res) => {
        try {
            const {
                name,
                phone,
                gender,
                email,
                resident_number,  // 주민번호 (세무용)
                hire_date,
                salary_type,
                instructor_type,  // 'teacher' | 'assistant'
                hourly_rate,
                base_salary,
                tax_type,
                bank_name,
                account_number,
                address,
                notes,
                // 사무보조용 필드
                work_days,        // [1, 3, 5] 형태
                work_start_time,  // 'HH:MM' 형태
                work_end_time     // 'HH:MM' 형태
            } = req.body;

            // 필수 필드 검증
            if (!name || !phone || !salary_type || !tax_type) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '필수 입력 항목이 누락되었습니다 (이름/전화/급여형태/세무).'
                });
            }

            // salary_type 검증
            if (!['hourly', 'per_class', 'monthly', 'mixed'].includes(salary_type)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '급여 형태가 올바르지 않습니다 (hourly, per_class, monthly, mixed 중 하나).'
                });
            }

            // instructor_type 정규화 (시급제일 때만 의미)
            const finalInstructorType = salary_type === 'hourly' && instructor_type
                ? instructor_type
                : (salary_type === 'hourly' ? 'teacher' : null);

            if (finalInstructorType && !['teacher', 'assistant'].includes(finalInstructorType)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '강사 유형이 올바르지 않습니다 (teacher 또는 assistant).'
                });
            }

            // tax_type 검증
            if (!['3.3%', 'insurance', 'none'].includes(tax_type)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '세무 유형이 올바르지 않습니다 (3.3%, insurance, none 중 하나).'
                });
            }

            // 급여 금액 검증
            if (salary_type === 'monthly' && !base_salary) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '월급제는 기본급(base_salary) 입력이 필수입니다.'
                });
            }

            if ((salary_type === 'hourly' || salary_type === 'per_class') && !hourly_rate) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '시급/타임제는 시급(hourly_rate) 입력이 필수입니다.'
                });
            }

            // 사무보조 근무 설정 검증
            if (finalInstructorType === 'assistant') {
                if (!work_days || work_days.length === 0) {
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: '사무보조는 근무 요일(work_days) 입력이 필수입니다.'
                    });
                }
                if (!work_start_time || !work_end_time) {
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: '사무보조는 근무 시작/종료 시간 입력이 필수입니다.'
                    });
                }
            }

            // 민감 필드 암호화
            const encryptedName = encrypt(name);
            const encryptedPhone = encrypt(phone);
            const encryptedResidentNumber = resident_number ? encrypt(resident_number) : null;
            const encryptedAccountNumber = account_number ? encrypt(account_number) : null;
            const encryptedAddress = address ? encrypt(address) : null;

            // INSERT
            const [result] = await pool.execute(
                `INSERT INTO instructors (
                    academy_id,
                    name,
                    phone,
                    gender,
                    email,
                    resident_number,
                    hire_date,
                    salary_type,
                    instructor_type,
                    hourly_rate,
                    base_salary,
                    tax_type,
                    bank_name,
                    account_number,
                    address,
                    notes,
                    work_days,
                    work_start_time,
                    work_end_time,
                    status
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')`,
                [
                    req.user.academyId,
                    encryptedName,
                    encryptedPhone,
                    gender || null,
                    email || null,
                    encryptedResidentNumber,
                    hire_date || new Date().toISOString().split('T')[0],
                    salary_type,
                    finalInstructorType,
                    hourly_rate || 0,
                    base_salary || 0,
                    tax_type,
                    bank_name || null,
                    encryptedAccountNumber,
                    encryptedAddress,
                    notes || null,
                    work_days ? JSON.stringify(work_days) : null,
                    work_start_time || null,
                    work_end_time || null
                ]
            );

            // 생성된 강사 조회
            const [instructors] = await pool.execute(
                'SELECT * FROM instructors WHERE id = ?',
                [result.insertId]
            );

            syncPeakTrainerAsync(result.insertId);

            res.status(201).json({
                message: 'Instructor created successfully',
                instructor: instructors[0]
            });
        } catch (error) {
            logger.error('Error creating instructor:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '강사 등록에 실패했습니다.'
            });
        }
    });

    /**
     * PUT /paca/instructors/:id
     * 강사 수정 (전달된 필드만 dynamic update).
     * Access: instructors edit
     */
    router.put('/:id', verifyToken, checkPermission('instructors', 'edit'), async (req, res) => {
        const instructorId = parseInt(req.params.id);

        try {
            // 존재 확인
            const [instructors] = await pool.execute(
                'SELECT id FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructorId, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            const {
                name,
                phone,
                gender,
                email,
                resident_number,  // 주민번호 (세무용)
                hire_date,
                salary_type,
                instructor_type,  // 'teacher' | 'assistant'
                hourly_rate,
                base_salary,
                tax_type,
                bank_name,
                account_number,
                address,
                notes,
                status,
                // 사무보조용 필드
                work_days,        // [1, 3, 5] 형태
                work_start_time,  // 'HH:MM' 형태
                work_end_time     // 'HH:MM' 형태
            } = req.body;

            // 이메일 중복 확인 (변경 시)
            if (email) {
                const [existing] = await pool.execute(
                    'SELECT id FROM instructors WHERE email = ? AND academy_id = ? AND id != ? AND deleted_at IS NULL',
                    [email, req.user.academyId, instructorId]
                );

                if (existing.length > 0) {
                    return res.status(400).json({
                        error: 'Validation Error',
                        message: '이미 사용 중인 이메일입니다.'
                    });
                }
            }

            // 동적 update 빌드
            const updates = [];
            const params = [];

            if (name !== undefined) {
                updates.push('name = ?');
                params.push(encrypt(name));  // 암호화
            }
            if (phone !== undefined) {
                updates.push('phone = ?');
                params.push(encrypt(phone));  // 암호화
            }
            if (gender !== undefined) {
                updates.push('gender = ?');
                params.push(gender || null);
            }
            if (email !== undefined) {
                updates.push('email = ?');
                params.push(email);
            }
            if (resident_number !== undefined) {
                updates.push('resident_number = ?');
                params.push(resident_number ? encrypt(resident_number) : null);  // 암호화
            }
            if (hire_date !== undefined) {
                updates.push('hire_date = ?');
                params.push(hire_date);
            }
            if (salary_type !== undefined) {
                updates.push('salary_type = ?');
                params.push(salary_type);
            }
            if (hourly_rate !== undefined) {
                updates.push('hourly_rate = ?');
                params.push(hourly_rate);
            }
            if (base_salary !== undefined) {
                updates.push('base_salary = ?');
                params.push(base_salary);
            }
            if (tax_type !== undefined) {
                updates.push('tax_type = ?');
                params.push(tax_type);
            }
            if (bank_name !== undefined) {
                updates.push('bank_name = ?');
                params.push(bank_name);
            }
            if (account_number !== undefined) {
                updates.push('account_number = ?');
                params.push(account_number ? encrypt(account_number) : null);  // 암호화
            }
            if (address !== undefined) {
                updates.push('address = ?');
                params.push(address ? encrypt(address) : null);  // 암호화
            }
            if (notes !== undefined) {
                updates.push('notes = ?');
                params.push(notes);
            }
            if (status !== undefined) {
                updates.push('status = ?');
                params.push(status);
            }
            if (instructor_type !== undefined) {
                updates.push('instructor_type = ?');
                params.push(instructor_type);
            }
            if (work_days !== undefined) {
                updates.push('work_days = ?');
                params.push(work_days ? JSON.stringify(work_days) : null);
            }
            if (work_start_time !== undefined) {
                updates.push('work_start_time = ?');
                params.push(work_start_time || null);
            }
            if (work_end_time !== undefined) {
                updates.push('work_end_time = ?');
                params.push(work_end_time || null);
            }

            if (updates.length === 0) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: '수정할 항목이 없습니다.'
                });
            }

            updates.push('updated_at = NOW()');
            params.push(instructorId);

            await pool.execute(
                `UPDATE instructors SET ${updates.join(', ')} WHERE id = ?`,
                params
            );

            // 수정된 강사 조회
            const [updatedInstructors] = await pool.execute(
                'SELECT * FROM instructors WHERE id = ?',
                [instructorId]
            );

            syncPeakTrainerAsync(instructorId);

            res.json({
                message: 'Instructor updated successfully',
                instructor: updatedInstructors[0]
            });
        } catch (error) {
            logger.error('Error updating instructor:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '강사 정보 수정에 실패했습니다.'
            });
        }
    });

    /**
     * DELETE /paca/instructors/:id
     * 강사 soft delete.
     * Access: instructors edit
     */
    router.delete('/:id', verifyToken, checkPermission('instructors', 'edit'), async (req, res) => {
        const instructorId = parseInt(req.params.id);

        try {
            // 존재 확인
            const [instructors] = await pool.execute(
                'SELECT id, name FROM instructors WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
                [instructorId, req.user.academyId]
            );

            if (instructors.length === 0) {
                return res.status(404).json({
                    error: 'Not Found',
                    message: '강사 정보를 찾을 수 없습니다.'
                });
            }

            // soft delete
            await pool.execute(
                'UPDATE instructors SET deleted_at = NOW(), updated_at = NOW() WHERE id = ?',
                [instructorId]
            );

            syncPeakTrainerAsync(instructorId);

            res.json({
                message: 'Instructor deleted successfully',
                instructor: {
                    id: instructorId,
                    name: instructors[0].name
                }
            });
        } catch (error) {
            logger.error('Error deleting instructor:', error);
            res.status(500).json({
                error: 'Server Error',
                message: '강사 삭제에 실패했습니다.'
            });
        }
    });

};
