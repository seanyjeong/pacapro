/**
 * routes/students/crud/create.js
 *
 * 학생 등록 (POST /paca/students) — 26 컬럼 INSERT + 일할계산 + 학원비 자동 생성 + 스케줄 배정.
 *
 * ## Endpoint
 * - POST / : 신규 학생 등록.
 *
 * ## 인증
 * - verifyToken + checkPermission('students', 'edit') — owner / admin.
 *
 * ## DB 패턴 (ADR-005)
 * - `pool.execute(sql, params)` 통일 (총 13건: 학생번호 중복 / 동일학생 / 동명학생 / 학번 자동발급 /
 *   INSERT students / SELECT inserted / INSERT student_payments /
 *   SELECT inserted payment / 체험생 trial 스케줄 4건).
 * - 자동 스케줄 배정 헬퍼 (`autoAssignStudentToSchedules`) 첫 인자도 `pool` 로 정렬.
 *
 * ## 응답 표면 (ADR-013) — 보존 의무
 * - 201: `{message, student, firstPayment, autoAssigned}` (4 root keys) —
 *   프론트 `StudentCreateResponse` (`{message, student}`) + 추가 옵션 키.
 *   * `is_trial=true` 시 message = 'Trial student created successfully', 외에는 'Student created successfully'.
 *   * `firstPayment` = 일할계산 학원비 row (체험생 / monthly_tuition 0 / 미설정 시 null).
 *   * `autoAssigned` = `{assigned, created}` (체험생 trial_dates 또는 정식 학생 자동 배정 결과).
 * - 400 SAME_NAME_EXISTS 409: `{error: 'Same Name Warning', code: 'SAME_NAME_EXISTS', message, existingStudent}`
 *   (학생폼 confirm_force=true 재호출 분기 — 프론트가 code 직접 검사).
 * - 400 검증/중복: `{error, message}` 영문 메시지 보존 (프론트 화면 토스트 호환).
 *   ⚠️ ADR-003 (한국어 메시지) 적용은 응답 통일 트랙 (프론트 동시 수정) 으로 분리.
 * - 5xx: `{error: 'Server Error', message: '학생 등록에 실패했습니다.'}` (한국어, ADR-003).
 *
 * ## 보안 헬퍼 (ADR-007)
 * - `encrypt(value)` 시그니처 무변경 (name / phone / parent_phone / address 4건 암호화).
 * - `decryptFields(student, ENCRYPTED_FIELDS.students)` 시그니처 무변경 (응답 시 복호화).
 *
 * ## 첫 달 납부기한
 * - 신규생 일할 청구는 등록과 동시에 수납 대상이므로 등록일을 납부기한으로 사용한다.
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
    autoAssignStudentToSchedules,
    truncateToThousands,
    logger
} = require('./_utils');
const {
    getKoreaDateText,
    resolveProratedPaymentDueDate,
} = require('../../../utils/proratedPaymentDueDate');

module.exports = function(router) {

/**
 * POST /paca/students
 * Create new student
 * Access: owner, admin
 */
router.post('/', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    try {
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
            // 체험생 관련 필드
            is_trial,
            trial_remaining,
            trial_dates,
            // 시간대
            time_slot,
            // 메모
            memo
        } = req.body;

        // Validation
        if (!name || !phone) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Required fields: name, phone'
            });
        }

        // Validate student_type
        const validStudentTypes = ['exam', 'adult'];
        if (student_type && !validStudentTypes.includes(student_type)) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'student_type must be exam or adult'
            });
        }

        // Validate grade (for exam students)
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

        // Check if student_number already exists
        if (student_number) {
            const [existing] = await pool.execute(
                'SELECT id FROM students WHERE student_number = ? AND academy_id = ? AND deleted_at IS NULL',
                [student_number, req.user.academyId]
            );

            if (existing.length > 0) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Student number already exists'
                });
            }
        }

        // Check for duplicate student (same name + phone)
        const [duplicateStudent] = await pool.execute(
            `SELECT id, name, phone, school FROM students
             WHERE academy_id = ?
             AND name = ?
             AND phone = ?
             AND deleted_at IS NULL`,
            [req.user.academyId, name, phone]
        );

        if (duplicateStudent.length > 0) {
            return res.status(400).json({
                error: 'Duplicate Error',
                message: `이미 등록된 학생입니다. (이름: ${name}, 전화: ${phone})`
            });
        }

        // Check for same name (warning only, not blocking)
        const [sameNameStudent] = await pool.execute(
            `SELECT id, name, phone, gender FROM students
             WHERE academy_id = ?
             AND name = ?
             AND deleted_at IS NULL`,
            [req.user.academyId, name]
        );

        // 같은 이름 + 같은 성별인데, 전화번호가 다른 경우 경고
        const confirmForce = req.body.confirm_force;
        if (sameNameStudent.length > 0 && !confirmForce) {
            const existingStudent = sameNameStudent[0];
            // 같은 성별인 경우만 경고 (성별이 없으면 무조건 경고)
            if (!gender || !existingStudent.gender || gender === existingStudent.gender) {
                return res.status(409).json({
                    error: 'Same Name Warning',
                    code: 'SAME_NAME_EXISTS',
                    message: `같은 이름의 학생이 이미 존재합니다.`,
                    existingStudent: {
                        name: existingStudent.name,
                        phone: existingStudent.phone,
                        gender: existingStudent.gender
                    }
                });
            }
        }

        // Generate student number if not provided
        let finalStudentNumber = student_number;
        if (!finalStudentNumber) {
            const year = new Date().getFullYear();
            const [lastStudent] = await pool.execute(
                `SELECT student_number FROM students
                WHERE academy_id = ?
                AND student_number LIKE '${year}%'
                ORDER BY student_number DESC LIMIT 1`,
                [req.user.academyId]
            );

            if (lastStudent.length > 0) {
                const lastNum = parseInt(lastStudent[0].student_number.slice(-3));
                finalStudentNumber = `${year}${String(lastNum + 1).padStart(3, '0')}`;
            } else {
                finalStudentNumber = `${year}001`;
            }
        }

        // 민감 필드 암호화
        const encryptedName = encrypt(name);
        const encryptedPhone = encrypt(phone);
        const encryptedParentPhone = parent_phone ? encrypt(parent_phone) : null;
        const encryptedAddress = address ? encrypt(address) : null;

        // Insert student
        const [result] = await pool.execute(
            `INSERT INTO students (
                academy_id,
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
                is_trial,
                trial_remaining,
                trial_dates,
                time_slot,
                memo
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                req.user.academyId,
                finalStudentNumber,
                encryptedName,
                gender || null,
                student_type || 'exam',
                encryptedPhone,
                encryptedParentPhone,
                school || null,
                grade || null,
                age || null,
                admission_type || 'regular',
                JSON.stringify(parseClassDaysWithSlots(class_days || [], time_slot || 'evening')),
                weekly_count || 0,
                is_trial ? 0 : (monthly_tuition || 0),  // 체험생은 학원비 0
                discount_rate || 0,
                discount_reason || null,
                payment_due_day || null,
                enrollment_date || new Date().toISOString().split('T')[0],
                encryptedAddress,
                notes || null,
                is_trial ? 'trial' : 'active',
                is_trial ? true : false,
                is_trial ? (trial_remaining || 2) : null,
                is_trial ? JSON.stringify(trial_dates || []) : null,
                time_slot || 'evening',
                memo || null
            ]
        );

        // Fetch created student
        const [students] = await pool.execute(
            'SELECT * FROM students WHERE id = ?',
            [result.insertId]
        );

        const createdStudent = students[0];

        // 첫 달 학원비 자동 생성 (일할계산) - 체험생은 제외
        let firstPayment = null;
        if (!is_trial && monthly_tuition && monthly_tuition > 0) {
            const enrollmentDateText = enrollment_date || getKoreaDateText();
            const enrollDate = new Date(`${enrollmentDateText}T00:00:00`);
            const year = enrollDate.getFullYear();
            const month = enrollDate.getMonth() + 1;

            // 일할계산: 등록일부터 말일까지
            const lastDayOfMonth = new Date(year, month, 0).getDate();
            const enrollDay = enrollDate.getDate();
            const remainingDays = lastDayOfMonth - enrollDay + 1;

            // 수업 요일 계산 (등록일부터 말일까지 수업일수)
            let classDaysCount = 0;
            const parsedClassDays = extractDayNumbers(parseClassDaysWithSlots(class_days || [], time_slot || 'evening'));
            for (let d = enrollDay; d <= lastDayOfMonth; d++) {
                const checkDate = new Date(year, month - 1, d);
                const dayOfWeek = checkDate.getDay();
                if (parsedClassDays.includes(dayOfWeek)) {
                    classDaysCount++;
                }
            }

            // 전체 월 수업일수 계산
            let totalClassDaysInMonth = 0;
            for (let d = 1; d <= lastDayOfMonth; d++) {
                const checkDate = new Date(year, month - 1, d);
                const dayOfWeek = checkDate.getDay();
                if (parsedClassDays.includes(dayOfWeek)) {
                    totalClassDaysInMonth++;
                }
            }

            // 일할계산 금액 (천원 단위 절삭)
            const baseAmount = parseFloat(monthly_tuition);
            const discountRateNum = parseFloat(discount_rate) || 0;
            let proRatedAmount;

            if (totalClassDaysInMonth > 0 && classDaysCount > 0) {
                const dailyRate = baseAmount / totalClassDaysInMonth;
                proRatedAmount = truncateToThousands(dailyRate * classDaysCount);
            } else {
                // 수업요일 설정 없으면 일수 기준
                proRatedAmount = truncateToThousands(baseAmount * remainingDays / lastDayOfMonth);
            }

            // 할인 적용 (천원 단위 절삭)
            const discountAmount = truncateToThousands(proRatedAmount * discountRateNum / 100);
            const finalAmount = proRatedAmount - discountAmount;

            const dueDateStr = resolveProratedPaymentDueDate(enrollmentDateText);

            // 학원비 레코드 생성
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const [paymentResult] = await pool.execute(
                `INSERT INTO student_payments (
                    student_id,
                    academy_id,
                    \`year_month\`,
                    payment_type,
                    base_amount,
                    discount_amount,
                    additional_amount,
                    final_amount,
                    due_date,
                    payment_status,
                    description,
                    recorded_by
                ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, ?, 'pending', ?, ?)`,
                [
                    result.insertId,
                    req.user.academyId,
                    yearMonth,
                    proRatedAmount,
                    discountAmount,
                    finalAmount,
                    dueDateStr,
                    `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`,
                    req.user.userId
                ]
            );

            const [payments] = await pool.execute(
                'SELECT * FROM student_payments WHERE id = ?',
                [paymentResult.insertId]
            );
            firstPayment = payments[0];
        }

        // 자동 스케줄 배정
        let autoAssignResult = null;

        logger.info('[Student Create] is_trial:', is_trial, 'trial_dates:', trial_dates);

        if (is_trial && trial_dates && trial_dates.length > 0) {
            // 체험생: trial_dates에 지정된 날짜들에 배정
            logger.info('[Trial] Starting schedule assignment for', trial_dates.length, 'dates');
            try {
                let trialAssigned = 0;
                for (const trialDate of trial_dates) {
                    const { date, time_slot } = trialDate;
                    if (!date || !time_slot) continue;

                    // 해당 날짜의 스케줄 찾기 또는 생성
                    let [schedules] = await pool.execute(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [req.user.academyId, date, time_slot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        // 스케줄 없으면 생성
                        const [createResult] = await pool.execute(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot)
                             VALUES (?, ?, ?)`,
                            [req.user.academyId, date, time_slot]
                        );
                        scheduleId = createResult.insertId;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    // 출석 레코드 생성
                    await pool.execute(
                        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                         VALUES (?, ?, NULL)
                         ON DUPLICATE KEY UPDATE attendance_status = attendance_status`,
                        [scheduleId, result.insertId]
                    );
                    trialAssigned++;
                }
                autoAssignResult = { assigned: trialAssigned, created: 0 };
                logger.info('[Trial] Assigned', trialAssigned, 'schedules');
            } catch (assignError) {
                logger.error('Trial schedule assign failed:', assignError);
            }
        } else if (!is_trial) {
            // 정식 학생: 기존 로직 (등록일 이후 해당 월의 수업에 배정)
            // class_days가 숫자 배열이든 객체 배열이든 autoAssign이 내부에서 처리
            const parsedClassDays = class_days || [];
            if (parsedClassDays.length > 0) {
                try {
                    autoAssignResult = await autoAssignStudentToSchedules(
                        pool,
                        result.insertId,
                        req.user.academyId,
                        parsedClassDays,
                        enrollment_date || new Date().toISOString().split('T')[0],
                        time_slot || 'evening'
                    );
                } catch (assignError) {
                    logger.error('Auto-assign failed:', assignError);
                    // 배정 실패해도 학생 생성은 성공으로 처리
                }
            }
        }

        // 민감 필드 복호화
        const decryptedStudent = decryptFields(createdStudent, ENCRYPTED_FIELDS.students);

        res.status(201).json({
            message: is_trial ? 'Trial student created successfully' : 'Student created successfully',
            student: decryptedStudent,
            firstPayment,
            autoAssigned: autoAssignResult
        });
    } catch (error) {
        logger.error('Error creating student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '학생 등록에 실패했습니다.'
        });
    }
});

};
