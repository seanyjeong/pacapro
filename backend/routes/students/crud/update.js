/**
 * routes/students/crud/update.js
 *
 * 학생 정보 수정 (PUT /paca/students/:id) — 18+ 필드 dynamic update + 학원비 자동 처리 +
 * 스케줄 재배정 + 체험생 trial_dates 분기 + pending→active 자동 학번 발급.
 *
 * ## Endpoint
 * - PUT /:id : 학생 정보 dynamic update.
 *
 * ## 인증
 * - verifyToken + checkPermission('students', 'edit') — owner / admin.
 *
 * ## DB 패턴 (ADR-005)
 * - `pool.execute(sql, params)` 통일 (총 25건 + 트랜잭션 X).
 * - 자동 스케줄 재배정 헬퍼 (`reassignStudentSchedules`) 첫 인자도 `pool` 로 정렬.
 *
 * ## 응답 표면 (ADR-013) — 보존 의무
 * - 200: `{message: 'Student updated successfully', student}` (기본) +
 *   상황별 옵션 root 키 (firstPaymentFromPending / trialAssignResult / paymentReassignResult /
 *   reassignResult / timeSlotReassignResult / scheduleDeleteResult / unpaidDeleteResult /
 *   schedulesDeleted / paymentsDeleted) — 프론트 `StudentUpdateResponse` (`{message, student}`) +
 *   `student-form.tsx` 가 옵션 키 직접 소비 (재배정 결과 토스트 표시).
 *   ⚠️ 모든 옵션 root 키 1:1 보존 — 변경 시 프론트 토스트 누락.
 * - 400/404: `{error, message}` 검증 메시지 영문 그대로 보존 (응답 표면 보존, 응답 통일 트랙으로 분리).
 *   404 만 ADR-003 한국어 적용 (`'학생 정보를 찾을 수 없습니다.'`).
 * - 5xx: `{error: 'Server Error', message: '학생 정보 수정에 실패했습니다.'}` (한국어, ADR-003).
 *
 * ## 보안 헬퍼 (ADR-007)
 * - `encrypt(value)` / `decryptFields(student, ENCRYPTED_FIELDS.students)` 시그니처 무변경.
 *
 * ## 후처리 분리
 * - 결제·스케줄 후처리는 `crud/update/` 모듈로 분리하고 이 파일은 요청 검증과 응답 계약을 담당한다.
 * - 신규생 일할 청구의 납부기한은 등록일이며, 이후 정기 청구부터 학생/학원 납부일을 적용한다.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    encrypt,
    decryptFields,
    ENCRYPTED_FIELDS,
    parseClassDaysWithSlots,
    extractDayNumbers,
    normalizeStudentClassDays,
    logger,
    logAudit,
    getAuditInfoFromReq
} = require('./_utils');
const { applyStudentUpdateEffects } = require('./update/effects');

module.exports = function(router) {

/**
 * PUT /paca/students/:id
 * Update student
 * Access: owner, admin
 */
router.put('/:id', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Check if student exists and get current values for audit logging
        const [students] = await pool.execute(
            `SELECT id, student_number, name, gender, student_type, phone, parent_phone,
                    school, grade, age, admission_type, class_days, weekly_count,
                    monthly_tuition, discount_rate, discount_reason, payment_due_day,
                    enrollment_date, address, notes, memo, status, time_slot,
                    rest_start_date, rest_end_date, rest_reason,
                    is_trial, trial_remaining, trial_dates
             FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        // 기존 class_days, status, time_slot 파싱
        const oldStatus = students[0].status;
        const oldTimeSlot = students[0].time_slot || 'evening';
        const oldClassDaysRaw = students[0].class_days
            ? (typeof students[0].class_days === 'string'
                ? JSON.parse(students[0].class_days)
                : students[0].class_days)
            : [];
        // 하위호환: 비교용 day 숫자 배열 추출
        const oldDayNumbers = extractDayNumbers(parseClassDaysWithSlots(oldClassDaysRaw, oldTimeSlot));

        const {
            student_number,
            name,
            gender,
            student_type,
            phone,
            parent_phone,
            school,
            grade,
            age,
            admission_type,
            class_days,
            weekly_count,
            monthly_tuition,
            discount_rate,
            discount_reason,
            payment_due_day,
            enrollment_date,
            address,
            notes,
            status,
            rest_start_date,
            rest_end_date,
            rest_reason,
            // 체험생 관련 필드
            is_trial,
            trial_remaining,
            trial_dates,
            // 시간대
            time_slot,
            // 메모
            memo,
            // 예약 적용 (YYYY-MM-DD)
            effective_from
        } = req.body;

        // Validate student_type
        if (student_type && !['exam', 'adult'].includes(student_type)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'student_type must be exam or adult'
            });
        }

        // Validate grade
        const validGrades = ['고1', '고2', '고3', 'N수'];
        if (grade && !validGrades.includes(grade)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'grade must be one of: 고1, 고2, 고3, N수'
            });
        }

        // Validate admission_type
        const validAdmissionTypes = ['regular', 'early', 'civil_service', 'military_academy', 'police_university'];
        if (admission_type && !validAdmissionTypes.includes(admission_type)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'admission_type must be regular, early, civil_service, military_academy, or police_university'
            });
        }

        // Validate time_slot
        const validTimeSlots = ['morning', 'afternoon', 'evening'];
        if (time_slot && !validTimeSlots.includes(time_slot)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'time_slot must be morning, afternoon, or evening'
            });
        }

        // Check if new student_number already exists (if changed)
        if (student_number) {
            const [existing] = await pool.execute(
                'SELECT id FROM students WHERE student_number = ? AND academy_id = ? AND id != ? AND deleted_at IS NULL',
                [student_number, req.user.academyId, studentId]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Student number already exists'
                });
            }
        }

        // pending/trial → active 전환 시 학번 자동 생성
        let autoStudentNumber = student_number;
        if (status === 'active' && (oldStatus === 'pending' || oldStatus === 'trial') && !student_number && !students[0].student_number) {
            const year = new Date().getFullYear();
            const [lastStudent] = await pool.execute(
                `SELECT student_number FROM students
                WHERE academy_id = ?
                AND student_number LIKE '${year}%'
                ORDER BY student_number DESC LIMIT 1`,
                [req.user.academyId]
            );

            if (lastStudent.length > 0 && lastStudent[0].student_number) {
                const lastNum = parseInt(lastStudent[0].student_number.slice(-3));
                autoStudentNumber = `${year}${String(lastNum + 1).padStart(3, '0')}`;
            } else {
                autoStudentNumber = `${year}001`;
            }
            logger.info(`[PUT /:id] Auto-generated student_number: ${autoStudentNumber} for student ${studentId}`);
        }

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (autoStudentNumber !== undefined) {
            updates.push('student_number = ?');
            params.push(autoStudentNumber);
        }
        if (name !== undefined) {
            updates.push('name = ?');
            params.push(encrypt(name));  // 암호화
        }
        if (gender !== undefined) {
            updates.push('gender = ?');
            params.push(gender);
        }
        if (student_type !== undefined) {
            updates.push('student_type = ?');
            params.push(student_type);
        }
        if (phone !== undefined) {
            updates.push('phone = ?');
            params.push(encrypt(phone));  // 암호화
        }
        if (parent_phone !== undefined) {
            updates.push('parent_phone = ?');
            params.push(parent_phone ? encrypt(parent_phone) : null);  // 암호화
        }
        if (school !== undefined) {
            updates.push('school = ?');
            params.push(school);
        }
        if (grade !== undefined) {
            updates.push('grade = ?');
            params.push(grade);
        }
        if (age !== undefined) {
            updates.push('age = ?');
            params.push(age);
        }
        if (admission_type !== undefined) {
            updates.push('admission_type = ?');
            params.push(admission_type);
        }
        // effective_from이 미래 달이면 예약 모드, 아니면 즉시 적용
        let isScheduledClassDays = false;
        if (class_days !== undefined) {
            const normalizedClassDays = parseClassDaysWithSlots(class_days, time_slot || oldTimeSlot || 'evening');

            if (effective_from) {
                const now = new Date();
                const currentMonthFirst = new Date(now.getFullYear(), now.getMonth(), 1);
                const effectiveDate = new Date(effective_from + 'T00:00:00');

                if (effectiveDate > currentMonthFirst) {
                    // 예약 모드: class_days_next에 저장, 현재 class_days 유지
                    isScheduledClassDays = true;
                    updates.push('class_days_next = ?');
                    params.push(JSON.stringify(normalizedClassDays));
                    updates.push('class_days_effective_from = ?');
                    params.push(effective_from);
                    logger.info(`[Student ${studentId}] Scheduled class_days change for ${effective_from}`);
                }
            }

            if (!isScheduledClassDays) {
                // 즉시 적용 모드
                updates.push('class_days = ?');
                params.push(JSON.stringify(normalizedClassDays));
                updates.push('class_days_next = NULL');
                updates.push('class_days_effective_from = NULL');
            }
        }
        if (weekly_count !== undefined && !isScheduledClassDays) {
            updates.push('weekly_count = ?');
            params.push(weekly_count);
        }
        if (monthly_tuition !== undefined) {
            updates.push('monthly_tuition = ?');
            params.push(monthly_tuition);
        }
        if (discount_rate !== undefined) {
            updates.push('discount_rate = ?');
            params.push(discount_rate);
        }
        if (discount_reason !== undefined) {
            updates.push('discount_reason = ?');
            params.push(discount_reason);
        }
        if (payment_due_day !== undefined) {
            updates.push('payment_due_day = ?');
            params.push(payment_due_day);
        }
        if (enrollment_date !== undefined) {
            updates.push('enrollment_date = ?');
            params.push(enrollment_date);
        }
        if (address !== undefined) {
            updates.push('address = ?');
            params.push(address ? encrypt(address) : null);  // 암호화
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }
        if (memo !== undefined) {
            updates.push('memo = ?');
            params.push(memo);
        }
        if (status !== undefined) {
            updates.push('status = ?');
            params.push(status);

            // 상태가 paused가 아니면 휴식 관련 필드 초기화
            if (status !== 'paused') {
                updates.push('rest_start_date = NULL');
                updates.push('rest_end_date = NULL');
                updates.push('rest_reason = NULL');
            }
        }
        if (rest_start_date !== undefined) {
            updates.push('rest_start_date = ?');
            params.push(rest_start_date || null);
        }
        if (rest_end_date !== undefined) {
            updates.push('rest_end_date = ?');
            params.push(rest_end_date || null);
        }
        if (rest_reason !== undefined) {
            updates.push('rest_reason = ?');
            params.push(rest_reason || null);
        }
        // 체험생 관련 필드
        if (is_trial !== undefined) {
            updates.push('is_trial = ?');
            params.push(is_trial);
        }
        if (trial_remaining !== undefined) {
            updates.push('trial_remaining = ?');
            params.push(trial_remaining);
        }
        if (trial_dates !== undefined) {
            updates.push('trial_dates = ?');
            params.push(JSON.stringify(trial_dates));
        }
        // 시간대
        if (time_slot !== undefined) {
            updates.push('time_slot = ?');
            params.push(time_slot);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'No fields to update'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(studentId);

        await pool.execute(
            `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Audit logging: 변경 전/후 값 기록
        const oldStudent = students[0];
        const oldValues = {};
        const newValues = {};
        const auditFields = {
            student_number: autoStudentNumber, name, gender, student_type, phone, parent_phone,
            school, grade, age, admission_type, weekly_count, monthly_tuition,
            discount_rate, discount_reason, payment_due_day, enrollment_date,
            address, notes, memo, status, time_slot,
            rest_start_date, rest_end_date, rest_reason,
            is_trial, trial_remaining
        };
        // 암호화 필드 복호화 비교
        const encryptedKeys = ['name', 'phone', 'parent_phone', 'address'];
        for (const [field, newVal] of Object.entries(auditFields)) {
            if (newVal === undefined) continue;
            let oldVal = oldStudent[field];
            if (encryptedKeys.includes(field) && oldVal) {
                try { oldVal = decrypt(oldVal); } catch { /* keep raw */ }
            }
            // 타입 맞춰서 비교
            if (String(oldVal ?? '') !== String(newVal ?? '')) {
                oldValues[field] = oldVal;
                newValues[field] = newVal;
            }
        }
        // class_days 별도 비교 (JSON)
        if (class_days !== undefined) {
            oldValues.class_days = oldClassDaysRaw;
            newValues.class_days = class_days;
        }
        // trial_dates 별도 비교 (JSON)
        if (trial_dates !== undefined) {
            const oldTrialDates = oldStudent.trial_dates
                ? (typeof oldStudent.trial_dates === 'string' ? JSON.parse(oldStudent.trial_dates) : oldStudent.trial_dates)
                : null;
            oldValues.trial_dates = oldTrialDates;
            newValues.trial_dates = trial_dates;
        }
        if (Object.keys(newValues).length > 0) {
            const auditInfo = getAuditInfoFromReq(req);
            logAudit({
                ...auditInfo,
                action: isScheduledClassDays ? 'schedule' : 'update',
                tableName: 'students',
                recordId: studentId,
                oldValues,
                newValues
            });
        }

        // Fetch updated student
        const [updatedStudents] = await pool.execute(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        const {
            reassignResult,
            trialAssignResult,
            paymentAdjustment,
            enrollmentDateRecalc,
            withdrawalInfo,
            pauseInfo,
            trialCancelInfo,
            pendingInfo,
        } = await applyStudentUpdateEffects({
            pool,
            studentId,
            academyId: req.user.academyId,
            classDays: class_days,
            timeSlot: time_slot,
            oldClassDaysRaw,
            oldDayNumbers,
            oldTimeSlot,
            isScheduledClassDays,
            updatedStudent: updatedStudents[0],
            monthlyTuition: monthly_tuition,
            discountRate: discount_rate,
            enrollmentDate: enrollment_date,
            oldStudent,
            isTrial: is_trial,
            trialDates: trial_dates,
            status,
            oldStatus,
        });
        // 민감 필드 복호화 후 응답
        const decryptedStudent = normalizeStudentClassDays(decryptFields(updatedStudents[0], ENCRYPTED_FIELDS.students));

        res.json({
            message: 'Student updated successfully',
            student: decryptedStudent,
            scheduleReassigned: reassignResult,
            trialScheduleAssigned: trialAssignResult,
            paymentAdjustment,
            enrollmentDateRecalc,
            withdrawalInfo,
            pauseInfo,
            trialCancelInfo,
            pendingInfo
        });
    } catch (error) {
        logger.error('Error updating student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 정보 수정에 실패했습니다.'
        });
    }
});

};
