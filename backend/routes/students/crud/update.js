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
 * ## 분리 미루기 (ADR-015)
 * - 본 endpoint 는 단일 모듈 임계 (~855줄) 초과지만 (1) 18+ 필드 camelCase/snake_case 호환 dynamic
 *   update + (2) status 전환 분기 (active / pending / trial / paused) + (3) 학원비 자동 처리
 *   (pending→active 일할계산 / monthly_tuition 변경 시 미납 UPDATE) + (4) 체험생 trial_dates 변경 시
 *   기존 미출석 삭제 + 재배정 + (5) class_days/time_slot 변경 시 reassignStudentSchedules 호출 +
 *   (6) 출석 처리된 일정 보존 + (7) 응답 옵션 root 키 8개 직렬화 강결합. 추가 sub-모듈 분리 보류 —
 *   응답 표면 + 동작 1:1 보존이 최우선. 응답 통일 트랙 진입 시 분리 검토.
 */

const {
    pool,
    verifyToken,
    checkPermission,
    encrypt,
    decryptFields,
    ENCRYPTED_FIELDS,
    calculateDueDate,
    parseClassDaysWithSlots,
    extractDayNumbers,
    normalizeStudentClassDays,
    reassignStudentSchedules,
    truncateToThousands,
    logger,
    logAudit,
    getAuditInfoFromReq
} = require('./_utils');

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

        // 현재 시간대 결정 (새 값 또는 기존 값)
        const currentTimeSlot = time_slot || oldTimeSlot;

        // class_days가 즉시 적용 모드로 변경되었으면 스케줄 재배정 (예약 모드면 스킵)
        let reassignResult = null;
        if (class_days !== undefined && !isScheduledClassDays) {
            const newClassDays = class_days || [];
            // 하위호환: 객체/숫자 배열 모두 day 숫자로 비교
            const newSlots = parseClassDaysWithSlots(newClassDays, currentTimeSlot);
            const newDayNumbers = extractDayNumbers(newSlots);

            // 요일 또는 시간대가 변경되었는지 확인
            const oldSlots = parseClassDaysWithSlots(oldClassDaysRaw, oldTimeSlot);
            const oldSet = new Set(oldDayNumbers);
            const newSet = new Set(newDayNumbers);
            const daysChanged = oldDayNumbers.length !== newDayNumbers.length ||
                              oldDayNumbers.some(d => !newSet.has(d)) ||
                              newDayNumbers.some(d => !oldSet.has(d));

            // 시간대 변경도 감지 (같은 요일이라도 시간대가 다르면 재배정)
            const timeSlotsChanged = !daysChanged && newSlots.some(ns => {
                const os = oldSlots.find(o => o.day === ns.day);
                return os && os.timeSlot !== ns.timeSlot;
            });

            if ((daysChanged || timeSlotsChanged) && newSlots.length > 0) {
                try {
                    reassignResult = await reassignStudentSchedules(
                        pool,
                        studentId,
                        req.user.academyId,
                        oldClassDaysRaw,
                        newClassDays,
                        currentTimeSlot
                    );
                } catch (reassignError) {
                    logger.error('Reassign failed:', reassignError);
                    // 재배정 실패해도 업데이트는 성공으로 처리
                }
            }
        }

        // time_slot(기본 시간대)만 변경되었으면 스케줄 재배정 판단
        // - class_days가 이미 객체 배열(per-day timeslot)이면 재배정 불필요 (각 요일에 이미 timeSlot 지정됨)
        // - class_days가 숫자 배열(레거시)이면 기본 시간대 변경 시 재배정 필요
        let timeSlotReassignResult = null;
        if (time_slot !== undefined && time_slot !== oldTimeSlot && class_days === undefined) {
            const currentClassDaysRaw = updatedStudents[0].class_days
                ? (typeof updatedStudents[0].class_days === 'string'
                    ? JSON.parse(updatedStudents[0].class_days)
                    : updatedStudents[0].class_days)
                : [];

            // 이미 객체 배열이면 각 요일에 timeSlot이 지정되어 있으므로 재배정 생략
            const isAlreadyObjectArray = Array.isArray(currentClassDaysRaw)
                && currentClassDaysRaw.length > 0
                && typeof currentClassDaysRaw[0] === 'object'
                && currentClassDaysRaw[0].day !== undefined;

            if (currentClassDaysRaw.length > 0 && !isAlreadyObjectArray) {
                try {
                    // 레거시 숫자 배열: 새 기본 시간대로 재배정
                    timeSlotReassignResult = await reassignStudentSchedules(
                        pool,
                        studentId,
                        req.user.academyId,
                        currentClassDaysRaw,
                        currentClassDaysRaw,
                        time_slot
                    );
                } catch (reassignError) {
                    logger.error('Time slot reassign failed:', reassignError);
                    // 재배정 실패해도 업데이트는 성공으로 처리
                }
            }
        }

        // 수강료 변경 시 현재 월 이후 pending 결제 내역 자동 업데이트
        if (monthly_tuition !== undefined || discount_rate !== undefined) {
            try {
                const newTuition = monthly_tuition !== undefined ? monthly_tuition : updatedStudents[0].monthly_tuition;
                const newDiscountRate = discount_rate !== undefined ? discount_rate : (updatedStudents[0].discount_rate || 0);
                const finalTuition = newTuition * (1 - newDiscountRate / 100);

                const currentYearMonth = new Date().toISOString().slice(0, 7); // YYYY-MM

                await pool.execute(
                    `UPDATE student_payments
                     SET base_amount = ?,
                         final_amount = ?,
                         updated_at = NOW()
                     WHERE student_id = ?
                       AND academy_id = ?
                       AND \`year_month\` >= ?
                       AND payment_status = 'pending'
                       AND payment_type = 'monthly'`,
                    [newTuition, finalTuition, studentId, req.user.academyId, currentYearMonth]
                );
                logger.info(`[Student ${studentId}] Pending payments updated: ${newTuition}원 (할인 후: ${finalTuition}원)`);
            } catch (paymentUpdateError) {
                logger.error('Payment update failed:', paymentUpdateError);
                // 결제 업데이트 실패해도 학생 정보 업데이트는 성공으로 처리
            }
        }

        // 등록일 변경 시 첫 달 일할계산 학원비 재계산 (미납 건만, create.js 일할계산과 동일 로직)
        let enrollmentDateRecalc = null;
        const oldEnrollmentDate = oldStudent.enrollment_date; // dateStrings: 'YYYY-MM-DD'
        if (enrollment_date !== undefined && enrollment_date && oldEnrollmentDate
            && String(enrollment_date) !== String(oldEnrollmentDate)) {
            try {
                const oldYearMonth = String(oldEnrollmentDate).slice(0, 7);

                // 기존 등록월의 일할계산 학원비 조회
                const [proratedRows] = await pool.execute(
                    `SELECT id, payment_status FROM student_payments
                     WHERE student_id = ? AND academy_id = ?
                       AND \`year_month\` = ? AND payment_type = 'monthly'
                       AND (is_prorated = 1 OR description LIKE '%일할계산%')`,
                    [studentId, req.user.academyId, oldYearMonth]
                );

                if (proratedRows.length > 0) {
                    const proratedPayment = proratedRows[0];
                    const enrollDate = new Date(enrollment_date);
                    const year = enrollDate.getFullYear();
                    const month = enrollDate.getMonth() + 1;
                    const newYearMonth = `${year}-${String(month).padStart(2, '0')}`;

                    // 새 등록월에 다른 월 학원비가 이미 있으면 중복 방지를 위해 스킵
                    let duplicateRows = [];
                    if (newYearMonth !== oldYearMonth) {
                        const [dup] = await pool.execute(
                            `SELECT id FROM student_payments
                             WHERE student_id = ? AND academy_id = ?
                               AND \`year_month\` = ? AND payment_type = 'monthly' AND id != ?`,
                            [studentId, req.user.academyId, newYearMonth, proratedPayment.id]
                        );
                        duplicateRows = dup;
                    }

                    if (proratedPayment.payment_status !== 'pending') {
                        enrollmentDateRecalc = {
                            type: 'skipped',
                            message: '첫 달 학원비가 이미 납부되어 재계산하지 않았습니다. 결제 내역에서 직접 수정해주세요.'
                        };
                    } else if (duplicateRows.length > 0) {
                        enrollmentDateRecalc = {
                            type: 'skipped',
                            message: `${month}월 학원비가 이미 있어 재계산하지 않았습니다. 결제 내역에서 직접 정리해주세요.`
                        };
                    } else {
                        const studentData = updatedStudents[0];
                        const baseAmount = parseFloat(studentData.monthly_tuition) || 0;
                        const discountRateNum = parseFloat(studentData.discount_rate) || 0;
                        const lastDayOfMonth = new Date(year, month, 0).getDate();
                        const enrollDay = enrollDate.getDate();
                        const remainingDays = lastDayOfMonth - enrollDay + 1;

                        const currentClassDaysRaw = studentData.class_days
                            ? (typeof studentData.class_days === 'string'
                                ? JSON.parse(studentData.class_days)
                                : studentData.class_days)
                            : [];
                        const parsedClassDays = extractDayNumbers(parseClassDaysWithSlots(currentClassDaysRaw, currentTimeSlot));

                        // 등록일부터 말일까지 수업일수 / 전체 월 수업일수
                        let classDaysCount = 0;
                        for (let d = enrollDay; d <= lastDayOfMonth; d++) {
                            if (parsedClassDays.includes(new Date(year, month - 1, d).getDay())) classDaysCount++;
                        }
                        let totalClassDaysInMonth = 0;
                        for (let d = 1; d <= lastDayOfMonth; d++) {
                            if (parsedClassDays.includes(new Date(year, month - 1, d).getDay())) totalClassDaysInMonth++;
                        }

                        let proRatedAmount;
                        if (totalClassDaysInMonth > 0 && classDaysCount > 0) {
                            proRatedAmount = truncateToThousands(baseAmount / totalClassDaysInMonth * classDaysCount);
                        } else {
                            // 수업요일 설정 없으면 일수 기준
                            proRatedAmount = truncateToThousands(baseAmount * remainingDays / lastDayOfMonth);
                        }
                        const discountAmount = truncateToThousands(proRatedAmount * discountRateNum / 100);
                        const finalAmount = proRatedAmount - discountAmount;

                        const [academySettings] = await pool.execute(
                            'SELECT tuition_due_day FROM academy_settings WHERE academy_id = ?',
                            [req.user.academyId]
                        );
                        const academyDueDay = academySettings.length > 0 ? academySettings[0].tuition_due_day : 5;
                        const studentDueDay = studentData.payment_due_day || academyDueDay;

                        let dueDateStr = calculateDueDate(year, month, studentDueDay, parsedClassDays);
                        if (new Date(dueDateStr) < enrollDate) {
                            const grace = new Date(enrollDate);
                            grace.setDate(grace.getDate() + 7);
                            dueDateStr = grace.toISOString().split('T')[0];
                        }

                        await pool.execute(
                            `UPDATE student_payments
                             SET \`year_month\` = ?, target_year = ?, target_month = ?,
                                 base_amount = ?, discount_amount = ?, final_amount = ?,
                                 is_prorated = 1, proration_details = ?,
                                 due_date = ?, description = ?, updated_at = NOW()
                             WHERE id = ?`,
                            [
                                newYearMonth, year, month,
                                proRatedAmount, discountAmount, finalAmount,
                                JSON.stringify({ enrollDay, remainingDays, totalDays: lastDayOfMonth, classCountInPeriod: classDaysCount, totalClassDaysInMonth }),
                                dueDateStr, `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`,
                                proratedPayment.id
                            ]
                        );
                        enrollmentDateRecalc = {
                            type: 'recalculated',
                            message: `등록일 변경으로 첫 달 학원비 재계산: ${finalAmount.toLocaleString()}원 (${enrollDay}일 등록)`,
                            finalAmount
                        };
                        logger.info(`[Student ${studentId}] Prorated payment recalculated for enrollment_date change ${oldEnrollmentDate} → ${enrollment_date}: ${finalAmount}원`);
                    }
                }
            } catch (recalcError) {
                logger.error('Enrollment date payment recalc failed:', recalcError);
                // 재계산 실패해도 학생 정보 업데이트는 성공으로 처리
            }
        }

        // 체험생 trial_dates가 변경되었으면 스케줄 재배정
        let trialAssignResult = null;
        if (is_trial && trial_dates !== undefined && trial_dates.length > 0) {
            try {
                // 기존 미출석 스케줄 삭제
                await pool.execute(
                    `DELETE a FROM attendance a
                     JOIN class_schedules cs ON a.class_schedule_id = cs.id
                     WHERE a.student_id = ?
                     AND cs.academy_id = ?
                     AND a.attendance_status IS NULL`,
                    [studentId, req.user.academyId]
                );

                // 미출석 일정만 새로 배정 (출석 완료된 일정은 이미 attendance에 남아있음)
                let trialAssigned = 0;
                for (const trialDate of trial_dates) {
                    const { date, time_slot, attended } = trialDate;
                    if (!date || !time_slot) continue;
                    if (attended) continue; // 출석 완료된 일정은 스킵

                    let [schedules] = await pool.execute(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [req.user.academyId, date, time_slot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        const [createResult] = await pool.execute(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot)
                             VALUES (?, ?, ?)`,
                            [req.user.academyId, date, time_slot]
                        );
                        scheduleId = createResult.insertId;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    await pool.execute(
                        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                         VALUES (?, ?, NULL)
                         ON DUPLICATE KEY UPDATE attendance_status = attendance_status`,
                        [scheduleId, studentId]
                    );
                    trialAssigned++;
                }
                trialAssignResult = { assigned: trialAssigned };
                logger.info(`[Trial] Student ${studentId}: reassigned ${trialAssigned} unattended schedules`);
            } catch (trialError) {
                logger.error('Trial schedule reassign failed:', trialError);
            }
        }


        // pending → active 전환 시 첫 달 학원비 자동 생성
        let firstPaymentFromPending = null;
            logger.info(`[Debug] pending->active check: status=${status}, oldStatus=${oldStatus}, monthly_tuition=${monthly_tuition} (type: ${typeof monthly_tuition})`);
        if (status === 'active' && (oldStatus === 'pending' || oldStatus === 'trial') && monthly_tuition && monthly_tuition > 0) {
            try {
                const enrollDate = new Date(enrollment_date || new Date().toISOString().split('T')[0]);
                const year = enrollDate.getFullYear();
                const month = enrollDate.getMonth() + 1;

                const [academySettings] = await pool.execute(
                    'SELECT tuition_due_day FROM academy_settings WHERE academy_id = ?',
                    [req.user.academyId]
                );
                const academyDueDay = academySettings.length > 0 ? academySettings[0].tuition_due_day : 5;
                const studentDueDay = payment_due_day || academyDueDay;

                // 이미 해당 월 학원비가 있는지 확인
                const [existingPayment] = await pool.execute(
                    'SELECT id FROM student_payments WHERE student_id = ? AND target_year = ? AND target_month = ?',
                    [studentId, year, month]
                );

                if (existingPayment.length === 0) {
                    const lastDayOfMonth = new Date(year, month, 0).getDate();
                    const enrollDay = enrollDate.getDate();
                    const remainingDays = lastDayOfMonth - enrollDay + 1;

                    const newDayNums = extractDayNumbers(parseClassDaysWithSlots(class_days || [], currentTimeSlot));
                    let classCountInPeriod = 0;
                    for (let d = enrollDay; d <= lastDayOfMonth; d++) {
                        const date = new Date(year, month - 1, d);
                        const dayOfWeek = date.getDay();
                        if (newDayNums.includes(dayOfWeek)) classCountInPeriod++;
                    }
                    const totalClassDaysInMonth = (() => {
                        let count = 0;
                        for (let d = 1; d <= lastDayOfMonth; d++) {
                            const date = new Date(year, month - 1, d);
                            if (newDayNums.includes(date.getDay())) count++;
                        }
                        return count;
                    })();

                    const proratedAmount = totalClassDaysInMonth > 0
                        ? Math.floor(monthly_tuition * classCountInPeriod / totalClassDaysInMonth / 1000) * 1000
                        : monthly_tuition;
                    const discountAmt = discount_rate ? Math.floor(proratedAmount * discount_rate / 100 / 1000) * 1000 : 0;
                    const finalAmount = proratedAmount - discountAmt;
                    let dueDate = new Date(year, month - 1, Math.min(studentDueDay, lastDayOfMonth));
                    // 납부일이 등록일보다 이전이면 등록일+7일
                    if (dueDate < enrollDate) {
                        dueDate = new Date(enrollDate);
                        dueDate.setDate(dueDate.getDate() + 7);
                    }
                    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                    const description = `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`;

                    await pool.execute(
                        `INSERT INTO student_payments (
                            student_id, academy_id, \`year_month\`, payment_type, target_year, target_month,
                            base_amount, discount_amount, additional_amount, final_amount,
                            is_prorated, proration_details, due_date, payment_status, description
                        ) VALUES (?, ?, ?, 'monthly', ?, ?, ?, ?, 0, ?, ?, ?, ?, 'pending', ?)`,
                        [
                            studentId, req.user.academyId, yearMonth, year, month,
                            proratedAmount, discountAmt, finalAmount,
                            1, JSON.stringify({ enrollDay, remainingDays, totalDays: lastDayOfMonth, classCountInPeriod, totalClassDaysInMonth }),
                            dueDate, description
                        ]
                    );
                    logger.info(`[Student ${studentId}] Payment created from pending: ${finalAmount}원 (${description})`);
                }
            } catch (paymentError) {
                logger.error('Pending→Active payment creation failed:', paymentError);
            }
        }
        // 휴원 처리 (active → paused) 시 학원비 조정
        let paymentAdjustment = null;
        if (status === 'paused' && oldStatus === 'active') {
            try {
                const now = new Date();
                const currentYear = now.getFullYear();
                const currentMonth = now.getMonth() + 1;

                // 학생의 주간 수업 횟수 (weekly_count) 가져오기
                const studentData = updatedStudents[0];
                const weeklyCount = studentData.weekly_count || 2;
                const monthlyTotal = weeklyCount * 4; // 월 총 수업 횟수
                const monthlyTuition = studentData.monthly_tuition || 0;

                // 이번 달 출석 횟수 조회
                const [attendanceCount] = await pool.execute(
                    `SELECT COUNT(*) as count FROM attendance a
                     JOIN class_schedules cs ON a.class_schedule_id = cs.id
                     WHERE a.student_id = ?
                     AND cs.academy_id = ?
                     AND YEAR(cs.class_date) = ?
                     AND MONTH(cs.class_date) = ?
                     AND a.attendance_status IN ('present', 'late')`,
                    [studentId, req.user.academyId, currentYear, currentMonth]
                );
                const attendedCount = attendanceCount[0].count;

                // 이번 달 학원비 조회
                const [currentPayment] = await pool.execute(
                    `SELECT id, amount, status, paid_amount FROM payments
                     WHERE student_id = ?
                     AND academy_id = ?
                     AND year = ?
                     AND month = ?`,
                    [studentId, req.user.academyId, currentYear, currentMonth]
                );

                if (currentPayment.length > 0) {
                    const payment = currentPayment[0];
                    const proratedAmount = Math.floor((monthlyTuition * attendedCount / monthlyTotal) / 1000) * 1000;

                    if (payment.status === 'paid') {
                        // 납부 완료 상태: 남은 수업 횟수만큼 이월 크레딧 생성
                        const remainingCount = monthlyTotal - attendedCount;
                        const creditAmount = Math.floor((monthlyTuition * remainingCount / monthlyTotal) / 1000) * 1000;

                        if (creditAmount > 0) {
                            await pool.execute(
                                `INSERT INTO rest_credits (student_id, academy_id, original_amount, remaining_amount, reason, created_at)
                                 VALUES (?, ?, ?, ?, ?, NOW())`,
                                [studentId, req.user.academyId, creditAmount, creditAmount,
                                 `${currentYear}년 ${currentMonth}월 휴원 이월 (${remainingCount}/${monthlyTotal}회)`]
                            );
                            paymentAdjustment = {
                                type: 'credit',
                                message: `납부완료 학원비 이월: ${creditAmount.toLocaleString()}원 (${remainingCount}회분)`,
                                creditAmount
                            };
                        }
                    } else {
                        // 미납 상태: 출석 횟수만큼 일할계산으로 금액 수정
                        if (attendedCount === 0) {
                            // 수업 안 받았으면 학원비 삭제
                            await pool.execute(
                                'DELETE FROM payments WHERE id = ?',
                                [payment.id]
                            );
                            paymentAdjustment = {
                                type: 'deleted',
                                message: '수업 미진행으로 학원비 삭제됨'
                            };
                        } else {
                            // 출석한 만큼만 금액 수정
                            await pool.execute(
                                `UPDATE payments SET amount = ?, description = ?, updated_at = NOW()
                                 WHERE id = ?`,
                                [proratedAmount,
                                 `${currentYear}년 ${currentMonth}월 수강료 (휴원 일할: ${attendedCount}/${monthlyTotal}회)`,
                                 payment.id]
                            );
                            paymentAdjustment = {
                                type: 'prorated',
                                message: `일할계산 적용: ${proratedAmount.toLocaleString()}원 (${attendedCount}/${monthlyTotal}회)`,
                                originalAmount: payment.amount,
                                proratedAmount
                            };
                        }
                    }
                }
            } catch (paymentError) {
                logger.error('Payment adjustment failed:', paymentError);
            }
        }

        // 퇴원/졸업 처리 (→ withdrawn/graduated) 시 미납 학원비 삭제 + 시즌 등록 취소 + 스케줄 삭제
        let withdrawalInfo = null;
        if (status === 'withdrawn' || status === 'graduated') {
            try {
                // 미납 학원비 확인
                const [unpaidPayments] = await pool.execute(
                    `SELECT id, final_amount FROM student_payments
                     WHERE student_id = ?
                     AND academy_id = ?
                     AND payment_status != 'paid'`,
                    [studentId, req.user.academyId]
                );

                if (unpaidPayments.length > 0) {
                    const totalUnpaid = unpaidPayments.reduce((sum, p) => sum + parseFloat(p.final_amount || 0), 0);

                    // 미납 학원비 삭제
                    await pool.execute(
                        `DELETE FROM student_payments WHERE student_id = ? AND academy_id = ? AND payment_status != 'paid'`,
                        [studentId, req.user.academyId]
                    );

                    withdrawalInfo = {
                        deletedPayments: unpaidPayments.length,
                        totalUnpaidAmount: totalUnpaid,
                        message: `미납 학원비 ${unpaidPayments.length}건 (${totalUnpaid.toLocaleString()}원) 삭제됨`
                    };
                }

                // 시즌 등록 취소 (진행 중인 시즌만)
                const [seasonEnrollments] = await pool.execute(
                    `SELECT ss.id, ss.season_id, ss.season_fee, ss.payment_status, s.season_name
                     FROM student_seasons ss
                     JOIN seasons s ON ss.season_id = s.id
                     WHERE ss.student_id = ?
                     AND s.academy_id = ?
                     AND ss.status IN ('registered', 'active')`,
                    [studentId, req.user.academyId]
                );

                if (seasonEnrollments.length > 0) {
                    // 시즌 등록 상태를 'cancelled'로 변경
                    const enrollmentIds = seasonEnrollments.map(e => e.id);
                    await pool.execute(
                        `UPDATE student_seasons SET status = 'cancelled', updated_at = NOW() WHERE id IN (?)`,
                        [enrollmentIds]
                    );

                    withdrawalInfo = withdrawalInfo || {};
                    withdrawalInfo.cancelledSeasons = seasonEnrollments.map(e => ({
                        id: e.id,
                        season_name: e.season_name,
                        season_fee: e.season_fee,
                        payment_status: e.payment_status
                    }));
                    withdrawalInfo.seasonMessage = `시즌 등록 ${seasonEnrollments.length}건 취소됨`;
                }

                // 미래 스케줄(출석 기록)에서 제거
                const today = new Date().toISOString().split('T')[0];
                const [scheduleDeleteResult] = await pool.execute(
                    `DELETE a FROM attendance a
                     JOIN class_schedules cs ON a.class_schedule_id = cs.id
                     WHERE a.student_id = ?
                     AND cs.academy_id = ?
                     AND cs.class_date >= ?
                     AND (a.attendance_status IS NULL OR a.attendance_status = 'absent')`,
                    [studentId, req.user.academyId, today]
                );

                if (scheduleDeleteResult.affectedRows > 0) {
                    withdrawalInfo = withdrawalInfo || {};
                    withdrawalInfo.deletedSchedules = scheduleDeleteResult.affectedRows;
                    withdrawalInfo.scheduleMessage = `스케줄 ${scheduleDeleteResult.affectedRows}건 삭제됨`;
                }
            } catch (withdrawError) {
                logger.error('Withdrawal payment cleanup failed:', withdrawError);
            }
        }

        // 휴원 처리 (→ paused) 시 출결 정리 (사장님 확정 2026-05-04, 퇴원과 동일):
        //  - 과거 (< today): 보존 (이력)
        //  - 당일 (= today): 무조건 삭제 (체크된 것도)
        //  - 미래 (> today): 미체크 (NULL) 만 삭제
        let pauseInfo = null;
        if (status === 'paused' && oldStatus !== 'paused') {
            try {
                const today = new Date().toISOString().split('T')[0];
                const [deleteResult] = await pool.execute(
                    `DELETE a FROM attendance a
                     JOIN class_schedules cs ON a.class_schedule_id = cs.id
                     WHERE a.student_id = ?
                       AND cs.academy_id = ?
                       AND (
                         cs.class_date = ?
                         OR (cs.class_date > ? AND a.attendance_status IS NULL)
                       )`,
                    [studentId, req.user.academyId, today, today]
                );

                if (deleteResult.affectedRows > 0) {
                    pauseInfo = {
                        deletedSchedules: deleteResult.affectedRows,
                        message: `미래 스케줄 ${deleteResult.affectedRows}건 삭제됨`
                    };
                }
            } catch (pauseError) {
                logger.error('Pause schedule cleanup failed:', pauseError);
            }
        }

        // 체험 해제 (trial → pending 또는 is_trial false) 시 미래 스케줄에서 제거
        let trialCancelInfo = null;
        if (oldStatus === 'trial' && status === 'pending') {
            try {
                const today = new Date().toISOString().split('T')[0];
                const [deleteResult] = await pool.execute(
                    `DELETE a FROM attendance a
                     JOIN class_schedules cs ON a.class_schedule_id = cs.id
                     WHERE a.student_id = ?
                     AND cs.academy_id = ?
                     AND cs.class_date >= ?
                     AND a.attendance_status IS NULL`,
                    [studentId, req.user.academyId, today]
                );

                if (deleteResult.affectedRows > 0) {
                    trialCancelInfo = {
                        deletedSchedules: deleteResult.affectedRows,
                        message: `체험 스케줄 ${deleteResult.affectedRows}건 삭제됨`
                    };
                    logger.info(`[Trial Cancel] Student ${studentId}: deleted ${deleteResult.affectedRows} future schedules`);
                }
            } catch (trialCancelError) {
                logger.error('Trial cancel schedule cleanup failed:', trialCancelError);
            }
        }

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
            trialCancelInfo
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
