const db = require('../../config/database');
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { truncateToThousands, countClassDaysInPeriod } = require('./_utils');

module.exports = function(router) {

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
        logger.error('Error fetching rest credits:', error);
        res.status(500).json({
            error: 'Server Error',
            message: 'Failed to fetch rest credits'
        });
    }
});

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
 *
 * Body (금액 직접 입력):
 * {
 *   direct_amount: 50000,
 *   reason: "시험기간",
 *   notes?: "추가 메모"
 * }
 */
router.post('/:id/manual-credit', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { start_date, end_date, class_count, direct_amount, reason, notes } = req.body;

    try {
        // 유효성 검사
        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                error: 'Bad Request',
                message: '사유는 필수입니다.'
            });
        }

        // 날짜 입력, 회차 입력, 금액 직접 입력 중 하나는 있어야 함
        const hasDateInput = start_date && end_date;
        const hasCountInput = class_count && class_count > 0;
        const hasDirectAmount = direct_amount && direct_amount > 0;

        if (!hasDateInput && !hasCountInput && !hasDirectAmount) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '날짜 기간, 회차, 또는 금액을 입력해주세요.'
            });
        }

        if (hasCountInput && (class_count < 1 || class_count > 12)) {
            return res.status(400).json({
                error: 'Bad Request',
                message: '회차는 1~12 사이여야 합니다.'
            });
        }

        if (hasDirectAmount) {
            if (!Number.isInteger(direct_amount) || direct_amount < 1000 || direct_amount > 10000000) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '금액은 1,000원 ~ 10,000,000원 사이의 정수여야 합니다.'
                });
            }
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

        let creditAmount;
        let finalClassCount = 0;
        let classDatesInfo = null;
        let periodInfo = null;
        let perClassFee = 0;
        const today = new Date().toISOString().split('T')[0];

        if (hasDirectAmount) {
            // 금액 직접 입력 - perClassFee 계산 불필요
            creditAmount = direct_amount;
        } else {
            // 날짜/회차 모드는 월 수강료 필요
            if (monthlyTuition <= 0) {
                return res.status(400).json({
                    error: 'Bad Request',
                    message: '월 수강료가 설정되지 않은 학생입니다.'
                });
            }

            // 1회 금액 계산
            perClassFee = truncateToThousands(monthlyTuition / (weeklyCount * 4));

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
            creditAmount = truncateToThousands(perClassFee * finalClassCount);
        }

        const noteText = `[수동 크레딧] ${reason}${classDatesInfo ? ` (${classDatesInfo.join(', ')})` : ''}${hasDirectAmount ? ' (직접입력)' : ''}${notes ? '\n' + notes : ''}`;

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
        logger.error('Error creating manual credit:', error);
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
        logger.error('Error fetching credits:', error);
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
        logger.error('Error updating credit:', error);
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
        logger.error('Error deleting credit:', error);
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
        logger.error('Error applying credit:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '크레딧 적용에 실패했습니다.'
        });
    }
});

};
