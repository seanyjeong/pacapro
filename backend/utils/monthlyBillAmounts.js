/**
 * 월 청구 금액 — 매달 자동 청구(scheduler/paymentScheduler), 일괄 청구(POST /payments/bulk-monthly),
 * 학생별 청구(POST /payments/generate-monthly-for-student), AI 연결 월회비 청구(services/maxEngineMonthlyPayment),
 * 학원비가 바뀔 때 미납 월 청구 갱신(repositories/pendingMonthlyTuitionRepository)이 모두 이 함수를 쓴다.
 *
 * 할인액 = 천원 절삭(학원비 × 할인율 / 100), 최종 = 천원 절삭(학원비 − 할인액 + 추가 금액 − 크레딧), 0 아래로는 안 내려간다.
 * 학원비·금액 칸은 DECIMAL(10,2), 할인율은 DECIMAL(5,2) 라 모두 100배 정수(전·0.01%)로 바꿔 소수 오차 없이 계산한다.
 * (예전 식 학원비 × (할인율 / 100) 은 29%·100,000원에서 28,999.999… → 28,000원이 되는 등 천원이 틀렸다.)
 *
 * 일할·시즌·환불·크레딧 계산도 아래 정확한 곱셈·나눗셈 도우미(floorRatio·floorPercent·floorAfterPercent·exactPercent)를 쓴다.
 * 각 경로의 식 구조·절삭 위치는 그대로 두고, 소수 곱셈·나눗셈만 이 도우미로 바꾼다.
 */
const hundredths = value => Math.round((Number(value) || 0) * 100);

// 정수 나눗셈 내림(음수도 내림)
function floorDiv(a, b) {
    const remainder = a % b;
    return (a - remainder) / b - (remainder < 0 ? 1 : 0);
}

// 금액 × 분자 / 분모(0 이상 정수: 수업일 수·일수 등)를 정확히 계산해 unit(기본 1,000원) 단위로 내림
function floorRatio(amount, numerator, denominator, unit = 1000) {
    return floorDiv(hundredths(amount) * numerator, denominator * 100 * unit) * unit;
}

// 금액 × 비율(%) / 100 (비율은 소수 둘째 자리까지)을 정확히 계산해 unit 단위로 내림
function floorPercent(amount, rate, unit = 1000) {
    // 전(1/100원) × 0.01% = 10^-6 원
    return floorDiv(hundredths(amount) * hundredths(rate), 1e6 * unit) * unit;
}

// (금액 − 금액 × 비율 / 100)을 정확히 계산해 unit 단위로 한 번에 내림
function floorAfterPercent(amount, rate, unit = 1000) {
    return floorDiv(hundredths(amount) * (10000 - hundredths(rate)), 1e6 * unit) * unit;
}

// 금액 × 비율 / 100 의 값(절삭하지 않는 칸용). 정수 나눗셈 한 번이라 가장 가까운 값이 나온다.
function exactPercent(amount, rate) {
    return hundredths(amount) * hundredths(rate) / 1e6;
}

// 천원 절삭한 할인액(원)
function monthlyDiscountAmount(tuition, discountRate) {
    return floorPercent(tuition, discountRate);
}

function monthlyBillAmounts(tuition, discountRate, additional = 0, carryover = 0) {
    const discount = monthlyDiscountAmount(tuition, discountRate);
    const total = hundredths(tuition) - discount * 100 + hundredths(additional) - hundredths(carryover); // 전
    return { discount, final: Math.max(floorDiv(total, 100000) * 1000, 0) };
}

module.exports = { monthlyBillAmounts, monthlyDiscountAmount, floorRatio, floorPercent, floorAfterPercent, exactPercent };
