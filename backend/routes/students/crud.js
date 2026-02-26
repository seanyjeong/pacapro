const db = require('../../config/database');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { encrypt, decrypt, decryptFields, decryptArrayFields, ENCRYPTED_FIELDS } = require('../../utils/encryption');
const { calculateDueDate } = require('../../utils/dueDateCalculator');
const logger = require('../../utils/logger');
const { parseClassDaysWithSlots, extractDayNumbers, autoAssignStudentToSchedules, reassignStudentSchedules, truncateToThousands } = require('./_utils');

module.exports = function(router) {

/**
 * GET /paca/students
 * Get all students with optional filters
 * Access: owner, admin, teacher
 */
router.get('/', verifyToken, async (req, res) => {
    try {
        const { grade, student_type, admission_type, status, gender, search, is_trial } = req.query;

        let query = `
            SELECT
                s.id,
                s.student_number,
                s.name,
                s.gender,
                s.student_type,
                s.phone,
                s.parent_phone,
                s.school,
                s.grade,
                s.age,
                s.admission_type,
                s.class_days,
                s.weekly_count,
                s.monthly_tuition,
                s.discount_rate,
                s.discount_reason,
                s.payment_due_day,
                s.enrollment_date,
                s.status,
                s.rest_start_date,
                s.rest_end_date,
                s.rest_reason,
                s.is_trial,
                s.trial_remaining,
                s.trial_dates,
                s.time_slot,
                s.is_season_registered,
                s.current_season_id,
                s.memo,
                s.class_days_next,
                s.class_days_effective_from,
                s.created_at
            FROM students s
            WHERE s.academy_id = ?
            AND s.deleted_at IS NULL
        `;

        const params = [req.user.academyId];

        // 체험생 필터
        if (is_trial === 'true') {
            query += ' AND s.is_trial = TRUE';
        } else if (is_trial === 'false') {
            query += ' AND (s.is_trial = FALSE OR s.is_trial IS NULL)';
        }
        // is_trial 파라미터가 없으면 모든 학생 반환

        if (grade) {
            query += ' AND s.grade = ?';
            params.push(grade);
        }

        if (student_type) {
            query += ' AND s.student_type = ?';
            params.push(student_type);
        }

        if (admission_type) {
            query += ' AND s.admission_type = ?';
            params.push(admission_type);
        }

        if (gender) {
            query += ' AND s.gender = ?';
            params.push(gender);
        }

        if (status) {
            query += ' AND s.status = ?';
            params.push(status);
        }

        // search는 복호화 후 메모리에서 필터링 (암호화된 데이터 검색 불가)
        // DB 쿼리에서는 제외

        query += ' ORDER BY s.enrollment_date DESC';

        const [students] = await db.query(query, params);

        // 민감 필드 복호화
        let decryptedStudents = decryptArrayFields(students, ENCRYPTED_FIELDS.students);

        // search 파라미터가 있으면 복호화된 데이터에서 필터링
        if (search) {
            const searchLower = search.toLowerCase();
            decryptedStudents = decryptedStudents.filter(s => {
                const name = (s.name || '').toLowerCase();
                const phone = (s.phone || '').toLowerCase();
                const studentNumber = (s.student_number || '').toLowerCase();
                return name.includes(searchLower) ||
                       phone.includes(searchLower) ||
                       studentNumber.includes(searchLower);
            });
        }

        res.json({
            message: `Found ${decryptedStudents.length} students`,
            students: decryptedStudents
        });
    } catch (error) {
        logger.error('Error fetching students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch students'
        });
    }
});

/**
 * GET /paca/students/:id
 * Get student by ID with performance records
 * Access: owner, admin, teacher
 */
router.get('/:id', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Get student basic info
        const [students] = await db.query(
            `SELECT
                s.*,
                a.name as academy_name
            FROM students s
            LEFT JOIN academies a ON s.academy_id = a.id
            WHERE s.id = ?
            AND s.academy_id = ?
            AND s.deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        // 민감 필드 복호화
        const student = decryptFields(students[0], ENCRYPTED_FIELDS.students);

        // Get performance records
        const [performances] = await db.query(
            `SELECT
                id,
                record_date,
                record_type,
                performance_data,
                notes,
                created_at
            FROM student_performance
            WHERE student_id = ?
            ORDER BY record_date DESC
            LIMIT 10`,
            [studentId]
        );

        // Get payment records
        const [payments] = await db.query(
            `SELECT
                id,
                \`year_month\`,
                payment_type,
                base_amount,
                discount_amount,
                final_amount,
                paid_amount,
                paid_date,
                due_date,
                payment_status,
                payment_method
            FROM student_payments
            WHERE student_id = ?
            ORDER BY due_date DESC
            LIMIT 10`,
            [studentId]
        );

        res.json({
            student,
            performances,
            payments
        });
    } catch (error) {
        logger.error('Error fetching student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch student'
        });
    }
});

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
            const [existing] = await db.query(
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
        const [duplicateStudent] = await db.query(
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
        const [sameNameStudent] = await db.query(
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
            const [lastStudent] = await db.query(
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
        const [result] = await db.query(
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
        const [students] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [result.insertId]
        );

        const createdStudent = students[0];

        // 첫 달 학원비 자동 생성 (일할계산) - 체험생은 제외
        let firstPayment = null;
        if (!is_trial && monthly_tuition && monthly_tuition > 0) {
            const enrollDate = new Date(enrollment_date || new Date().toISOString().split('T')[0]);
            const year = enrollDate.getFullYear();
            const month = enrollDate.getMonth() + 1;

            // 학원 납부일 조회 (기본값 5일)
            const [academySettings] = await db.query(
                'SELECT tuition_due_day FROM academy_settings WHERE academy_id = ?',
                [req.user.academyId]
            );
            const academyDueDay = academySettings.length > 0 ? academySettings[0].tuition_due_day : 5;
            const studentDueDay = payment_due_day || academyDueDay;

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

            // 납부일 계산 (스케줄러와 동일한 로직 사용)
            let dueDateStr = calculateDueDate(year, month, studentDueDay, parsedClassDays);
            let dueDateObj = new Date(dueDateStr);

            // 납부일이 등록일보다 이전이면 다음 달 납부일로
            if (dueDateObj < enrollDate) {
                const nextMonth = month === 12 ? 1 : month + 1;
                const nextYear = month === 12 ? year + 1 : year;
                dueDateStr = calculateDueDate(nextYear, nextMonth, studentDueDay, parsedClassDays);
            }

            // 학원비 레코드 생성
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
            const [paymentResult] = await db.query(
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

            const [payments] = await db.query(
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
                    let [schedules] = await db.query(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [req.user.academyId, date, time_slot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        // 스케줄 없으면 생성
                        const [createResult] = await db.query(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot)
                             VALUES (?, ?, ?)`,
                            [req.user.academyId, date, time_slot]
                        );
                        scheduleId = createResult.insertId;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    // 출석 레코드 생성
                    await db.query(
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
                        db,
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
            message: 'Failed to create student'
        });
    }
});

/**
 * PUT /paca/students/:id
 * Update student
 * Access: owner, admin
 */
router.put('/:id', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Check if student exists and get current class_days, status, time_slot, student_number
        const [students] = await db.query(
            'SELECT id, class_days, status, time_slot, student_number FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
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
            memo
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
            const [existing] = await db.query(
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
            const [lastStudent] = await db.query(
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
        if (class_days !== undefined) {
            updates.push('class_days = ?');
            params.push(JSON.stringify(parseClassDaysWithSlots(class_days, time_slot || oldTimeSlot || 'evening')));
            // 직접 수정 시 예약 변경 초기화
            updates.push('class_days_next = NULL');
            updates.push('class_days_effective_from = NULL');
        }
        if (weekly_count !== undefined) {
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

        await db.query(
            `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Fetch updated student
        const [updatedStudents] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        // 현재 시간대 결정 (새 값 또는 기존 값)
        const currentTimeSlot = time_slot || oldTimeSlot;

        // class_days가 변경되었으면 스케줄 재배정
        let reassignResult = null;
        if (class_days !== undefined) {
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
                        db,
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
                        db,
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

                await db.query(
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

        // 체험생 trial_dates가 변경되었으면 스케줄 재배정
        let trialAssignResult = null;
        if (is_trial && trial_dates !== undefined && trial_dates.length > 0) {
            try {
                // 기존 미출석 스케줄 삭제
                await db.query(
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

                    let [schedules] = await db.query(
                        `SELECT id FROM class_schedules
                         WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                        [req.user.academyId, date, time_slot]
                    );

                    let scheduleId;
                    if (schedules.length === 0) {
                        const [createResult] = await db.query(
                            `INSERT INTO class_schedules (academy_id, class_date, time_slot)
                             VALUES (?, ?, ?)`,
                            [req.user.academyId, date, time_slot]
                        );
                        scheduleId = createResult.insertId;
                    } else {
                        scheduleId = schedules[0].id;
                    }

                    await db.query(
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

                const [academySettings] = await db.query(
                    'SELECT tuition_due_day FROM academy_settings WHERE academy_id = ?',
                    [req.user.academyId]
                );
                const academyDueDay = academySettings.length > 0 ? academySettings[0].tuition_due_day : 5;
                const studentDueDay = payment_due_day || academyDueDay;

                // 이미 해당 월 학원비가 있는지 확인
                const [existingPayment] = await db.query(
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
                        ? Math.floor(monthly_tuition * classCountInPeriod / totalClassDaysInMonth / 100) * 100
                        : monthly_tuition;
                    const discountAmt = discount_rate ? Math.floor(proratedAmount * discount_rate / 100 / 100) * 100 : 0;
                    const finalAmount = proratedAmount - discountAmt;
                    const dueDate = new Date(year, month - 1, Math.min(studentDueDay, lastDayOfMonth));
                    const yearMonth = `${year}-${String(month).padStart(2, '0')}`;
                    const description = `${month}월 학원비 (${enrollDay}일 등록, 일할계산)`;

                    await db.query(
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
                const [attendanceCount] = await db.query(
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
                const [currentPayment] = await db.query(
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
                            await db.query(
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
                            await db.query(
                                'DELETE FROM payments WHERE id = ?',
                                [payment.id]
                            );
                            paymentAdjustment = {
                                type: 'deleted',
                                message: '수업 미진행으로 학원비 삭제됨'
                            };
                        } else {
                            // 출석한 만큼만 금액 수정
                            await db.query(
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
                const [unpaidPayments] = await db.query(
                    `SELECT id, final_amount FROM student_payments
                     WHERE student_id = ?
                     AND academy_id = ?
                     AND payment_status != 'paid'`,
                    [studentId, req.user.academyId]
                );

                if (unpaidPayments.length > 0) {
                    const totalUnpaid = unpaidPayments.reduce((sum, p) => sum + parseFloat(p.final_amount || 0), 0);

                    // 미납 학원비 삭제
                    await db.query(
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
                const [seasonEnrollments] = await db.query(
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
                    await db.query(
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
                const [scheduleDeleteResult] = await db.query(
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

        // 휴원 처리 (→ paused) 시 미래 스케줄에서 제거
        let pauseInfo = null;
        if (status === 'paused' && oldStatus !== 'paused') {
            try {
                const today = new Date().toISOString().split('T')[0];
                const [deleteResult] = await db.query(
                    `DELETE a FROM attendance a
                     JOIN class_schedules cs ON a.class_schedule_id = cs.id
                     WHERE a.student_id = ?
                     AND cs.academy_id = ?
                     AND cs.class_date > ?
                     AND a.attendance_status IS NULL`,
                    [studentId, req.user.academyId, today]
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

        // 민감 필드 복호화 후 응답
        const decryptedStudent = decryptFields(updatedStudents[0], ENCRYPTED_FIELDS.students);

        res.json({
            message: 'Student updated successfully',
            student: decryptedStudent,
            scheduleReassigned: reassignResult,
            trialScheduleAssigned: trialAssignResult,
            paymentAdjustment,
            withdrawalInfo,
            pauseInfo
        });
    } catch (error) {
        logger.error('Error updating student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to update student'
        });
    }
});

/**
 * DELETE /paca/students/:id
 * Hard delete student (완전 삭제)
 * Access: owner only
 */
router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Check if student exists
        const [students] = await db.query(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ?',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // 관련 데이터 삭제 (출석, 학원비, 성적 등)
            // 테이블 존재 여부와 관계없이 에러 무시하고 삭제 시도
            const tablesToDelete = [
                'attendance',
                'student_payments',
                'student_performance',
                'student_seasons',
                'rest_credits',
                'notification_logs'
            ];

            for (const table of tablesToDelete) {
                try {
                    await connection.query(`DELETE FROM ${table} WHERE student_id = ?`, [studentId]);
                } catch (tableErr) {
                    // 테이블이 없거나 컬럼이 없으면 무시
                    logger.info(`Skip delete from ${table}: ${tableErr.message}`);
                }
            }

            // 학생 삭제
            await connection.query('DELETE FROM students WHERE id = ?', [studentId]);

            await connection.commit();
        } catch (err) {
            await connection.rollback();
            throw err;
        } finally {
            connection.release();
        }

        res.json({
            message: 'Student deleted permanently',
            student: {
                id: studentId,
                name: students[0].name
            }
        });
    } catch (error) {
        logger.error('Error deleting student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to delete student: ' + (error.message || 'Unknown error'),
            detail: error.sqlMessage || null
        });
    }
});

/**
 * GET /paca/students/search
 * Search students (for autocomplete, etc)
 * Access: owner, admin, teacher
 */
router.get('/search', verifyToken, async (req, res) => {
    try {
        const { q } = req.query;

        if (!q || q.length < 1) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'Search query is required'
            });
        }

        // 암호화된 데이터 검색을 위해 모든 학생을 가져온 후 메모리에서 필터링
        const [allStudents] = await db.query(
            `SELECT
                id,
                student_number,
                name,
                phone,
                grade,
                grade_type
            FROM students
            WHERE academy_id = ?
            AND deleted_at IS NULL
            AND status = 'active'`,
            [req.user.academyId]
        );

        // 복호화 후 검색
        const searchLower = q.toLowerCase();
        const students = allStudents
            .map(s => ({
                ...s,
                name: s.name ? decrypt(s.name) : s.name,
                phone: s.phone ? decrypt(s.phone) : s.phone
            }))
            .filter(s => {
                const name = (s.name || '').toLowerCase();
                const phone = (s.phone || '').toLowerCase();
                const studentNumber = (s.student_number || '').toLowerCase();
                return name.includes(searchLower) ||
                       phone.includes(searchLower) ||
                       studentNumber.includes(searchLower);
            })
            .slice(0, 20);

        res.json({
            message: `Found ${students.length} students`,
            students
        });
    } catch (error) {
        logger.error('Error searching students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to search students'
        });
    }
});

};
