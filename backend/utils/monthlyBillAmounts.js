/**
 * 월 청구 금액 — 매달 자동 청구(scheduler/paymentScheduler), 일괄 청구(POST /payments/bulk-monthly),
 * 학생별 청구(POST /payments/generate-monthly-for-student), AI 연결 월회비 청구(services/maxEngineMonthlyPayment),
 * 학원비가 바뀔 때 미납 월 청구 갱신(repositories/pendingMonthlyTuitionRepository)이 모두 이 함수를 쓴다.
 *
 * 할인액 = 천원 절삭(학원비 × 할인율 / 100), 최종 = 천원 절삭(학원비 − 할인액 + 추가 금액 − 크레딧), 0 아래로는 안 내려간다.
 * 금액·비율은 받은 10진 값 그대로(반올림 없이) BigInt 정수 × 10^-자리수 로 바꿔 계산한다.
 * (예전 식 학원비 × (할인율 / 100) 은 29%·100,000원에서 28,999.999… → 28,000원이 되는 등 천원이 틀렸다.)
 *
 * 일할·시즌·환불·크레딧 계산도 아래 정확한 곱셈·나눗셈 도우미(floorRatio·floorPercent)를 쓴다.
 * 각 경로의 식 구조·절삭 위치는 그대로 두고, 소수 곱셈·나눗셈만 이 도우미로 바꾼다.
 */

// 10진 값(숫자·문자열) → { n: BigInt, scale } (값 = n × 10^-scale). 숫자가 아니면 예전처럼 0.
function decimal(value) {
    if (value === null || value === undefined) return { n: 0n, scale: 0 };
    let text = typeof value === 'number'
        ? (Number.isFinite(value) ? String(value) : '0')
        : String(value).trim();
    if (/e/i.test(text)) {
        const number = Number(text);
        text = Number.isFinite(number) ? number.toFixed(20) : '0';
    }
    const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
    if (!match || (match[2] === '' && !match[3])) return { n: 0n, scale: 0 };
    const [, sign, integer, fraction = ''] = match;
    const n = BigInt((integer || '0') + fraction);
    return { n: sign === '-' ? -n : n, scale: fraction.length };
}
const pow10 = scale => 10n ** BigInt(scale);

// BigInt 나눗셈 내림(음수도 내림). 분모 0 이면 예전 소수 계산처럼 NaN.
function floorDivide(numerator, denominator) {
    if (denominator === 0n) return NaN;
    const quotient = numerator / denominator;
    const remainder = numerator % denominator;
    return remainder !== 0n && (remainder < 0n) !== (denominator < 0n) ? quotient - 1n : quotient;
}
const toUnits = (quotient, unit) => (typeof quotient === 'bigint' ? Number(quotient) * unit : NaN);

// 금액 × 분자 / 분모(수업일 수·일수 등)를 정확히 계산해 unit(기본 1,000원) 단위로 내림
function floorRatio(amount, numerator, denominator, unit = 1000) {
    const a = decimal(amount), n = decimal(numerator), d = decimal(denominator);
    return toUnits(floorDivide(a.n * n.n * pow10(d.scale), pow10(a.scale + n.scale) * d.n * BigInt(unit)), unit);
}

// 금액 × 비율(%) / 100 을 정확히 계산해 unit 단위로 내림
function floorPercent(amount, rate, unit = 1000) {
    const a = decimal(amount), r = decimal(rate);
    return toUnits(floorDivide(a.n * r.n, pow10(a.scale + r.scale + 2) * BigInt(unit)), unit);
}

// 두 10진 값이 같은가('350000.00' 과 350000 은 같다)
function sameDecimal(left, right) {
    const a = decimal(left), b = decimal(right);
    return a.n * pow10(b.scale) === b.n * pow10(a.scale);
}

// 천원 절삭한 할인액(원)
function monthlyDiscountAmount(tuition, discountRate) {
    return floorPercent(tuition, discountRate);
}

// 부호 붙은 10진 값들의 합을 unit 단위로 내림, 0 미만이면 0. terms: [[값, +1 | −1], ...]
function floorSum(terms, unit) {
    const parts = terms.map(([value]) => decimal(value));
    const scale = Math.max(...parts.map(part => part.scale));
    const total = parts.reduce((sum, part, i) => sum + BigInt(terms[i][1]) * part.n * pow10(scale - part.scale), 0n);
    return Math.max(toUnits(floorDivide(total, BigInt(unit) * pow10(scale)), unit), 0);
}

/**
 * 청구 최종 금액 = 천원 절삭(청구 금액 − 할인액 + 추가 금액 − 크레딧), 0 미만이면 0.
 * 월 청구(아래 monthlyBillAmounts)와 첫 달 일할 재계산이 같은 식을 쓴다(크레딧을 빼고 절삭).
 */
function billFinalAmount(base, discount, additional = 0, carryover = 0) {
    return floorSum([[base, 1], [discount, -1], [additional, 1], [carryover, -1]], 1000);
}

/**
 * 청구 대상 금액(크레딧 빼기 전)의 항.
 * - 보통 청구(저장된 최종 금액 = 위 공통 식 결과): 학원비 − 할인액 + 추가 금액.
 *   첫 달·복귀·비시즌 종강 일할 청구도 학원비 칸 자체가 일할 금액이라 여기에 든다.
 * - 최종 금액만 따로 정한 청구: 지금 최종 금액 + 이미 적용된 크레딧.
 *   휴원·퇴원 정산(studentLifecycleBillingRepository), 휴원 복귀(resumePaymentRepository), AI 연결 정산처럼
 *   학원비 칸은 그대로 두고 최종 금액만 줄인 청구, 예전 식으로 만든 청구가 여기에 든다.
 *   조정 표시(is_prorated·proration_details·메모)는 경로마다 다르거나 없어서(휴원 처리 process-rest 등) 금액이 공통 식과 맞는지로 가린다.
 */
function chargeTerms(bill) {
    const formula = billFinalAmount(bill.base_amount, bill.discount_amount, bill.additional_amount, bill.carryover_amount);
    return sameDecimal(bill.final_amount, formula)
        ? [[bill.base_amount, 1], [bill.discount_amount, -1], [bill.additional_amount, 1]]
        : [[bill.final_amount, 1], [bill.carryover_amount, 1]];
}

const BILL_AMOUNT_KEYS = ['base_amount', 'discount_amount', 'additional_amount', 'carryover_amount'];

/**
 * 청구의 금액 칸·크레딧을 바꾼 뒤 최종 금액 — 청구 수정 화면, AI 연결 청구 수정, 크레딧 수동 적용, 미리 납부·선납이 쓴다.
 * changes: base_amount·discount_amount·additional_amount·carryover_amount 중 바꾸는 칸(없는 칸은 지금 값).
 * 최종 = 천원 절삭(청구 대상 금액 + 바뀐 (학원비 − 할인액 + 추가) 차이 − 크레딧), 0 미만이면 0.
 *   보통 청구는 그대로 천원 절삭(바꾼 학원비 − 할인액 + 추가 − 크레딧) = 월 청구와 같은 금액,
 *   최종 금액만 줄인 청구는 줄인 금액에서 바뀐 만큼만 더하고 뺀다(정액으로 돌아가지 않는다).
 * 금액 칸·크레딧이 하나도 안 바뀌면 지금 최종 금액 그대로(조정·예전 금액을 다시 절삭하지 않는다).
 */
function billFinalAfterChange(bill, changes = {}) {
    const next = key => (changes[key] !== undefined ? changes[key] : bill[key]);
    if (BILL_AMOUNT_KEYS.every(key => sameDecimal(next(key), bill[key]))) return Number(bill.final_amount);
    return floorSum([...chargeTerms(bill),
        [next('base_amount'), 1], [next('discount_amount'), -1], [next('additional_amount'), 1],
        [bill.base_amount, -1], [bill.discount_amount, 1], [bill.additional_amount, -1],
        [next('carryover_amount'), -1]], 1000);
}

// 크레딧 수동 적용 한도: 이 청구에서 더 뺄 수 있는 금액(청구 대상 금액 − 이미 적용된 크레딧, 원 단위 내림)
function billCreditRoom(bill) {
    return floorSum([...chargeTerms(bill), [bill.carryover_amount, -1]], 1);
}

function monthlyBillAmounts(tuition, discountRate, additional = 0, carryover = 0) {
    const discount = monthlyDiscountAmount(tuition, discountRate);
    return { discount, final: billFinalAmount(tuition, discount, additional, carryover) };
}

module.exports = {
    monthlyBillAmounts, monthlyDiscountAmount, billFinalAmount, billFinalAfterChange, billCreditRoom, floorRatio, floorPercent, sameDecimal
};
