/**
 * 월 청구 금액 — 매달 자동 청구(scheduler/paymentScheduler), 일괄 청구(POST /payments/bulk-monthly),
 * 학생별 청구(POST /payments/generate-monthly-for-student), AI 연결 월회비 청구(services/maxEngineMonthlyPayment),
 * 학원비가 바뀔 때 미납 월 청구 갱신(repositories/pendingMonthlyTuitionRepository)이 모두 이 함수를 쓴다.
 *
 * 할인액 = 천원 절삭(학원비 × 할인율 / 100), 최종 = 천원 절삭(학원비 − 할인액 + 추가 금액 − 크레딧), 0 아래로는 안 내려간다.
 * 학원비·금액 칸은 DECIMAL(10,2), 할인율은 DECIMAL(5,2) 라 모두 100배 정수(전·0.01%)로 바꿔 소수 오차 없이 계산한다.
 * (예전 식 학원비 × (할인율 / 100) 은 29%·100,000원에서 28,999.999… → 28,000원이 되는 등 천원이 틀렸다.)
 */
const hundredths = value => Math.round((Number(value) || 0) * 100);

// 정수 나눗셈 내림(음수도 내림)
function floorDiv(a, b) {
    const remainder = a % b;
    return (a - remainder) / b - (remainder < 0 ? 1 : 0);
}

// 천원 절삭한 할인액(원)
function monthlyDiscountAmount(tuition, discountRate) {
    // 전(1/100원) × 0.01% = 10^-6 원 단위 → 천원 = 10^9
    return floorDiv(hundredths(tuition) * hundredths(discountRate), 1e9) * 1000;
}

function monthlyBillAmounts(tuition, discountRate, additional = 0, carryover = 0) {
    const discount = monthlyDiscountAmount(tuition, discountRate);
    const total = hundredths(tuition) - discount * 100 + hundredths(additional) - hundredths(carryover); // 전
    return { discount, final: Math.max(floorDiv(total, 100000) * 1000, 0) };
}

module.exports = { monthlyBillAmounts, monthlyDiscountAmount };
