const express = require('express');
const router = express.Router();
const db = require('../config/database');
const { verifyToken, requireRole, checkPermission } = require('../middleware/auth');
const { encrypt, decrypt, encryptFields, decryptFields, decryptArrayFields, ENCRYPTED_FIELDS } = require('../utils/encryption');

/**
 * 학생을 해당 월의 스케줄에 자동 배정
 * @param {object} dbConn - 데이터베이스 연결
 * @param {number} studentId - 학생 ID
 * @param {number} academyId - 학원 ID
 * @param {array} classDays - 수업 요일 (예: [1, 3, 5] - 숫자 배열)
 * @param {string} enrollmentDate - 등록일 (YYYY-MM-DD)
 * @param {string} defaultTimeSlot - 기본 시간대 ('morning' | 'afternoon' | 'evening')
 */
async function autoAssignStudentToSchedules(dbConn, studentId, academyId, classDays, enrollmentDate, defaultTimeSlot = 'evening') {
    try {
        if (!classDays || classDays.length === 0) {
            console.log('No class days specified, skipping auto-assignment');
            return { assigned: 0, created: 0 };
        }

        const enrollDate = new Date(enrollmentDate + 'T00:00:00');
        const year = enrollDate.getFullYear();
        const month = enrollDate.getMonth();
        const enrollDay = enrollDate.getDate();
        const lastDay = new Date(year, month + 1, 0).getDate();

        let assignedCount = 0;
        let createdCount = 0;

        // 등록일부터 해당 월 말일까지 수업일 찾기
        for (let day = enrollDay; day <= lastDay; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();

            if (classDays.includes(dayOfWeek)) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                // 해당 날짜+시간대의 스케줄 조회 또는 생성
                let [schedules] = await dbConn.query(
                    `SELECT id FROM class_schedules
                     WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                    [academyId, dateStr, defaultTimeSlot]
                );

                let scheduleId;
                if (schedules.length === 0) {
                    // 스케줄 생성
                    const [result] = await dbConn.query(
                        `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                         VALUES (?, ?, ?, false)`,
                        [academyId, dateStr, defaultTimeSlot]
                    );
                    scheduleId = result.insertId;
                    createdCount++;
                } else {
                    scheduleId = schedules[0].id;
                }

                // 이미 배정되어 있는지 확인
                const [existing] = await dbConn.query(
                    `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                    [scheduleId, studentId]
                );

                if (existing.length === 0) {
                    // 출석 기록 생성 (배정)
                    await dbConn.query(
                        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                         VALUES (?, ?, NULL)`,
                        [scheduleId, studentId]
                    );
                    assignedCount++;
                }
            }
        }

        console.log(`Auto-assigned student ${studentId}: ${assignedCount} schedules (${createdCount} new)`);
        return { assigned: assignedCount, created: createdCount };
    } catch (error) {
        console.error('Error in autoAssignStudentToSchedules:', error);
        throw error;
    }
}

/**
 * 학생 요일 변경 시 스케줄 재배정
 * - 기존 미출석 기록 삭제 (오늘 이후)
 * - 새 요일로 재배정 (오늘 이후 ~ 월말)
 */
async function reassignStudentSchedules(dbConn, studentId, academyId, oldClassDays, newClassDays, defaultTimeSlot = 'evening') {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const todayStr = today.toISOString().split('T')[0];

        const year = today.getFullYear();
        const month = today.getMonth();
        const lastDay = new Date(year, month + 1, 0).getDate();

        // 1. 오늘 이후 미출석 기록 삭제 (출석 처리 안된 것만)
        const [deleteResult] = await dbConn.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND a.attendance_status IS NULL`,
            [studentId, academyId, todayStr]
        );

        console.log(`Removed ${deleteResult.affectedRows} future attendance records for student ${studentId}`);

        // 2. 새 요일로 재배정 (오늘부터 월말까지)
        let assignedCount = 0;
        let createdCount = 0;

        for (let day = today.getDate(); day <= lastDay; day++) {
            const currentDate = new Date(year, month, day);
            const dayOfWeek = currentDate.getDay();

            if (newClassDays.includes(dayOfWeek)) {
                const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

                // 해당 날짜+시간대의 스케줄 조회 또는 생성
                let [schedules] = await dbConn.query(
                    `SELECT id FROM class_schedules
                     WHERE academy_id = ? AND class_date = ? AND time_slot = ?`,
                    [academyId, dateStr, defaultTimeSlot]
                );

                let scheduleId;
                if (schedules.length === 0) {
                    const [result] = await dbConn.query(
                        `INSERT INTO class_schedules (academy_id, class_date, time_slot, attendance_taken)
                         VALUES (?, ?, ?, false)`,
                        [academyId, dateStr, defaultTimeSlot]
                    );
                    scheduleId = result.insertId;
                    createdCount++;
                } else {
                    scheduleId = schedules[0].id;
                }

                // 이미 배정되어 있는지 확인
                const [existing] = await dbConn.query(
                    `SELECT id FROM attendance WHERE class_schedule_id = ? AND student_id = ?`,
                    [scheduleId, studentId]
                );

                if (existing.length === 0) {
                    await dbConn.query(
                        `INSERT INTO attendance (class_schedule_id, student_id, attendance_status)
                         VALUES (?, ?, NULL)`,
                        [scheduleId, studentId]
                    );
                    assignedCount++;
                }
            }
        }

        console.log(`Reassigned student ${studentId}: ${assignedCount} schedules (${createdCount} new)`);
        return { removed: deleteResult.affectedRows, assigned: assignedCount, created: createdCount };
    } catch (error) {
        console.error('Error in reassignStudentSchedules:', error);
        throw error;
    }
}

/**
 * GET /paca/students/rest-ended
 * 휴원 종료일이 지난 학생 목록 조회 (복귀 대기)
 * Access: owner, admin, staff
 */
router.get('/rest-ended', verifyToken, requireRole('owner', 'admin', 'staff'), async (req, res) => {
    try {
        const academyId = req.user.academyId;
        const today = new Date().toISOString().split('T')[0];

        const [students] = await db.query(
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

        // 이름, 전화번호 복호화 및 경과일 계산
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
        console.error('Error fetching rest-ended students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch rest-ended students'
        });
    }
});

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
        console.error('Error fetching students:', error);
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
        console.error('Error fetching student:', error);
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
                JSON.stringify(class_days || []),
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
            const parsedClassDays = class_days || [];
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

            // 일할계산 금액
            const baseAmount = parseFloat(monthly_tuition);
            const discountRateNum = parseFloat(discount_rate) || 0;
            let proRatedAmount;

            if (totalClassDaysInMonth > 0 && classDaysCount > 0) {
                const dailyRate = baseAmount / totalClassDaysInMonth;
                proRatedAmount = Math.round(dailyRate * classDaysCount);
            } else {
                // 수업요일 설정 없으면 일수 기준
                proRatedAmount = Math.round(baseAmount * remainingDays / lastDayOfMonth);
            }

            // 할인 적용
            const discountAmount = Math.round(proRatedAmount * discountRateNum / 100);
            const finalAmount = proRatedAmount - discountAmount;

            // 납부일 계산
            const dueDate = new Date(year, month - 1, Math.min(studentDueDay, lastDayOfMonth));
            if (dueDate < enrollDate) {
                // 납부일이 등록일보다 이전이면 다음 달 납부일로
                dueDate.setMonth(dueDate.getMonth() + 1);
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
                    dueDate.toISOString().split('T')[0],
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

        console.log('[Student Create] is_trial:', is_trial, 'trial_dates:', trial_dates);

        if (is_trial && trial_dates && trial_dates.length > 0) {
            // 체험생: trial_dates에 지정된 날짜들에 배정
            console.log('[Trial] Starting schedule assignment for', trial_dates.length, 'dates');
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
                console.log('[Trial] Assigned', trialAssigned, 'schedules');
            } catch (assignError) {
                console.error('Trial schedule assign failed:', assignError);
            }
        } else if (!is_trial) {
            // 정식 학생: 기존 로직 (등록일 이후 해당 월의 수업에 배정)
            const parsedClassDays = class_days || [];
            if (parsedClassDays.length > 0) {
                try {
                    autoAssignResult = await autoAssignStudentToSchedules(
                        db,
                        result.insertId,
                        req.user.academyId,
                        parsedClassDays,
                        enrollment_date || new Date().toISOString().split('T')[0],
                        time_slot || 'evening'  // 선택한 시간대 (기본: 저녁)
                    );
                } catch (assignError) {
                    console.error('Auto-assign failed:', assignError);
                    // 배정 실패해도 학생 생성은 성공으로 처리
                }
            }
        }

        res.status(201).json({
            message: is_trial ? 'Trial student created successfully' : 'Student created successfully',
            student: createdStudent,
            firstPayment,
            autoAssigned: autoAssignResult
        });
    } catch (error) {
        console.error('Error creating student:', error);
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
        // Check if student exists and get current class_days, status, time_slot
        const [students] = await db.query(
            'SELECT id, class_days, status, time_slot FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
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
        const oldClassDays = students[0].class_days
            ? (typeof students[0].class_days === 'string'
                ? JSON.parse(students[0].class_days)
                : students[0].class_days)
            : [];

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

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (student_number !== undefined) {
            updates.push('student_number = ?');
            params.push(student_number);
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
            params.push(JSON.stringify(class_days));
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
            // 요일이 실제로 변경되었는지 확인
            const oldSet = new Set(oldClassDays);
            const newSet = new Set(newClassDays);
            const isChanged = oldClassDays.length !== newClassDays.length ||
                              oldClassDays.some(d => !newSet.has(d)) ||
                              newClassDays.some(d => !oldSet.has(d));

            if (isChanged && newClassDays.length > 0) {
                try {
                    reassignResult = await reassignStudentSchedules(
                        db,
                        studentId,
                        req.user.academyId,
                        oldClassDays,
                        newClassDays,
                        currentTimeSlot
                    );
                } catch (reassignError) {
                    console.error('Reassign failed:', reassignError);
                    // 재배정 실패해도 업데이트는 성공으로 처리
                }
            }
        }

        // time_slot만 변경되었으면 스케줄 재배정 (class_days 변경 없이)
        let timeSlotReassignResult = null;
        if (time_slot !== undefined && time_slot !== oldTimeSlot && class_days === undefined) {
            const currentClassDays = updatedStudents[0].class_days
                ? (typeof updatedStudents[0].class_days === 'string'
                    ? JSON.parse(updatedStudents[0].class_days)
                    : updatedStudents[0].class_days)
                : [];

            if (currentClassDays.length > 0) {
                try {
                    timeSlotReassignResult = await reassignStudentSchedules(
                        db,
                        studentId,
                        req.user.academyId,
                        currentClassDays,
                        currentClassDays,
                        time_slot
                    );
                } catch (reassignError) {
                    console.error('Time slot reassign failed:', reassignError);
                    // 재배정 실패해도 업데이트는 성공으로 처리
                }
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

                // 새 스케줄 배정
                let trialAssigned = 0;
                for (const trialDate of trial_dates) {
                    const { date, time_slot } = trialDate;
                    if (!date || !time_slot) continue;

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
            } catch (trialError) {
                console.error('Trial schedule reassign failed:', trialError);
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
                console.error('Payment adjustment failed:', paymentError);
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
                console.error('Withdrawal payment cleanup failed:', withdrawError);
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
                console.error('Pause schedule cleanup failed:', pauseError);
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
        console.error('Error updating student:', error);
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
                    console.log(`Skip delete from ${table}: ${tableErr.message}`);
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
        console.error('Error deleting student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to delete student: ' + (error.message || 'Unknown error'),
            detail: error.sqlMessage || null
        });
    }
});

/**
 * POST /paca/students/:id/withdraw
 * 퇴원 처리
 * Access: owner, admin
 */
router.post('/:id/withdraw', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { reason, withdrawal_date } = req.body;

    try {
        // Check if student exists
        const [students] = await db.query(
            'SELECT id, name, status FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        if (students[0].status === 'withdrawn') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 퇴원 처리된 학생입니다'
            });
        }

        // 퇴원 처리
        await db.query(
            `UPDATE students
             SET status = 'withdrawn',
                 withdrawal_date = ?,
                 withdrawal_reason = ?,
                 updated_at = NOW()
             WHERE id = ?`,
            [withdrawal_date || new Date().toISOString().split('T')[0], reason || null, studentId]
        );

        // 미래 스케줄에서 제거 (오늘 이후)
        const today = new Date().toISOString().split('T')[0];
        await db.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ? AND cs.class_date > ? AND a.attendance_status IS NULL`,
            [studentId, today]
        );

        res.json({
            message: '퇴원 처리되었습니다',
            student: {
                id: studentId,
                name: students[0].name,
                status: 'withdrawn',
                withdrawal_date: withdrawal_date || today,
                withdrawal_reason: reason
            }
        });
    } catch (error) {
        console.error('Error withdrawing student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to withdraw student'
        });
    }
});

/**
 * POST /paca/students/grade-upgrade
 * Bulk upgrade student grades (진급 처리)
 * Access: owner, admin
 */
router.post('/grade-upgrade', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    try {
        const { upgrades } = req.body;

        if (!Array.isArray(upgrades) || upgrades.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: 'upgrades must be a non-empty array'
            });
        }

        const validGrades = ['고1', '고2', '고3', 'N수', null];
        const validStatuses = ['active', 'inactive', 'graduated'];

        // Validate all upgrades first
        for (const upgrade of upgrades) {
            if (!upgrade.student_id) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: 'Each upgrade must have student_id'
                });
            }

            if (upgrade.new_grade !== null && upgrade.new_grade !== undefined && !validGrades.includes(upgrade.new_grade)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `Invalid grade: ${upgrade.new_grade}. Must be one of: 고1, 고2, 고3, N수`
                });
            }

            if (upgrade.new_status && !validStatuses.includes(upgrade.new_status)) {
                return res.status(400).json({
                    error: 'Validation Error',
                    message: `Invalid status: ${upgrade.new_status}. Must be one of: active, inactive, graduated`
                });
            }
        }

        // Verify all students belong to this academy
        const studentIds = upgrades.map(u => u.student_id);
        const [existingStudents] = await db.query(
            `SELECT id FROM students
             WHERE id IN (?)
             AND academy_id = ?
             AND deleted_at IS NULL`,
            [studentIds, req.user.academyId]
        );

        if (existingStudents.length !== studentIds.length) {
            const foundIds = existingStudents.map(s => s.id);
            const missingIds = studentIds.filter(id => !foundIds.includes(id));
            return res.status(400).json({
                error: 'Validation Error',
                message: `Students not found: ${missingIds.join(', ')}`
            });
        }

        // Perform updates in transaction
        const connection = await db.getConnection();
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

                    await connection.query(
                        `UPDATE students SET ${updates.join(', ')} WHERE id = ?`,
                        params
                    );
                    updatedCount++;
                }
            }

            await connection.commit();

            res.json({
                message: `Successfully upgraded ${updatedCount} students`,
                updated_count: updatedCount
            });
        } catch (error) {
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Error upgrading student grades:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to upgrade student grades'
        });
    }
});

/**
 * POST /paca/students/auto-promote
 * 학년 자동 진급 (3월 신학기)
 * Access: owner only
 *
 * 진급 규칙:
 * - 중1 → 중2, 중2 → 중3, 중3 → 고1
 * - 고1 → 고2, 고2 → 고3, 고3 → N수
 * - N수 → N수 (유지)
 *
 * Body (선택):
 * - dry_run: true면 실제 변경 없이 미리보기만
 * - graduate_student_ids: 고3 중 졸업 처리할 학생 ID 배열 (status를 'graduated'로 변경)
 */
router.post('/auto-promote', verifyToken, requireRole('owner'), async (req, res) => {
    try {
        const { dry_run = false, graduate_student_ids = [] } = req.body;
        const academyId = req.user.academyId;

        // 학년 진급 매핑
        const GRADE_PROMOTION_MAP = {
            '중1': '중2',
            '중2': '중3',
            '중3': '고1',
            '고1': '고2',
            '고2': '고3',
            '고3': 'N수',
            'N수': 'N수'
        };

        // 해당 학원의 active/paused 학생 조회 (graduated 제외)
        const [students] = await db.query(`
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

        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            for (const student of students) {
                const currentGrade = student.grade;
                const newGrade = GRADE_PROMOTION_MAP[currentGrade];

                // 졸업 처리 대상인지 확인 (고3 학생 중)
                const shouldGraduate = currentGrade === '고3' &&
                    graduate_student_ids.includes(student.id);

                if (shouldGraduate) {
                    // 졸업 처리
                    if (!dry_run) {
                        await connection.query(
                            `UPDATE students SET status = 'graduated', updated_at = NOW() WHERE id = ?`,
                            [student.id]
                        );

                        // 졸업생 미래 스케줄 삭제
                        const today = new Date().toISOString().split('T')[0];
                        await connection.query(
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
                    // 진급 처리
                    if (!dry_run) {
                        await connection.query(
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

        // 진급 요약
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
        console.error('Auto-promote error:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to auto-promote students'
        });
    }
});

/**
 * GET /paca/students/:id/seasons
 * Get student's season enrollment history
 * Access: owner, admin, teacher
 */
router.get('/:id/seasons', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // Verify student exists and belongs to academy
        const [students] = await db.query(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        // Get season enrollment history
        const [seasons] = await db.query(
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
        console.error('Error fetching student seasons:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch student seasons'
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
        console.error('Error searching students:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to search students'
        });
    }
});

/**
 * POST /paca/students/:id/rest
 * 학생 휴식 처리 (이월/환불 크레딧 생성)
 * Access: owner, admin
 */
router.post('/:id/rest', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const connection = await db.getConnection();

    try {
        await connection.beginTransaction();

        // 1. 학생 존재 확인 및 현재 정보 조회
        const [students] = await connection.query(
            `SELECT id, name, monthly_tuition, discount_rate, status, academy_id
             FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const student = students[0];

        const {
            rest_start_date,
            rest_end_date,
            rest_reason,
            credit_type,  // 'carryover' | 'refund' | 'none'
            source_payment_id  // 이미 납부한 학원비 ID (선택)
        } = req.body;

        // 2. 필수 필드 검증
        if (!rest_start_date) {
            await connection.rollback();
            return res.status(400).json({
                error: 'Validation Error',
                message: '휴식 시작일은 필수입니다.'
            });
        }

        // 3. 학생 상태를 paused로 변경하고 휴식 정보 저장
        await connection.query(
            `UPDATE students SET
                status = 'paused',
                rest_start_date = ?,
                rest_end_date = ?,
                rest_reason = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [rest_start_date, rest_end_date || null, rest_reason || null, studentId]
        );

        let restCredit = null;

        // 4. 이월/환불 크레딧 처리
        if (credit_type && credit_type !== 'none') {
            // 휴식 기간 계산
            const startDate = new Date(rest_start_date);
            let endDate;

            if (rest_end_date) {
                endDate = new Date(rest_end_date);
            } else {
                // 무기한인 경우 해당 월 말일까지로 계산
                endDate = new Date(startDate.getFullYear(), startDate.getMonth() + 1, 0);
            }

            // 해당 월 내 휴식 일수 계산
            const year = startDate.getFullYear();
            const month = startDate.getMonth();
            const monthStart = new Date(year, month, 1);
            const monthEnd = new Date(year, month + 1, 0);
            const daysInMonth = monthEnd.getDate();

            const effectiveStart = startDate > monthStart ? startDate : monthStart;
            const effectiveEnd = endDate < monthEnd ? endDate : monthEnd;
            const restDays = Math.ceil((effectiveEnd - effectiveStart) / (1000 * 60 * 60 * 24)) + 1;

            // 일할 금액 계산
            const monthlyTuition = parseFloat(student.monthly_tuition) || 0;
            const dailyRate = monthlyTuition / daysInMonth;
            const creditAmount = Math.floor((dailyRate * restDays) / 1000) * 1000;  // 천원 단위 절삭

            if (creditAmount > 0) {
                // 휴식 크레딧 생성
                const [creditResult] = await connection.query(
                    `INSERT INTO rest_credits (
                        student_id,
                        academy_id,
                        source_payment_id,
                        rest_start_date,
                        rest_end_date,
                        rest_days,
                        credit_amount,
                        remaining_amount,
                        credit_type,
                        status,
                        notes
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                    [
                        studentId,
                        req.user.academyId,
                        source_payment_id || null,
                        rest_start_date,
                        rest_end_date || effectiveEnd.toISOString().split('T')[0],
                        restDays,
                        creditAmount,
                        creditAmount,  // remaining_amount = credit_amount 초기값
                        credit_type,
                        `휴식 기간: ${rest_start_date} ~ ${rest_end_date || '무기한'}, 사유: ${rest_reason || '없음'}`
                    ]
                );

                const [credits] = await connection.query(
                    'SELECT * FROM rest_credits WHERE id = ?',
                    [creditResult.insertId]
                );
                restCredit = credits[0];
            }
        }

        // 5. 오늘 이후 미출석 스케줄 삭제 (휴식 시작일 기준)
        await connection.query(
            `DELETE a FROM attendance a
             JOIN class_schedules cs ON a.class_schedule_id = cs.id
             WHERE a.student_id = ?
             AND cs.academy_id = ?
             AND cs.class_date >= ?
             AND a.attendance_status IS NULL`,
            [studentId, req.user.academyId, rest_start_date]
        );

        await connection.commit();

        // 업데이트된 학생 정보 조회
        const [updatedStudents] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        res.json({
            message: '휴식 처리가 완료되었습니다.',
            student: updatedStudents[0],
            restCredit
        });
    } catch (error) {
        await connection.rollback();
        console.error('Error processing rest:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to process rest'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /paca/students/:id/resume
 * 학생 휴식 복귀 처리
 * - 복귀 시 해당 월 학원비가 없으면 일할계산하여 자동 생성
 * - resume_date: 복귀 날짜 (YYYY-MM-DD) - 없으면 오늘 날짜 사용
 * Access: owner, admin
 */
router.post('/:id/resume', verifyToken, checkPermission('students', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { resume_date } = req.body;

    // 복귀 날짜 설정 (없으면 오늘)
    const resumeDate = resume_date ? new Date(resume_date + 'T00:00:00') : new Date();
    const resumeDateStr = resumeDate.toISOString().split('T')[0];

    try {
        // 학생 존재 확인 (수강료 정보 포함)
        const [students] = await db.query(
            `SELECT s.id, s.name, s.status, s.class_days, s.monthly_tuition, s.discount_rate,
                    COALESCE(s.payment_due_day, ast.tuition_due_day, 5) as due_day
             FROM students s
             LEFT JOIN academy_settings ast ON s.academy_id = ast.academy_id
             WHERE s.id = ? AND s.academy_id = ? AND s.deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        const student = students[0];

        if (student.status !== 'paused') {
            return res.status(400).json({
                error: 'Validation Error',
                message: '휴식 상태인 학생만 복귀할 수 있습니다.'
            });
        }

        // 상태를 active로 변경하고 휴식 정보 초기화
        await db.query(
            `UPDATE students SET
                status = 'active',
                rest_start_date = NULL,
                rest_end_date = NULL,
                rest_reason = NULL,
                updated_at = NOW()
             WHERE id = ?`,
            [studentId]
        );

        // class_days가 있으면 오늘부터 스케줄 재배정
        const classDays = student.class_days
            ? (typeof student.class_days === 'string'
                ? JSON.parse(student.class_days)
                : student.class_days)
            : [];

        let reassignResult = null;
        if (classDays.length > 0) {
            try {
                reassignResult = await autoAssignStudentToSchedules(
                    db,
                    studentId,
                    req.user.academyId,
                    classDays,
                    resumeDateStr,  // 복귀 날짜 기준
                    'evening'
                );
            } catch (assignError) {
                console.error('Auto-assign failed:', assignError);
            }
        }

        // 복귀 시 해당 월 학원비 자동 생성 (일할계산)
        let paymentCreated = null;
        try {
            const year = resumeDate.getFullYear();
            const month = resumeDate.getMonth() + 1;
            const currentDay = resumeDate.getDate();
            const yearMonth = `${year}-${String(month).padStart(2, '0')}`;

            // 이미 해당 월 학원비가 있는지 확인
            const [existingPayment] = await db.query(
                `SELECT id FROM student_payments
                 WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
                [studentId, req.user.academyId, yearMonth]
            );

            if (existingPayment.length === 0 && student.monthly_tuition > 0) {
                // 일할계산: 복귀일부터 말일까지
                const lastDayOfMonth = new Date(year, month, 0).getDate();
                const remainingDays = lastDayOfMonth - currentDay + 1;

                // 수업 요일 기준 일할 계산 (숫자 배열 또는 한글 배열 처리)
                let classDayNums = [];
                if (Array.isArray(classDays) && classDays.length > 0) {
                    if (typeof classDays[0] === 'number') {
                        // 이미 숫자 배열 [1, 5] (월=1, 금=5)
                        classDayNums = classDays;
                    } else {
                        // 한글 요일 배열 ['월', '금']
                        const dayNameToNum = { '월': 1, '화': 2, '수': 3, '목': 4, '금': 5, '토': 6, '일': 0 };
                        classDayNums = classDays.map(d => dayNameToNum[d]).filter(d => d !== undefined);
                    }
                }

                // 4주 고정: 월 총 수업일 = 주간 횟수 × 4
                const weeklyCount = classDayNums.length || 2;  // 기본값 주2회
                let totalClassDays = weeklyCount * 4;

                // 남은 수업일: 복귀일부터 말일까지 실제 수업요일 카운트
                let remainingClassDays = 0;
                for (let day = currentDay; day <= lastDayOfMonth; day++) {
                    const date = new Date(year, month - 1, day);
                    const dayOfWeek = date.getDay();
                    if (classDayNums.length === 0 || classDayNums.includes(dayOfWeek)) {
                        remainingClassDays++;
                    }
                }
                // 남은 수업일이 총 수업일을 초과하지 않도록 (1일 복귀 시)
                remainingClassDays = Math.min(remainingClassDays, totalClassDays);

                const baseAmount = parseFloat(student.monthly_tuition);
                const discountRate = parseFloat(student.discount_rate) || 0;

                // 일할 금액 계산
                let proRatedAmount = baseAmount;
                if (totalClassDays > 0 && currentDay > 1) {
                    proRatedAmount = Math.floor((baseAmount * remainingClassDays / totalClassDays) / 1000) * 1000;
                }

                const discountAmount = Math.floor((proRatedAmount * discountRate / 100) / 1000) * 1000;
                const finalAmount = proRatedAmount - discountAmount;

                // 납부기한: 복귀일 + 7일
                const dueDate = new Date(resumeDate);
                dueDate.setDate(dueDate.getDate() + 7);

                const description = `${month}월 학원비 (${currentDay}일 복귀, 일할계산)`;
                const notes = `복귀일: ${currentDay}일, 남은 수업일: ${remainingClassDays}/${totalClassDays}일\n` +
                              `계산: ${baseAmount.toLocaleString()}원 × (${remainingClassDays}/${totalClassDays}) = ${proRatedAmount.toLocaleString()}원`;

                const [result] = await db.query(
                    `INSERT INTO student_payments (
                        student_id, academy_id, \`year_month\`, payment_type,
                        base_amount, discount_amount, additional_amount, final_amount,
                        is_prorated, due_date, payment_status, description, notes, recorded_by
                    ) VALUES (?, ?, ?, 'monthly', ?, ?, 0, ?, 1, ?, 'pending', ?, ?, ?)`,
                    [
                        studentId,
                        req.user.academyId,
                        yearMonth,
                        proRatedAmount,
                        discountAmount,
                        finalAmount,
                        dueDate.toISOString().split('T')[0],
                        description,
                        notes,
                        req.user.userId
                    ]
                );

                paymentCreated = {
                    id: result.insertId,
                    yearMonth,
                    baseAmount: proRatedAmount,
                    finalAmount,
                    remainingClassDays,
                    totalClassDays
                };
            }
        } catch (paymentError) {
            console.error('Auto payment creation failed:', paymentError);
        }

        // 업데이트된 학생 정보 조회
        const [updatedStudents] = await db.query(
            'SELECT * FROM students WHERE id = ?',
            [studentId]
        );

        res.json({
            message: paymentCreated
                ? `${resumeDateStr} 복귀 처리가 완료되었습니다. ${paymentCreated.yearMonth} 학원비 ${paymentCreated.finalAmount.toLocaleString()}원이 생성되었습니다.`
                : `${resumeDateStr} 복귀 처리가 완료되었습니다.`,
            student: updatedStudents[0],
            scheduleAssigned: reassignResult,
            paymentCreated,
            resumeDate: resumeDateStr
        });
    } catch (error) {
        console.error('Error resuming student:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to resume student'
        });
    }
});

/**
 * GET /paca/students/:id/rest-credits
 * 학생의 휴식 크레딧 내역 조회
 * Access: owner, admin, teacher
 */
router.get('/:id/rest-credits', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // 학생 존재 확인
        const [students] = await db.query(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: 'Student not found'
            });
        }

        // 휴식 크레딧 내역 조회
        const [credits] = await db.query(
            `SELECT * FROM rest_credits
             WHERE student_id = ?
             ORDER BY created_at DESC`,
            [studentId]
        );

        // 미적용 크레딧 합계
        const pendingTotal = credits
            .filter(c => c.status === 'pending' || c.status === 'partial')
            .reduce((sum, c) => sum + (c.remaining_amount || 0), 0);

        res.json({
            message: `Found ${credits.length} rest credits`,
            student: students[0],
            credits,
            pendingTotal
        });
    } catch (error) {
        console.error('Error fetching rest credits:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch rest credits'
        });
    }
});

/**
 * 천원 단위 절삭
 */
function truncateToThousands(amount) {
    return Math.floor(amount / 1000) * 1000;
}

/**
 * 기간 내 수업 횟수 계산
 * @param {string} startDate - 시작일 (YYYY-MM-DD)
 * @param {string} endDate - 종료일 (YYYY-MM-DD)
 * @param {array} classDays - 수업 요일 배열 (0=일, 1=월, ..., 6=토)
 * @returns {object} { count: 수업횟수, dates: 수업일 배열 }
 */
function countClassDaysInPeriod(startDate, endDate, classDays) {
    const start = new Date(startDate + 'T00:00:00');
    const end = new Date(endDate + 'T00:00:00');
    const classDates = [];

    const current = new Date(start);
    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (classDays.includes(dayOfWeek)) {
            classDates.push(new Date(current));
        }
        current.setDate(current.getDate() + 1);
    }

    return {
        count: classDates.length,
        dates: classDates.map(d => {
            const dayNames = ['일', '월', '화', '수', '목', '금', '토'];
            const month = d.getMonth() + 1;
            const day = d.getDate();
            const dayName = dayNames[d.getDay()];
            return `${month}/${day}(${dayName})`;
        })
    };
}

/**
 * POST /paca/students/:id/manual-credit
 * 수동 크레딧 생성
 * Access: owner, admin (payments edit 권한)
 *
 * Body (날짜로 입력):
 * {
 *   start_date: "2024-12-10",
 *   end_date: "2024-12-15",
 *   reason: "시험기간",
 *   notes?: "추가 메모"
 * }
 *
 * Body (회차로 입력):
 * {
 *   class_count: 3,
 *   reason: "시험기간",
 *   notes?: "추가 메모"
 * }
 */
router.post('/:id/manual-credit', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { start_date, end_date, class_count, reason, notes } = req.body;

    try {
        // 유효성 검사
        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '사유는 필수입니다.'
            });
        }

        // 날짜 입력과 회차 입력 중 하나는 있어야 함
        const hasDateInput = start_date && end_date;
        const hasCountInput = class_count && class_count > 0;

        if (!hasDateInput && !hasCountInput) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '날짜 기간 또는 회차를 입력해주세요.'
            });
        }

        if (hasCountInput && (class_count < 1 || class_count > 12)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '회차는 1~12 사이여야 합니다.'
            });
        }

        // 학생 정보 조회
        const [students] = await db.query(
            `SELECT id, name, monthly_tuition, weekly_count, class_days
             FROM students
             WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        const student = students[0];
        const monthlyTuition = parseFloat(student.monthly_tuition) || 0;
        const weeklyCount = student.weekly_count || 2;
        const classDays = student.class_days || [];

        if (monthlyTuition <= 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '월 수강료가 설정되지 않은 학생입니다.'
            });
        }

        // 1회 금액 계산
        const perClassFee = truncateToThousands(monthlyTuition / (weeklyCount * 4));

        let finalClassCount = 0;
        let classDatesInfo = null;
        let periodInfo = null;

        if (hasDateInput) {
            // 날짜로 입력 - 수업 횟수 자동 계산
            if (classDays.length === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '학생의 수업 요일이 설정되지 않았습니다. 회차로 입력해주세요.'
                });
            }

            const result = countClassDaysInPeriod(start_date, end_date, classDays);
            finalClassCount = result.count;
            classDatesInfo = result.dates;
            periodInfo = { start_date, end_date };

            if (finalClassCount === 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '해당 기간에 수업일이 없습니다.'
                });
            }
        } else {
            // 회차로 직접 입력
            finalClassCount = class_count;
        }

        // 크레딧 금액 계산
        const creditAmount = truncateToThousands(perClassFee * finalClassCount);

        // rest_credits 테이블에 삽입
        const today = new Date().toISOString().split('T')[0];
        const noteText = `[수동 크레딧] ${reason}${classDatesInfo ? ` (${classDatesInfo.join(', ')})` : ''}${notes ? '\n' + notes : ''}`;

        const [result] = await db.query(
            `INSERT INTO rest_credits (
                student_id, academy_id, source_payment_id,
                rest_start_date, rest_end_date, rest_days,
                credit_amount, remaining_amount,
                credit_type, status, notes, created_at
            ) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, 'manual', 'pending', ?, NOW())`,
            [
                studentId,
                req.user.academyId,
                periodInfo?.start_date || today,
                periodInfo?.end_date || today,
                finalClassCount,
                creditAmount,
                creditAmount,
                noteText
            ]
        );

        // 생성된 크레딧 조회
        const [newCredits] = await db.query(
            'SELECT * FROM rest_credits WHERE id = ?',
            [result.insertId]
        );

        // 학생명 복호화
        const studentName = decrypt(student.name);

        res.status(201).json({
            message: `${studentName} 학생에게 ${creditAmount.toLocaleString()}원 크레딧이 생성되었습니다.`,
            credit: newCredits[0],
            calculation: {
                monthly_tuition: monthlyTuition,
                weekly_count: weeklyCount,
                per_class_fee: perClassFee,
                class_count: finalClassCount,
                class_dates: classDatesInfo,
                total_credit: creditAmount
            }
        });
    } catch (error) {
        console.error('Error creating manual credit:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 생성에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/students/:id/credits
 * 학생의 크레딧 목록 조회
 */
router.get('/:id/credits', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        const [credits] = await db.query(
            `SELECT id, credit_amount, remaining_amount, credit_type, status,
                    rest_start_date, rest_end_date, rest_days, notes, created_at
             FROM rest_credits
             WHERE student_id = ? AND academy_id = ?
             ORDER BY created_at DESC`,
            [studentId, req.user.academyId]
        );

        res.json({ credits });
    } catch (error) {
        console.error('Error fetching credits:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 조회에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/students/:id/credits/:creditId
 * 크레딧 수정
 */
router.put('/:id/credits/:creditId', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const creditId = parseInt(req.params.creditId);
    const { credit_amount, notes, status } = req.body;

    try {
        // 크레딧 존재 및 권한 확인
        const [existing] = await db.query(
            `SELECT * FROM rest_credits WHERE id = ? AND student_id = ? AND academy_id = ?`,
            [creditId, studentId, req.user.academyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '크레딧을 찾을 수 없습니다.'
            });
        }

        const credit = existing[0];

        // 이미 사용된 크레딧은 금액 수정 불가
        if (credit.status === 'used' && credit_amount !== undefined && credit_amount !== credit.credit_amount) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 사용된 크레딧은 금액을 수정할 수 없습니다.'
            });
        }

        // 업데이트
        const updateFields = [];
        const updateValues = [];

        if (credit_amount !== undefined) {
            updateFields.push('credit_amount = ?', 'remaining_amount = ?');
            updateValues.push(credit_amount, credit_amount);
        }
        if (notes !== undefined) {
            updateFields.push('notes = ?');
            updateValues.push(notes);
        }
        if (status !== undefined) {
            // applied 상태는 학원비 적용 시에만 자동으로 변경되어야 함
            if (status === 'applied') {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: "'applied' 상태는 학원비 적용 시 자동으로 변경됩니다. 수동 변경 불가."
                });
            }
            updateFields.push('status = ?');
            updateValues.push(status);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '수정할 내용이 없습니다.'
            });
        }

        updateValues.push(creditId);

        await db.query(
            `UPDATE rest_credits SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        res.json({ message: '크레딧이 수정되었습니다.' });
    } catch (error) {
        console.error('Error updating credit:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 수정에 실패했습니다.'
        });
    }
});

/**
 * DELETE /paca/students/:id/credits/:creditId
 * 크레딧 삭제
 */
router.delete('/:id/credits/:creditId', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const creditId = parseInt(req.params.creditId);

    try {
        // 크레딧 존재 및 권한 확인
        const [existing] = await db.query(
            `SELECT * FROM rest_credits WHERE id = ? AND student_id = ? AND academy_id = ?`,
            [creditId, studentId, req.user.academyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '크레딧을 찾을 수 없습니다.'
            });
        }

        const credit = existing[0];

        // 이미 사용된 크레딧은 삭제 불가
        if (credit.status === 'used') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 사용된 크레딧은 삭제할 수 없습니다.'
            });
        }

        await db.query('DELETE FROM rest_credits WHERE id = ?', [creditId]);

        res.json({ message: '크레딧이 삭제되었습니다.' });
    } catch (error) {
        console.error('Error deleting credit:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 삭제에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/students/:id/credits/:creditId/apply
 * 크레딧을 특정 월 학원비에 수동 적용
 */
router.post('/:id/credits/:creditId/apply', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const creditId = parseInt(req.params.creditId);
    const { year_month } = req.body;

    if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
        return res.status(400).json({
            error: 'Bad Request',
            message: '적용할 월(year_month)을 YYYY-MM 형식으로 입력해주세요.'
        });
    }

    try {
        // 크레딧 조회
        const [credits] = await db.query(
            `SELECT * FROM rest_credits WHERE id = ? AND student_id = ? AND academy_id = ?`,
            [creditId, studentId, req.user.academyId]
        );

        if (credits.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '크레딧을 찾을 수 없습니다.'
            });
        }

        const credit = credits[0];

        // 이미 사용 완료된 크레딧은 적용 불가
        if (credit.status === 'applied' || credit.remaining_amount <= 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 사용 완료된 크레딧입니다.'
            });
        }

        // 해당 월 학원비 조회
        const [payments] = await db.query(
            `SELECT * FROM student_payments
             WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
            [studentId, req.user.academyId, year_month]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: `${year_month} 학원비가 없습니다.`
            });
        }

        const payment = payments[0];

        // 이미 납부 완료된 학원비는 적용 불가
        if (payment.payment_status === 'paid') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '이미 납부 완료된 학원비에는 크레딧을 적용할 수 없습니다.'
            });
        }

        // 적용할 금액 계산 (크레딧 잔액 vs 학원비 남은 금액)
        const currentFinal = parseFloat(payment.final_amount);
        const currentCarryover = parseFloat(payment.carryover_amount) || 0;
        const payableAmount = currentFinal; // 현재 최종 금액
        const applyAmount = Math.min(credit.remaining_amount, payableAmount);

        if (applyAmount <= 0) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '적용할 금액이 없습니다.'
            });
        }

        // 학원비 업데이트
        const newCarryover = currentCarryover + applyAmount;
        const newFinal = currentFinal - applyAmount;
        const creditTypeLabel = credit.credit_type === 'excused' ? '공결' :
                               credit.credit_type === 'manual' ? '수동' : '휴식';
        const newNotes = payment.notes
            ? `${payment.notes}\n[크레딧 차감] ${creditTypeLabel} 크레딧 ${applyAmount.toLocaleString()}원 차감`
            : `[크레딧 차감] ${creditTypeLabel} 크레딧 ${applyAmount.toLocaleString()}원 차감`;

        await db.query(
            `UPDATE student_payments SET
                carryover_amount = ?,
                final_amount = ?,
                rest_credit_id = ?,
                notes = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [newCarryover, newFinal, creditId, newNotes, payment.id]
        );

        // 크레딧 업데이트
        const newRemaining = credit.remaining_amount - applyAmount;
        const newStatus = newRemaining <= 0 ? 'applied' : 'partial';

        await db.query(
            `UPDATE rest_credits SET
                remaining_amount = ?,
                status = ?,
                applied_to_payment_id = ?,
                processed_at = NOW()
             WHERE id = ?`,
            [newRemaining, newStatus, payment.id, creditId]
        );

        res.json({
            message: `${year_month} 학원비에 ${applyAmount.toLocaleString()}원 크레딧이 적용되었습니다.`,
            applied_amount: applyAmount,
            new_final_amount: newFinal,
            credit_remaining: newRemaining
        });

    } catch (error) {
        console.error('Error applying credit:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 적용에 실패했습니다.'
        });
    }
});

module.exports = router;
