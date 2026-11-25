const { hasSeparateFinal } = require('./monthlyBillAmounts');

/**
 * 청구액 직접 입력(PUT /paca/payments/:id 의 final_amount) — 검사, 납부 상태, 메모 기록.
 */

// 받은 돈 — 낸 금액이 비어 있는 예전 완납 청구는 청구액을 받은 것으로 본다(utils/paymentAmountSql 과 같음)
function receivedAmount(bill) {
    const paid = Number(bill.paid_amount) || 0;
    return bill.payment_status === 'paid' && paid === 0 ? Number(bill.final_amount) || 0 : paid;
}

// 청구액을 직접 정한 뒤의 납부 상태: 받은 돈이 있으면 그 돈으로, 없으면 완납(0원 청구)만 미납으로 되돌린다
function statusForFinal(current, finalAmount) {
    const paid = receivedAmount(current);
    if (paid > 0) return paid >= finalAmount ? 'paid' : 'partial';
    return current.payment_status === 'paid' && finalAmount > 0 ? 'pending' : current.payment_status;
}

// 거절 문구 또는 null
function directFinalError(current, { final_amount, paid_amount, payment_status }) {
    if (!Number.isSafeInteger(final_amount) || final_amount < 0 || final_amount >= 1e8) return '청구액은 0원 이상 원 단위 숫자로 입력해 주세요.';
    if (current.payment_status === 'cancelled') return '취소된 청구의 청구액은 바꿀 수 없습니다.';
    if (paid_amount !== undefined || payment_status !== undefined) return '청구액과 납부 금액·상태를 한 번에 바꿀 수 없습니다.';
    const received = receivedAmount(current);
    if (final_amount < received) return `이미 받은 돈(${received.toLocaleString('ko-KR')}원)보다 청구액을 낮출 수 없습니다.`;
    return null;
}

const DIRECT_NOTE = '청구액 직접 수정:';

// 메모에 남기는 기록. 학원비 변경(repositories/pendingMonthlyTuitionRepository)이 이 문구로 직접 정한 청구를 알아본다
function directFinalNote(current, finalAmount) {
    return `${DIRECT_NOTE} ${Number(current.final_amount).toLocaleString('ko-KR')}원 → ${finalAmount.toLocaleString('ko-KR')}원`;
}

// 메모를 지우거나 고쳐도 직접 수정 기록 줄은 남긴다(이 기록으로 직접 정한 청구를 알아본다)
function keepDirectNotes(before, after) {
    const lost = String(before || '').split('\n').filter(line => line.includes(DIRECT_NOTE) && !String(after || '').includes(line));
    return lost.length > 0 ? [after, ...lost].filter(Boolean).join('\n') : after;
}

// 청구액을 직접 정해 둔 청구 — 다시 계산해 덮으면 안 된다(원래 금액으로 되돌린 청구는 아님)
function isDirectlyPriced(bill) {
    return String(bill.notes || '').includes(DIRECT_NOTE) && hasSeparateFinal(bill);
}

module.exports = { isDirectlyPriced, receivedAmount, statusForFinal, directFinalError, directFinalNote, keepDirectNotes };
