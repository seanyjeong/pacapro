/**
 * 시즌 등록 정보 수정 — 화면(PUT /paca/seasons/enrollments/:id)과 AI 연결(season_enrollment_update)이 같은 계산을 쓴다.
 * 등록일·이 학생 시즌비·직접 할인이 바뀌면 등록할 때와 같은 planSeasonEnrollment 로 다시 계산하고
 * (시즌 도중 합류 일할 → 연속 등록 할인 → 직접 할인), 낸 돈이 없는 시즌비 청구도 같은 금액으로 고친다.
 * 낸 돈이 있는 청구는 금액을 바꾸지 않는다 — 금액이 달라지면 conflict 를 돌려주고 결제 화면에서 고치게 한다.
 * season_fee 입력은 등록과 같이 일할·할인 전 이 학생 시즌비, student_seasons.season_fee 에는 최종 금액이 남는다.
 */

const { planSeasonEnrollment } = require('./seasonEnrollmentService');

const AMOUNT_FIELDS = ['registration_date', 'season_fee', 'discount_amount'];

// 그 시즌의 시즌비 청구(취소와 같이 시즌 이름으로 찾는다) 중 이 등록의 청구
function findSeasonBill(bills, yearMonth) {
    return bills.find(bill => bill.year_month === yearMonth) || bills[0] || null;
}

function hasPayment(bill) {
    return Number(bill.paid_amount) > 0 || bill.payment_status === 'paid' || bill.payment_status === 'partial';
}

/**
 * changes: { registration_date, season_fee, discount_amount, discount_reason, time_slots } — 넘긴 것만 바꾼다.
 * 돌려주는 값: { plan, bill, billChanged, conflict } — 금액 필드가 없으면 plan 은 null.
 */
function planSeasonEnrollmentUpdate({ enrollment, season, student, bills, changes }) {
    if (!AMOUNT_FIELDS.some(field => changes[field] !== undefined)) {
        return { plan: null, bill: null, billChanged: false, conflict: null };
    }

    const currentRegistrationDate = String(enrollment.registration_date).slice(0, 10);
    const continuous = {
        isContinuous: Boolean(enrollment.is_continuous),
        previousSeasonId: enrollment.previous_season_id
    };
    const currentBill = findSeasonBill(bills, null);
    const currentSeasonFee = currentBill && Number(currentBill.base_amount) > 0
        ? Number(currentBill.base_amount)
        : parseFloat(season.default_season_fee) || 0;

    // 직접 할인을 안 넘기면 지금 할인에서 연속 등록 할인을 뺀 만큼을 그대로 둔다
    let manualDiscount = changes.discount_amount;
    if (manualDiscount === undefined) {
        const current = planSeasonEnrollment({
            season, student, seasonFee: currentSeasonFee, registrationDate: currentRegistrationDate, ...continuous
        });
        manualDiscount = Math.max(0, (parseFloat(enrollment.discount_amount) || 0) - current.discountAmount);
    }

    const plan = planSeasonEnrollment({
        season,
        student,
        seasonFee: changes.season_fee !== undefined ? changes.season_fee : currentSeasonFee,
        registrationDate: changes.registration_date || currentRegistrationDate,
        ...continuous,
        manualDiscount
    });

    const bill = findSeasonBill(bills, plan.yearMonth);
    const billChanged = Boolean(bill) && Math.abs(Number(bill.final_amount) - plan.payment.finalAmount) >= 0.01;
    const conflict = billChanged && hasPayment(bill)
        ? '이미 낸 돈이 있는 시즌비 청구라 금액을 바꾸지 않았습니다. 청구 금액은 결제 화면에서 고쳐 주세요.'
        : null;

    return { plan, bill, billChanged, conflict };
}

async function applySeasonEnrollmentUpdate(conn, { enrollmentId, changes, planned }) {
    const updates = [];
    const params = [];
    const { plan, bill } = planned;

    if (plan) {
        updates.push('season_fee = ?', 'discount_type = ?', 'discount_amount = ?');
        params.push(plan.finalSeasonFee || 0, plan.discountType, plan.discountAmount || 0);
    }

    if (changes.registration_date !== undefined) {
        updates.push('registration_date = ?');
        params.push(changes.registration_date);
    }

    if (changes.discount_reason !== undefined) {
        updates.push('discount_reason = ?');
        params.push(changes.discount_reason || null);
    }

    if (changes.time_slots !== undefined) {
        updates.push('time_slots = ?');
        params.push(JSON.stringify(changes.time_slots));
    }

    updates.push('updated_at = NOW()');
    params.push(enrollmentId);

    await conn.execute(
        `UPDATE student_seasons SET ${updates.join(', ')} WHERE id = ?`,
        params
    );

    // 낸 돈이 있는 청구는 금액이 같을 때만 여기까지 온다 — 손대지 않는다
    if (plan && bill && !hasPayment(bill)) {
        const dueDate = changes.registration_date !== undefined ? plan.payment.dueDate : bill.due_date;
        await conn.execute(
            `UPDATE student_payments
             SET base_amount = ?, additional_amount = ?, final_amount = ?, due_date = ?, description = ?, updated_at = NOW()
             WHERE id = ?`,
            [
                plan.payment.baseAmount,
                plan.payment.additionalAmount,
                plan.payment.finalAmount,
                dueDate,
                plan.payment.description,
                bill.id
            ]
        );
    }
}

module.exports = {
    planSeasonEnrollmentUpdate,
    applySeasonEnrollmentUpdate
};
