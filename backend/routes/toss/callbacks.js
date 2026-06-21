/**
 * paca/toss/callbacks.js — 토스 결제 콜백 라우터 (Phase 3 #8)
 *
 * 마운트: paca.js → routes/toss/index.js → require('./callbacks')(router)
 *         mount path: '/paca/toss'
 *
 * Endpoint (2건):
 *   - POST /payment-callback — 결제 완료 콜백 (트랜잭션 + 큐 fallback 3단계)
 *   - POST /cancel-callback  — 결제 취소 콜백 (트랜잭션 + 환불 처리)
 *
 * 인증: verifyCallbackSignature (HMAC-SHA256, X-Toss-Signature). verifyToken 미적용.
 *   토스 측이 본 서버를 호출하는 webhook 수신 모델 — 서명 검증으로 신뢰.
 *
 * 응답 표면 보존 (ADR-013):
 *   POST /payment-callback (성공 매칭) →
 *     { success, matched:true, paymentId, studentPaymentStatus, paidAmount, remainingAmount }
 *   POST /payment-callback (큐 fallback) →
 *     { success, matched:false, message, queueReason }
 *   POST /payment-callback (중복) →
 *     { success, message, duplicate:true }
 *   POST /cancel-callback (성공) →
 *     { success, matched:true, paymentId, refundAmount, newStatus, newPaidAmount, remainingAmount }
 *   POST /cancel-callback (큐 fallback) →
 *     { success, matched:false, message, queueReason }
 *   POST /cancel-callback (중복) →
 *     { success, message, duplicate:true }
 *   4xx/5xx → { success:false, error, message }
 *
 * DB 호출 (ADR-005): conn.execute (트랜잭션 내부) + pool.execute. db.query / connection.query 잔존 0건.
 * ADR-016 IN 절: 본 파일 IN 절 사용 0건.
 *
 * 보안 (ADR-007): verifyCallbackSignature 의 HMAC-SHA256 검증을 통과한 요청만 본 핸들러 도달.
 *   외부 결제 API 호출 X (inbound webhook 수신만).
 *
 * 분리 결정 (ADR-006): ~440줄. 트랜잭션 + 큐 fallback 3단계 강결합으로 추가 분리 시
 *   회귀 위험 큼. ADR-015 분리 미루기 — toss 도메인 LIVE 미사용 (사장님 결정 2026-05-02)
 *   상태에서 충분.
 */

const { pool, verifyCallbackSignature, logger } = require('./_utils');

module.exports = function(router) {

/**
 * POST /paca/toss/payment-callback
 * 토스 결제 완료 콜백 수신
 *
 * 보안: 서명 검증 + 타임스탬프 검증
 *
 * 큐 fallback 3단계:
 *   1) academyId 누락 → toss_payment_queue (academy_id NULL, queueReason: ACADEMY_ID_MISSING)
 *   2) orderId 형식 불일치 → toss_payment_queue (queueReason: ORDER_ID_FORMAT)
 *   3) payment_id 미존재 → toss_payment_queue (match_status: error, queueReason: PAYMENT_NOT_FOUND)
 *   정상 → student_payments UPDATE + toss_payment_history INSERT
 */
router.post('/payment-callback', verifyCallbackSignature, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            orderId,           // 주문번호: PACA-{payment_id}-{timestamp}
            paymentKey,        // 토스 결제 키
            amount,            // 결제 금액
            status,            // 결제 상태 (DONE, CANCELED 등)
            method,            // 결제 수단 (CARD, CASH 등)
            approvedAt,        // 승인 시간
            receipt,           // 영수증 정보
            card,              // 카드 정보
            metadata           // 커스텀 메타데이터
        } = req.body;

        logger.info('[Toss] Payment callback received:', {
            orderId,
            paymentKey,
            amount,
            status,
            method
        });

        // 중복 처리 방지
        const [existing] = await connection.execute(
            `SELECT id FROM toss_payment_history WHERE payment_key = ?`,
            [paymentKey]
        );

        if (existing.length > 0) {
            await connection.rollback();
            return res.json({
                success: true,
                message: '이미 처리된 결제입니다.',
                duplicate: true
            });
        }

        // 주문번호 파싱: PACA-{payment_id}-{timestamp}
        const orderIdMatch = orderId.match(/^PACA-(\d+)-(\d+)$/);
        const academyId = metadata?.academyId;

        // 학원 ID 필수 검증 (기본값 1 제거!)
        if (!academyId) {
            logger.warn('[Toss] Academy ID missing in callback:', orderId);
            // 대기열에 추가 (수동 확인 필요)
            await connection.execute(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, receipt_url, card_company, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [
                    orderId,
                    paymentKey,
                    amount,
                    method,
                    approvedAt ? new Date(approvedAt) : null,
                    receipt?.url ?? null,
                    card?.company ?? null,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    '학원 ID 누락 - 수동 확인 필요'
                ]
            );
            await connection.commit();
            return res.json({
                success: true,
                matched: false,
                message: '결제 수신 완료 (학원 ID 확인 필요)',
                queueReason: 'ACADEMY_ID_MISSING'
            });
        }

        if (!orderIdMatch) {
            // 자동 매칭 실패 → 수동 확인 대기열에 추가
            await connection.execute(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, receipt_url, card_company, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`,
                [
                    academyId,
                    orderId,
                    paymentKey,
                    amount,
                    method,
                    approvedAt ? new Date(approvedAt) : null,
                    receipt?.url ?? null,
                    card?.company ?? null,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    '주문번호 형식 불일치'
                ]
            );

            await connection.commit();

            logger.info('[Toss] Payment added to queue (format mismatch):', orderId);

            return res.json({
                success: true,
                matched: false,
                message: '결제 수신 완료 (수동 매칭 필요)',
                queueReason: 'ORDER_ID_FORMAT'
            });
        }

        const paymentId = parseInt(orderIdMatch[1]);

        // P-ACA 결제 레코드 조회
        const [existingPayment] = await connection.execute(
            `SELECT * FROM student_payments WHERE id = ? AND academy_id = ?`,
            [paymentId, academyId]
        );

        if (existingPayment.length === 0) {
            // 결제 ID 불일치 → 대기열 추가
            await connection.execute(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, receipt_url, card_company, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'error', ?)`,
                [
                    academyId,
                    orderId,
                    paymentKey,
                    amount,
                    method,
                    approvedAt ? new Date(approvedAt) : null,
                    receipt?.url ?? null,
                    card?.company ?? null,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    `Payment ID ${paymentId} not found`
                ]
            );

            await connection.commit();

            logger.info('[Toss] Payment added to queue (ID not found):', paymentId);

            return res.json({
                success: true,
                matched: false,
                message: '결제 ID를 찾을 수 없습니다.',
                queueReason: 'PAYMENT_NOT_FOUND'
            });
        }

        const payment = existingPayment[0];
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const newPaidAmount = currentPaidAmount + parseFloat(amount);
        const finalAmount = parseFloat(payment.final_amount);
        const remainingAmount = finalAmount - newPaidAmount;
        const newStatus = remainingAmount <= 0 ? 'paid' : 'partial';

        // 결제 방법 매핑
        const paymentMethodMap = {
            'CARD': 'card',
            'CASH': 'cash',
            'TRANSFER': 'account',
            'MOBILE': 'other',
            'OTHER': 'other'
        };

        // student_payments 업데이트
        await connection.execute(
            `UPDATE student_payments SET
                paid_amount = ?,
                payment_status = ?,
                payment_method = ?,
                paid_date = ?,
                notes = CONCAT(IFNULL(notes, ''), ?)
            WHERE id = ?`,
            [
                newPaidAmount,
                newStatus,
                paymentMethodMap[method] || 'card',
                approvedAt ? new Date(approvedAt).toISOString().split('T')[0] : new Date().toISOString().split('T')[0],
                `\n[토스] ${amount.toLocaleString()}원 결제 (${new Date().toLocaleString('ko-KR')})`,
                paymentId
            ]
        );

        // 토스 결제 이력 저장
        await connection.execute(
            `INSERT INTO toss_payment_history (
                payment_id, academy_id, order_id, payment_key, amount, method,
                approved_at, receipt_url, card_company, card_number,
                installment_months, status, raw_data
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
            [
                paymentId,
                academyId,
                orderId,
                paymentKey,
                amount,
                method,
                approvedAt ? new Date(approvedAt) : null,
                receipt?.url ?? null,
                card?.company ?? null,
                card?.number ?? null,
                card?.installmentPlanMonths || 0,
                status ?? null,
                JSON.stringify(req.body)
            ]
        );

        await connection.commit();

        logger.info('[Toss] Payment matched successfully:', {
            paymentId,
            amount,
            newStatus,
            newPaidAmount
        });

        res.json({
            success: true,
            matched: true,
            paymentId,
            studentPaymentStatus: newStatus,
            paidAmount: newPaidAmount,
            remainingAmount: Math.max(0, remainingAmount)
        });

    } catch (error) {
        await connection.rollback();
        logger.error('[Toss] Error processing callback:', error);

        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '결제 처리에 실패했습니다.'
        });
    } finally {
        connection.release();
    }
});

/**
 * POST /paca/toss/cancel-callback
 * 토스 결제 취소 콜백 수신
 *
 * 토스 터미널/프론트에서 취소 시 호출됨
 */
router.post('/cancel-callback', verifyCallbackSignature, async (req, res) => {
    const connection = await pool.getConnection();

    try {
        await connection.beginTransaction();

        const {
            orderId,           // 주문번호: PACA-{payment_id}-{timestamp}
            paymentKey,        // 토스 결제 키
            cancelAmount,      // 취소 금액
            cancelReason,      // 취소 사유
            canceledAt,        // 취소 시간
            metadata           // 커스텀 메타데이터
        } = req.body;

        logger.info('[Toss] Cancel callback received:', {
            orderId,
            paymentKey,
            cancelAmount,
            cancelReason
        });

        // 기존 결제 이력 조회
        const [existingHistory] = await connection.execute(
            `SELECT * FROM toss_payment_history WHERE payment_key = ?`,
            [paymentKey]
        );

        if (existingHistory.length === 0) {
            // 결제 이력 없음 → 대기열에 추가
            const academyId = metadata?.academyId || 1;

            await connection.execute(
                `INSERT INTO toss_payment_queue (
                    academy_id, order_id, payment_key, amount, method,
                    approved_at, metadata, raw_data,
                    match_status, error_reason
                ) VALUES (?, ?, ?, ?, 'CANCEL', ?, ?, ?, 'pending', ?)`,
                [
                    academyId,
                    orderId,
                    paymentKey,
                    cancelAmount ?? null,
                    canceledAt ? new Date(canceledAt) : null,
                    JSON.stringify(metadata),
                    JSON.stringify(req.body),
                    '원본 결제 이력 없음 - 수동 확인 필요'
                ]
            );

            await connection.commit();

            return res.json({
                success: true,
                matched: false,
                message: '취소 수신 완료 (수동 확인 필요)',
                queueReason: 'ORIGINAL_NOT_FOUND'
            });
        }

        const history = existingHistory[0];
        const paymentId = history.payment_id;
        const academyId = history.academy_id;

        // 이미 취소된 건인지 확인
        if (history.status === 'CANCELED') {
            await connection.rollback();
            return res.json({
                success: true,
                message: '이미 취소된 결제입니다.',
                duplicate: true
            });
        }

        // student_payments 조회
        const [payments] = await connection.execute(
            `SELECT * FROM student_payments WHERE id = ?`,
            [paymentId]
        );

        if (payments.length === 0) {
            await connection.rollback();
            return res.status(404).json({
                success: false,
                error: 'Not Found',
                message: '결제 내역을 찾을 수 없습니다.'
            });
        }

        const payment = payments[0];
        const currentPaidAmount = parseFloat(payment.paid_amount) || 0;
        const refundAmount = parseFloat(cancelAmount) || parseFloat(history.amount);
        const newPaidAmount = Math.max(0, currentPaidAmount - refundAmount);
        const finalAmount = parseFloat(payment.final_amount);

        // 새 상태 결정
        let newStatus;
        if (newPaidAmount <= 0) {
            newStatus = 'pending';
        } else if (newPaidAmount < finalAmount) {
            newStatus = 'partial';
        } else {
            newStatus = 'paid';
        }

        // student_payments 업데이트
        await connection.execute(
            `UPDATE student_payments SET
                paid_amount = ?,
                payment_status = ?,
                notes = CONCAT(IFNULL(notes, ''), ?)
            WHERE id = ?`,
            [
                newPaidAmount,
                newStatus,
                `\n[토스 취소] ${refundAmount.toLocaleString()}원 환불 (${cancelReason || '사유 없음'}) (${new Date().toLocaleString('ko-KR')})`,
                paymentId
            ]
        );

        // toss_payment_history 상태 업데이트
        await connection.execute(
            `UPDATE toss_payment_history SET
                status = 'CANCELED',
                raw_data = JSON_SET(COALESCE(raw_data, '{}'), '$.cancel', ?)
            WHERE id = ?`,
            [
                JSON.stringify({
                    cancelAmount: refundAmount,
                    cancelReason,
                    canceledAt,
                    raw: req.body
                }),
                history.id
            ]
        );

        await connection.commit();

        logger.info('[Toss] Cancel processed successfully:', {
            paymentId,
            refundAmount,
            newStatus,
            newPaidAmount
        });

        res.json({
            success: true,
            matched: true,
            paymentId,
            refundAmount,
            newStatus,
            newPaidAmount,
            remainingAmount: finalAmount - newPaidAmount
        });

    } catch (error) {
        await connection.rollback();
        logger.error('[Toss] Error processing cancel callback:', error);

        res.status(500).json({
            success: false,
            error: 'Server Error',
            message: '취소 처리에 실패했습니다.'
        });
    } finally {
        connection.release();
    }
});

};
