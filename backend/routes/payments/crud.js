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

const { pool, decryptStudentName, truncateToThousands, logger } = require('./_utils');
const { verifyToken, requireRole, checkPermission } = require('../../middleware/auth');
const { remainingAmountSql } = require('../../utils/paymentAmountSql');

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
            payment: decryptStudentName(payments[0])
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
            'SELECT id, academy_id FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [student_id, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'Not Found',
                message: '학생을 찾을 수 없습니다.'
            });
        }

        // Calculate final_amount (백원 단위 절삭)
        const finalAmount = truncateToThousands(
            parseFloat(base_amount) - parseFloat(discount_amount || 0) + parseFloat(additional_amount || 0)
        );

        // Insert payment record
        const [result] = await pool.execute(
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

        // Fetch created payment
        const [payments] = await pool.execute(
            `SELECT
                p.*,
                ${remainingAmountSql('p')} as remaining_amount,
                s.name as student_name,
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

    try {
        // Verify payment exists and belongs to this academy
        const [payments] = await pool.execute(
            `SELECT p.id, s.academy_id
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
            const [current] = await pool.execute(
                'SELECT base_amount, discount_amount, additional_amount, carryover_amount FROM student_payments WHERE id = ?',
                [paymentId]
            );
            const currentData = current[0];

            const newBase = base_amount !== undefined ? base_amount : currentData.base_amount;
            const newDiscount = discount_amount !== undefined ? discount_amount : currentData.discount_amount;
            const newAdditional = additional_amount !== undefined ? additional_amount : currentData.additional_amount;
            const currentCarryover = parseFloat(currentData.carryover_amount) || 0;

            const chargeBeforeCredit = truncateToThousands(
                parseFloat(newBase) - parseFloat(newDiscount) + parseFloat(newAdditional)
            );
            const finalAmount = Math.max(chargeBeforeCredit - currentCarryover, 0);
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

        await pool.execute(
            `UPDATE student_payments SET ${updates.join(', ')} WHERE id = ?`,
            params
        );

        // Fetch updated payment
        const [updated] = await pool.execute(
            `SELECT
                p.*,
                ${remainingAmountSql('p')} as remaining_amount,
                s.name as student_name,
                s.student_number
            FROM student_payments p
            JOIN students s ON p.student_id = s.id
            WHERE p.id = ?`,
            [paymentId]
        );

        res.json({
            message: '납부 내역이 수정되었습니다.',
            payment: decryptStudentName(updated[0])
        });
    } catch (error) {
        logger.error('Error updating payment:', error);
        res.status(500).json({
            error: 'Server Error',
            message: '납부 내역 수정에 실패했습니다.'
        });
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
