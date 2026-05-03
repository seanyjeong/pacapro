/**
 * paca/students — 휴식/공결/수동 크레딧 sub-라우터
 *
 * 마운트: backend/routes/students/index.js → require('./credits')(router)
 * Express 부착 경로: /paca/students/:id/(rest-credits|manual-credit|credits|...)
 *
 * 책임:
 *   - 학생별 휴식/수동 크레딧 조회 / 생성 / 수정 / 삭제 / 학원비 적용
 *   - rest_credits 테이블 CRUD + student_payments 테이블의 carryover/final_amount/notes/rest_credit_id 갱신
 *
 * 인증: 모든 endpoint 가 verifyToken (sub-라우터 내부 적용 — index.js 광역 미들웨어 X, ADR-014).
 *       쓰기 endpoint (manual-credit / PUT/DELETE / apply) 는 추가로 checkPermission('payments', 'edit').
 *
 * 응답 표면 (ADR-013, 보존 의무):
 *   - GET /:id/rest-credits      → { message, student, credits, pendingTotal }
 *     소비처: src/components/students/student-payments.tsx (`result.credits`, `result.pendingTotal` 직접 소비)
 *             타입: src/lib/types/student.ts RestCreditsResponse
 *   - POST /:id/manual-credit    → { message, credit, calculation:{...} }
 *     타입: src/lib/types/student.ts ManualCreditResponse
 *   - GET /:id/credits           → { credits }
 *     소비처: src/components/students/manual-credit-modal.tsx (`response.credits` 직접 소비)
 *   - PUT /:id/credits/:creditId → { message }
 *   - DELETE /:id/credits/:creditId → { message }
 *   - POST /:id/credits/:creditId/apply → { message, applied_amount, new_final_amount, credit_remaining }
 *     소비처: src/components/students/manual-credit-modal.tsx, student-payments.tsx
 *   - 에러 응답은 모두 { error, message } root 키 표면 (axios 인터셉터 호환).
 *   ⇒ 위 표면을 RULES.md 표준 ({data, meta} / {error:{code,message}}) 으로 옮기는 작업은
 *      프론트 동시 변경 트랙으로 분리. 본 리팩에서는 표면 100% 보존.
 *
 * DB 패턴 (ADR-005): 모든 호출 pool.execute(sql, params).
 *   - 단일 query 모두 pool.execute 로 통일 (db.query 잔재 0건).
 *   - 트랜잭션 영역 없음 (모든 endpoint 단일 query 1~3건). 트랜잭션 도입 시 conn.execute 사용.
 *
 * 보안 (ADR-007):
 *   - decrypt(name) 헬퍼 (utils/encryption) 시그니처 무변경 (manual-credit 응답 메시지 학생명 표시).
 *   - 사용자 노출 detail (e.message 등) 절대 0건. 시스템 정보 누출 차단.
 *   - 결제(toss) 미접촉. payments 테이블 미접촉. student_payments 갱신은 학사 데이터 (학원비 청구 내역) — toss 결제 트랜잭션과 분리.
 *
 * 분리 결정 (ADR-006 / ADR-015):
 *   - 528줄 (500줄 임계 28줄 초과). ADR-015 "Tier 임계 살짝 초과 모듈은 분리 미루기 + ADR-005 통일만 우선" 적용.
 *   - 자매 모듈 enrollment.js (494줄, ADR-005만) / rest.js (497줄, ADR-005만) 와 동일 정책.
 *   - 분리 트랙은 phase 2 후반 / phase 3 진입 시 students sub-라우터 통합 분리 컨펌과 함께 본격 진행.
 *
 * 한국어 메시지 (ADR-003):
 *   - 사용자 노출 메시지 100% 한국어. 영문 'Server Error' / 'Not Found' / 'Bad Request' 같은 표면 메시지 0건.
 *   - error.code (영문, 개발자/로그용) + error.message (한국어 친화) 분리.
 */

const db = require('../../config/database');
const pool = db; // ADR-005 / ADR-011: pool alias 점진 마이그레이션 (mysql2 promise pool 동일 인스턴스)
const { verifyToken, checkPermission } = require('../../middleware/auth');
const { decrypt } = require('../../utils/encryption');
const logger = require('../../utils/logger');
const { truncateToThousands, countClassDaysInPeriod } = require('./_utils');

module.exports = function(router) {

/**
 * GET /paca/students/:id/rest-credits
 * 학생의 휴식 크레딧 내역 조회
 *
 * Access: verifyToken (owner / admin / teacher 등 인증된 모든 사용자, 권한 체크 X)
 * 응답 표면 (ADR-013): { message, student:{id,name}, credits:[...], pendingTotal }
 */
router.get('/:id/rest-credits', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        // 학생 존재 확인 (학원 격리)
        const [students] = await pool.execute(
            'SELECT id, name FROM students WHERE id = ? AND academy_id = ? AND deleted_at IS NULL',
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '학생 정보를 찾을 수 없습니다.'
            });
        }

        // 휴식 크레딧 내역 조회 (최신순)
        const [credits] = await pool.execute(
            `SELECT * FROM rest_credits
             WHERE student_id = ?
             ORDER BY created_at DESC`,
            [studentId]
        );

        // 미적용 크레딧 합계 (pending + partial 의 remaining_amount 합)
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
            error: 'FETCH_REST_CREDITS_FAILED',
            message: '크레딧 내역을 불러오지 못했습니다.'
        });
    }
});

/**
 * POST /paca/students/:id/manual-credit
 * 수동 크레딧 생성
 *
 * Access: verifyToken + checkPermission('payments', 'edit')
 *
 * Body — 다음 셋 중 하나:
 *   1) 날짜로 입력: { start_date: 'YYYY-MM-DD', end_date: 'YYYY-MM-DD', reason, notes? }
 *   2) 회차로 입력: { class_count: 1~12, reason, notes? }
 *   3) 금액 직접 입력: { direct_amount: 1,000~10,000,000, reason, notes? }
 *
 * 처리:
 *   - 날짜/회차 모드는 학생.monthly_tuition / weekly_count 로 1회 금액 계산 후 크레딧 금액 산출.
 *   - 금액 직접 입력 모드는 입력값 그대로 저장 (1회 금액 계산 X).
 *
 * 응답 표면 (ADR-013): { message, credit, calculation:{monthly_tuition,weekly_count,per_class_fee,class_count,class_dates,total_credit} }
 */
router.post('/:id/manual-credit', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const { start_date, end_date, class_count, direct_amount, reason, notes } = req.body;

    try {
        // 사유 필수
        if (!reason || reason.trim() === '') {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '사유는 필수입니다.'
            });
        }

        // 입력 모드 결정 (날짜 / 회차 / 금액 직접 중 하나는 있어야 함)
        const hasDateInput = start_date && end_date;
        const hasCountInput = class_count && class_count > 0;
        const hasDirectAmount = direct_amount && direct_amount > 0;

        if (!hasDateInput && !hasCountInput && !hasDirectAmount) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '날짜 기간, 회차, 또는 금액을 입력해주세요.'
            });
        }

        if (hasCountInput && (class_count < 1 || class_count > 12)) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '회차는 1~12 사이여야 합니다.'
            });
        }

        if (hasDirectAmount) {
            if (!Number.isInteger(direct_amount) || direct_amount < 1000 || direct_amount > 10000000) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '금액은 1,000원 ~ 10,000,000원 사이의 정수여야 합니다.'
                });
            }
        }

        // 학생 정보 조회 (학원 격리)
        const [students] = await pool.execute(
            `SELECT id, name, monthly_tuition, weekly_count, class_days
             FROM students
             WHERE id = ? AND academy_id = ? AND deleted_at IS NULL`,
            [studentId, req.user.academyId]
        );

        if (students.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
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
            // 금액 직접 입력 — perClassFee 계산 불필요
            creditAmount = direct_amount;
        } else {
            // 날짜/회차 모드: 월 수강료 필수
            if (monthlyTuition <= 0) {
                return res.status(400).json({
                    error: 'VALIDATION_ERROR',
                    message: '월 수강료가 설정되지 않은 학생입니다.'
                });
            }

            // 1회 금액 계산 (월 수강료 / (주당횟수 × 4주), 1,000원 단위 절사)
            perClassFee = truncateToThousands(monthlyTuition / (weeklyCount * 4));

            if (hasDateInput) {
                // 날짜로 입력 — 수업 횟수 자동 계산 (학생.class_days 기반)
                if (classDays.length === 0) {
                    return res.status(400).json({
                        error: 'VALIDATION_ERROR',
                        message: '학생의 수업 요일이 설정되지 않았습니다. 회차로 입력해주세요.'
                    });
                }

                const result = countClassDaysInPeriod(start_date, end_date, classDays);
                finalClassCount = result.count;
                classDatesInfo = result.dates;
                periodInfo = { start_date, end_date };

                if (finalClassCount === 0) {
                    return res.status(400).json({
                        error: 'VALIDATION_ERROR',
                        message: '해당 기간에 수업일이 없습니다.'
                    });
                }
            } else {
                // 회차로 직접 입력
                finalClassCount = class_count;
            }

            // 크레딧 금액 = 1회 금액 × 회차 (1,000원 단위 절사)
            creditAmount = truncateToThousands(perClassFee * finalClassCount);
        }

        // 크레딧 메모 (사유 + 수업일 / 직접입력 표식 + 추가 메모)
        const noteText = `[수동 크레딧] ${reason}${classDatesInfo ? ` (${classDatesInfo.join(', ')})` : ''}${hasDirectAmount ? ' (직접입력)' : ''}${notes ? '\n' + notes : ''}`;

        // 크레딧 INSERT (status=pending, source_payment_id=NULL → 결제 미연결 수동 생성)
        const [result] = await pool.execute(
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

        // 생성된 크레딧 재조회
        const [newCredits] = await pool.execute(
            'SELECT * FROM rest_credits WHERE id = ?',
            [result.insertId]
        );

        // 학생명 복호화 (응답 메시지에 노출, ADR-007 헬퍼 시그니처 무변경)
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
            error: 'CREATE_CREDIT_FAILED',
            message: '크레딧 생성에 실패했습니다.'
        });
    }
});

/**
 * GET /paca/students/:id/credits
 * 학생의 크레딧 목록 조회 (모달용 가벼운 버전)
 *
 * Access: verifyToken
 * 응답 표면 (ADR-013): { credits:[...] }
 */
router.get('/:id/credits', verifyToken, async (req, res) => {
    const studentId = parseInt(req.params.id);

    try {
        const [credits] = await pool.execute(
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
            error: 'FETCH_CREDITS_FAILED',
            message: '크레딧 조회에 실패했습니다.'
        });
    }
});

/**
 * PUT /paca/students/:id/credits/:creditId
 * 크레딧 수정 (금액 / 메모 / 상태)
 *
 * Access: verifyToken + checkPermission('payments', 'edit')
 *
 * Body: { credit_amount?, notes?, status? }
 *   - credit_amount 변경 시 remaining_amount 도 함께 변경 (전체 사용 가능 금액 재설정)
 *   - status 'applied' 는 학원비 적용 시에만 자동 변경 — 수동 변경 차단
 *
 * 응답 표면 (ADR-013): { message }
 */
router.put('/:id/credits/:creditId', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const creditId = parseInt(req.params.creditId);
    const { credit_amount, notes, status } = req.body;

    try {
        // 크레딧 존재 + 학원/학생 격리 확인
        const [existing] = await pool.execute(
            `SELECT * FROM rest_credits WHERE id = ? AND student_id = ? AND academy_id = ?`,
            [creditId, studentId, req.user.academyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '크레딧을 찾을 수 없습니다.'
            });
        }

        const credit = existing[0];

        // 이미 사용된 크레딧은 금액 수정 불가 (회계 정합성)
        if (credit.status === 'used' && credit_amount !== undefined && credit_amount !== credit.credit_amount) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '이미 사용된 크레딧은 금액을 수정할 수 없습니다.'
            });
        }

        // 동적 UPDATE 필드 빌드 (제공된 필드만 업데이트)
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
                    error: 'VALIDATION_ERROR',
                    message: "'applied' 상태는 학원비 적용 시 자동으로 변경됩니다. 수동 변경 불가."
                });
            }
            updateFields.push('status = ?');
            updateValues.push(status);
        }

        if (updateFields.length === 0) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '수정할 내용이 없습니다.'
            });
        }

        updateValues.push(creditId);

        await pool.execute(
            `UPDATE rest_credits SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );

        res.json({ message: '크레딧이 수정되었습니다.' });
    } catch (error) {
        logger.error('Error updating credit:', error);
        res.status(500).json({
            error: 'UPDATE_CREDIT_FAILED',
            message: '크레딧 수정에 실패했습니다.'
        });
    }
});

/**
 * DELETE /paca/students/:id/credits/:creditId
 * 크레딧 삭제
 *
 * Access: verifyToken + checkPermission('payments', 'edit')
 * 이미 사용된 크레딧 ('used') 은 삭제 불가 (회계 정합성).
 *
 * 응답 표면 (ADR-013): { message }
 */
router.delete('/:id/credits/:creditId', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const creditId = parseInt(req.params.creditId);

    try {
        // 크레딧 존재 + 학원/학생 격리 확인
        const [existing] = await pool.execute(
            `SELECT * FROM rest_credits WHERE id = ? AND student_id = ? AND academy_id = ?`,
            [creditId, studentId, req.user.academyId]
        );

        if (existing.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '크레딧을 찾을 수 없습니다.'
            });
        }

        const credit = existing[0];

        // 이미 사용된 크레딧은 삭제 불가
        if (credit.status === 'used') {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '이미 사용된 크레딧은 삭제할 수 없습니다.'
            });
        }

        await pool.execute('DELETE FROM rest_credits WHERE id = ?', [creditId]);

        res.json({ message: '크레딧이 삭제되었습니다.' });
    } catch (error) {
        logger.error('Error deleting credit:', error);
        res.status(500).json({
            error: 'DELETE_CREDIT_FAILED',
            message: '크레딧 삭제에 실패했습니다.'
        });
    }
});

/**
 * POST /paca/students/:id/credits/:creditId/apply
 * 크레딧을 특정 월 학원비에 수동 적용
 *
 * Access: verifyToken + checkPermission('payments', 'edit')
 * Body: { year_month: 'YYYY-MM' }
 *
 * 처리:
 *   - 대상 학원비 조회 (student_payments, payment_type='monthly')
 *   - 적용 금액 = min(크레딧 잔액, 학원비 final_amount)
 *   - student_payments UPDATE: carryover_amount += apply, final_amount -= apply, rest_credit_id, notes 추가, updated_at
 *   - rest_credits UPDATE: remaining_amount -= apply, status (전액 → 'applied' / 일부 → 'partial'), applied_to_payment_id, processed_at
 *   - 트랜잭션 미사용 (현재 정책 유지) — 두 UPDATE 사이 부분 실패 시 회계 정합성 깨짐 가능 → 향후 분리 작업 시 트랜잭션 도입 검토 항목.
 *
 * 결제(toss) 영역 미접촉 (ADR-007). student_payments 는 학사 데이터 (학원비 청구 내역).
 *
 * 응답 표면 (ADR-013): { message, applied_amount, new_final_amount, credit_remaining }
 */
router.post('/:id/credits/:creditId/apply', verifyToken, checkPermission('payments', 'edit'), async (req, res) => {
    const studentId = parseInt(req.params.id);
    const creditId = parseInt(req.params.creditId);
    const { year_month } = req.body;

    if (!year_month || !/^\d{4}-\d{2}$/.test(year_month)) {
        return res.status(400).json({
            error: 'VALIDATION_ERROR',
            message: '적용할 월(year_month)을 YYYY-MM 형식으로 입력해주세요.'
        });
    }

    try {
        // 크레딧 조회 (학원/학생 격리)
        const [credits] = await pool.execute(
            `SELECT * FROM rest_credits WHERE id = ? AND student_id = ? AND academy_id = ?`,
            [creditId, studentId, req.user.academyId]
        );

        if (credits.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: '크레딧을 찾을 수 없습니다.'
            });
        }

        const credit = credits[0];

        // 이미 사용 완료된 크레딧은 적용 불가
        if (credit.status === 'applied' || credit.remaining_amount <= 0) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '이미 사용 완료된 크레딧입니다.'
            });
        }

        // 해당 월 학원비 조회 (year_month 는 MySQL 예약어 → 백틱)
        const [payments] = await pool.execute(
            `SELECT * FROM student_payments
             WHERE student_id = ? AND academy_id = ? AND \`year_month\` = ? AND payment_type = 'monthly'`,
            [studentId, req.user.academyId, year_month]
        );

        if (payments.length === 0) {
            return res.status(404).json({
                error: 'NOT_FOUND',
                message: `${year_month} 학원비가 없습니다.`
            });
        }

        const payment = payments[0];

        // 이미 납부 완료된 학원비는 적용 불가
        if (payment.payment_status === 'paid') {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '이미 납부 완료된 학원비에는 크레딧을 적용할 수 없습니다.'
            });
        }

        // 적용할 금액 계산 (크레딧 잔액 vs 학원비 남은 금액 중 작은 쪽)
        const currentFinal = parseFloat(payment.final_amount);
        const currentCarryover = parseFloat(payment.carryover_amount) || 0;
        const payableAmount = currentFinal; // 현재 최종 금액
        const applyAmount = Math.min(credit.remaining_amount, payableAmount);

        if (applyAmount <= 0) {
            return res.status(400).json({
                error: 'VALIDATION_ERROR',
                message: '적용할 금액이 없습니다.'
            });
        }

        // 학원비 업데이트값 계산
        const newCarryover = currentCarryover + applyAmount;
        const newFinal = currentFinal - applyAmount;
        const creditTypeLabel = credit.credit_type === 'excused' ? '공결' :
                               credit.credit_type === 'manual' ? '수동' : '휴식';
        const newNotes = payment.notes
            ? `${payment.notes}\n[크레딧 차감] ${creditTypeLabel} 크레딧 ${applyAmount.toLocaleString()}원 차감`
            : `[크레딧 차감] ${creditTypeLabel} 크레딧 ${applyAmount.toLocaleString()}원 차감`;

        // student_payments UPDATE
        await pool.execute(
            `UPDATE student_payments SET
                carryover_amount = ?,
                final_amount = ?,
                rest_credit_id = ?,
                notes = ?,
                updated_at = NOW()
             WHERE id = ?`,
            [newCarryover, newFinal, creditId, newNotes, payment.id]
        );

        // rest_credits UPDATE (잔액 0 → 'applied', 잔액 > 0 → 'partial')
        const newRemaining = credit.remaining_amount - applyAmount;
        const newStatus = newRemaining <= 0 ? 'applied' : 'partial';

        await pool.execute(
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
            error: 'APPLY_CREDIT_FAILED',
            message: '크레딧 적용에 실패했습니다.'
        });
    }
});

};
