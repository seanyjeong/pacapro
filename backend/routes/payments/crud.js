/**
 * paca/payments/crud.js — 결제 CRUD 라우터 (Phase 3 #6)
 *
 * 마운트: paca.js → routes/payments/index.js → require('./crud')(router)
 *         mount path: '/paca/payments'
 *
 * Endpoint (4건 — :id 와일드카드 포함):
 *   - GET    /:id   — 결제 상세 조회 (학생 정보 포함)
 *   - POST   /      — 단건 결제 청구 등록 (백원 단위 절삭)
 *   - PUT    /:id   — 결제 수정 (dynamic update, 11 필드, 금액 변경 시 final_amount 재계산)
 *   - DELETE /:id   — 결제 삭제 (owner only)
 *
 * 인증:
 *   - GET / POST / PUT: verifyToken + checkPermission('payments', 'view'|'edit')
 *   - DELETE: verifyToken + requireRole('owner')
 *
 * 응답 표면 보존 (ADR-013):
 *   GET    /:id → { payment }
 *   POST   /    → { message, payment } (201)
 *   PUT    /:id → { message, payment }
 *   DELETE /:id → { message, payment:{ id, student_name } }
 *   4xx/5xx     → { error, message }
 *
 * DB 호출 (ADR-005): pool.execute (10건). db.query 잔존 0건.
 * ADR-007: decrypt 시그니처 무변경 (decryptStudentName 헬퍼).
 *
 * **PUT /:id `?? null` 명시 변환 (lesson #232)**:
 *   원본 db.query (mysql2 text protocol) 는 dynamic params 의 undefined 자동 NULL 변환.
 *   pool.execute (prepared statement) 는 undefined throw → params 빌드 시
 *   `params.push(value ?? null)` 명시. 다만 본 모듈은 `if (field !== undefined)` 가드로
 *   undefined 제외 후 params.push 하므로 자동으로 안전 (null 입력은 그대로 push 됨).
 *
 * 분리 결정 (ADR-006): ~280줄 — 분리 불요.
 */

const { pool, decryptStudentName, logger } = require('./_utils');
const { billFinalAmount, billFinalAfterChange, hasSeparateFinal, sameDecimal } = require('../../utils/monthlyBillAmounts');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { remainingAmountSql } = require('../../utils/paymentAmountSql');
const { lockStudentForBilling } = require('../../repositories/studentBillingLock');

// 청구 수정 화면이 서버와 같은 식으로 미리 보도록 내려 주는 값:
// separately_priced — 휴원·퇴원 정산 등으로 최종 금액을 따로 정한 청구(기본·할인 금액 잠금), credit_amount — 이미 적용된 크레딧
function withBillFlags(payment) {
    return { ...payment, separately_priced: hasSeparateFinal(payment), credit_amount: Number(payment.carryover_amount) || 0 };
}

const SEPARATELY_PRICED_MESSAGE = '휴원·퇴원 정산 등으로 금액이 따로 정해진 청구는 기본·할인 금액을 바꿀 수 없습니다. 추가 금액으로 조정해 주세요.';

module.exports = function(router) {

/**
 * GET /paca/payments/:id
 * Get payment by ID
 * Access: owner, admin
 */
router.get('/:id', verifyToken, checkPermission('payments', 'view'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        const [payments] = await pool.execute(
            `SELECT
                p.*,
                ${remainingAmountSql('p')} as remaining_amount,
                s.name as student_name,
                s.father_name, s.mother_name,
                s.student_number,
                s.phone,
                s.parent_phone
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?
            AND s.academy_id = ?`,
            [paymentId, req.user.academyId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        res.json({
            payment: withBillFlags(decryptStudentName(payments[0]))
        });
    } catch (error) {
        logger.error('Error fetching payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역을 불러오는데 실패했습니다.'
        });
    }
});

/**
 * POST /paca/payments
 * Create new payment record (charge)
 * Access: owner, admin
 */
router.post('/', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    try {
        const {
            student_id,
            payment_type,
            base_amount,
            discount_amount,
            additional_amount,
            due_date,
            year_month,
            notes,
            description
        } = req.body;

        // Validation
        if (!student_id || !payment_type || !base_amount || !due_date || !year_month) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '필수 항목을 모두 입력해주세요. (학생, 결제유형, 금액, 납부기한, 청구월)'
            });
        }

        // Verify student exists and belongs to this academy
        const [students] = await pool.execute(
            "SELECT id, academy_id FROM students WHERE id = ? AND academy_id = ? AND (status IS NULL OR status <> 'prospect') AND deleted_at IS NULL",
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        // 최종 금액: 월 청구와 같은 공통 식(천원 절삭, 0 미만이면 0)
        const finalAmount = billFinalAmount(base_amount, discount_amount, additional_amount);

        // 학생을 잠그고(다른 청구 경로와 같은 순서) 월 청구는 같은 학생·같은 달 월 청구가 이미 있으면 409.
        // 운영 표의 유일 키 유무와 상관없이 같은 달 월 청구가 두 개 생기지 않는다. 시즌비 등 다른 종류는 예전처럼 여러 건 가능.
        const conn = await pool.getConnection();
        let result;
        try {
            await conn.beginTransaction();
            await lockStudentForBilling(conn, student_id, req.user.academyId);
            if (payment_type === 'monthly') {
                const [existing] = await conn.execute(
                    `SELECT id FROM student_payments
                     WHERE student_id = ? AND \`year_month\` = ? AND payment_type = 'monthly' FOR UPDATE`,
                    [student_id, year_month]
                );
                if (existing.length > 0) {
                    await conn.rollback();
                    return res.status(409).json({
                        error: 'Conflict',
                        message: `${year_month} 월 학원비 청구가 이미 있습니다. 금액은 그 청구를 수정해 주세요.`
                    });
                }
            }

            // Insert payment record
            [result] = await conn.execute(
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
                    notes,
                    recorded_by
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`,
                [
                    student_id,
                    students[0].academy_id,
                    year_month,
                    payment_type,
                    base_amount,
                    discount_amount || 0,
                    additional_amount || 0,
                    finalAmount,
                    due_date,
                    description ?? null,
                    notes ?? null,
                    req.user.userId
                ]
            );
            await conn.commit();
        } catch (error) {
            await conn.rollback();
            throw error;
        } finally {
            conn.release();
        }

        // Fetch created payment
        const [payments] = await pool.execute(
            `SELECT
                p.*,
                ${remainingAmountSql('p')} as remaining_amount,
                s.name as student_name,
                s.father_name, s.mother_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [result.insertId]
        );

        res.status(201).json({
            message: '납부 내역이 생성되었습니다.',
            payment: payments[0]
        });
    } catch (error) {
        logger.error('Error creating payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 생성에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/payments/:id
 * Update payment record
 * Access: owner, admin
 *
 * Dynamic update — 11 필드 (payment_type / base_amount / discount_amount / additional_amount /
 * due_date / paid_date / paid_amount / payment_method / payment_status / description / notes).
 * 금액 필드 (base_amount / discount_amount / additional_amount) 변경 시 final_amount 재계산.
 */
router.put('/:id', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    // 한 트랜잭션: 학생 → 청구 순서로 잠그고(다른 청구 경로와 같은 순서, repositories/studentBillingLock) 같은 트랜잭션에서 읽고 쓴다
    const conn = await pool.getConnection();
    let committed = false;
    try {
        await conn.beginTransaction();

        // Verify payment exists and belongs to this academy
        const [payments] = await conn.execute(
            `SELECT p.id, p.student_id, s.academy_id
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        if (payments[0].academy_id !== req.user.academyId) {
            return res.status(403).json({
                error: 'Forbidden',
                message: '접근 권한이 없습니다.'
            });
        }

        await lockStudentForBilling(conn, payments[0].student_id, req.user.academyId);
        const [[current]] = await conn.execute(
            'SELECT base_amount, discount_amount, additional_amount, carryover_amount, final_amount FROM student_payments WHERE id = ? FOR UPDATE',
            [paymentId]
        );

        const {
            payment_type,
            base_amount,
            discount_amount,
            additional_amount,
            due_date,
            paid_date,
            paid_amount,
            payment_method,
            payment_status,
            description,
            notes
        } = req.body;

        // 휴원·퇴원 정산 등으로 최종 금액을 따로 정한 청구는 기본·할인 금액을 바꿀 수 없다(화면은 칸을 잠근다, 화면을 거치지 않은 요청도 막는다).
        // 기본 금액을 줄인 금액으로 고치면 '바꾼 차이만큼' 식으로 0원이 될 수 있었다. 추가 금액은 바꾼 차이만큼 움직인다.
        const changes = key => req.body[key] !== undefined && !sameDecimal(req.body[key], current[key]);
        if (hasSeparateFinal(current) && (changes('base_amount') || changes('discount_amount'))) {
            return res.status(400).json({ error: 'Validation Error', message: SEPARATELY_PRICED_MESSAGE });
        }

        // Build update query dynamically
        const updates = [];
        const params = [];

        if (payment_type !== undefined) {
            updates.push('payment_type = ?');
            params.push(payment_type);
        }
        if (base_amount !== undefined) {
            updates.push('base_amount = ?');
            params.push(base_amount);
        }
        if (discount_amount !== undefined) {
            updates.push('discount_amount = ?');
            params.push(discount_amount);
        }
        if (additional_amount !== undefined) {
            updates.push('additional_amount = ?');
            params.push(additional_amount);
        }

        // Recalculate final_amount if any amount fields changed
        if (base_amount !== undefined || discount_amount !== undefined || additional_amount !== undefined) {
            // 월 청구와 같은 식: 천원 절삭(청구 대상 금액 − 이미 적용된 크레딧), 0 미만이면 0 (utils/monthlyBillAmounts)
            // - 보통 청구: 청구 대상 = 학원비 − 할인액 + 추가 (예전엔 천원 절삭 뒤 크레딧을 빼 월 청구와 최대 999원 달랐다)
            // - 휴원·퇴원·복귀로 최종 금액만 줄인 청구: 줄인 금액에서 바꾼 추가 금액 차이만큼만 더하고 뺀다
            // - 금액 칸이 그대로면 최종 금액도 그대로
            const finalAmount = billFinalAfterChange(current, { base_amount, discount_amount, additional_amount });
            updates.push('final_amount = ?');
            params.push(finalAmount);
        }

        if (due_date !== undefined) {
            updates.push('due_date = ?');
            params.push(due_date);
        }
        if (paid_date !== undefined) {
            updates.push('paid_date = ?');
            params.push(paid_date);
        }
        if (paid_amount !== undefined) {
            updates.push('paid_amount = ?');
            params.push(paid_amount);
        }
        if (payment_method !== undefined) {
            updates.push('payment_method = ?');
            params.push(payment_method);
        }
        if (payment_status !== undefined) {
            updates.push('payment_status = ?');
            params.push(payment_status);
        }
        if (description !== undefined) {
            updates.push('description = ?');
            params.push(description);
        }
        if (notes !== undefined) {
            updates.push('notes = ?');
            params.push(notes);
        }

        if (updates.length === 0) {
            return res.status(400).json({
                error: 'Validation Error',
                message: '수정할 항목이 없습니다.'
            });
        }

        updates.push('updated_at = NOW()');
        params.push(paymentId);

        await conn.execute(
            `UPDATE student_payments SET ${updates.join(', ')} WHERE id = ?`,
            params
        );
        await conn.commit();
        committed = true;

        // Fetch updated payment
        const [updated] = await pool.execute(
            `SELECT
                p.*,
                ${remainingAmountSql('p')} as remaining_amount,
                s.name as student_name,
                s.father_name, s.mother_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        res.json({
            message: '납부 내역이 수정되었습니다.',
            payment: withBillFlags(decryptStudentName(updated[0]))
        });
    } catch (error) {
        logger.error('Error updating payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 수정에 실패했습니다.'
        });
    } finally {
        if (!committed) await conn.rollback().catch(error => logger.error('Payment update rollback failed:', error));
        conn.release();
    }
});

/**
 * DELETE /paca/payments/:id
 * Delete payment record
 * Access: owner only
 */
router.delete('/:id', verifyToken, requireRole('owner'), async (req, res) => {
    const paymentId = parseInt(req.params.id);

    try {
        // Verify payment exists and belongs to this academy
        const [payments] = await pool.execute(
            `SELECT p.id, p.student_id, s.name as student_name
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ? AND p.academy_id = ?`,
            [paymentId, req.user.academyId]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '납부 내역을 찾을 수 없습니다.'
            });
        }

        // Delete payment record
        await pool.execute('DELETE FROM student_payments WHERE id = ?', [paymentId]);

        res.json({
            message: '납부 내역이 삭제되었습니다.',
            payment: {
                id: paymentId,
                student_name: payments[0].student_name
            }
        });
    } catch (error) {
        logger.error('Error deleting payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 삭제에 실패했습니다.'
        });
    }
});

};
