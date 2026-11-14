/**
 * 청구 최종 금액 — 서버 backend/utils/monthlyBillAmounts.js 의 billFinalAmount·hasSeparateFinal·billFinalAfterChange 와 같은 식.
 * 청구 수정 화면 미리보기가 저장될 금액과 같도록 서버와 같은 계산을 쓴다(test/bill-amounts-parity.test.mjs 가 같은 표로 비교).
 * 금액은 받은 10진 값 그대로 BigInt 정수로 바꿔 계산한다(소수 오차 없음).
 */

type Amount = number | string | null | undefined;

const ZERO = BigInt(0);
const ONE = BigInt(1);
const TEN = BigInt(10);

function decimal(value: Amount): { n: bigint; scale: number } {
  if (value === null || value === undefined) return { n: ZERO, scale: 0 };
  let text = typeof value === 'number' ? (Number.isFinite(value) ? String(value) : '0') : String(value).trim();
  if (/e/i.test(text)) {
    const number = Number(text);
    text = Number.isFinite(number) ? number.toFixed(20) : '0';
  }
  const match = /^([+-]?)(\d*)(?:\.(\d*))?$/.exec(text);
  if (!match || (match[2] === '' && !match[3])) return { n: ZERO, scale: 0 };
  const [, sign, integer, fraction = ''] = match;
  const n = BigInt((integer || '0') + fraction);
  return { n: sign === '-' ? -n : n, scale: fraction.length };
}

const pow10 = (scale: number) => TEN ** BigInt(scale);

function floorDivide(numerator: bigint, denominator: bigint) {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  return remainder !== ZERO && (remainder < ZERO) !== (denominator < ZERO) ? quotient - ONE : quotient;
}

// 부호 붙은 10진 값들의 합을 unit 단위로 내림, 0 미만이면 0
function floorSum(terms: Array<[Amount, 1 | -1]>, unit: number) {
  const parts = terms.map(([value]) => decimal(value));
  const scale = Math.max(...parts.map((part) => part.scale));
  const total = parts.reduce((sum, part, i) => sum + BigInt(terms[i][1]) * part.n * pow10(scale - part.scale), ZERO);
  return Math.max(Number(floorDivide(total, BigInt(unit) * pow10(scale))) * unit, 0);
}

function sameDecimal(left: Amount, right: Amount) {
  const a = decimal(left);
  const b = decimal(right);
  return a.n * pow10(b.scale) === b.n * pow10(a.scale);
}

export interface BillAmounts {
  base_amount: Amount;
  discount_amount?: Amount;
  additional_amount?: Amount;
  carryover_amount?: Amount;
  final_amount: Amount;
}

export type BillAmountChanges = Partial<Record<'base_amount' | 'discount_amount' | 'additional_amount' | 'carryover_amount', Amount>>;

/** 최종 금액 = 천원 절삭(청구 금액 − 할인액 + 추가 금액 − 크레딧), 0 미만이면 0 */
export function billFinalAmount(base: Amount, discount: Amount, additional: Amount = 0, carryover: Amount = 0) {
  return floorSum([[base, 1], [discount, -1], [additional, 1], [carryover, -1]], 1000);
}

/** 휴원·퇴원 정산 등으로 최종 금액을 따로 정한 청구(저장된 최종 금액 ≠ 공통 식 결과) */
export function hasSeparateFinal(bill: BillAmounts) {
  return !sameDecimal(bill.final_amount, billFinalAmount(bill.base_amount, bill.discount_amount, bill.additional_amount, bill.carryover_amount));
}

const BILL_AMOUNT_KEYS = ['base_amount', 'discount_amount', 'additional_amount', 'carryover_amount'] as const;

/** 금액 칸·크레딧을 바꾼 뒤 최종 금액 — 바꾼 칸이 없으면 지금 최종 금액 그대로 */
export function billFinalAfterChange(bill: BillAmounts, changes: BillAmountChanges = {}) {
  const next = (key: (typeof BILL_AMOUNT_KEYS)[number]) => (changes[key] !== undefined ? changes[key] : bill[key]);
  if (BILL_AMOUNT_KEYS.every((key) => sameDecimal(next(key), bill[key]))) return Number(bill.final_amount);
  const charge: Array<[Amount, 1 | -1]> = hasSeparateFinal(bill)
    ? [[bill.final_amount, 1], [bill.carryover_amount, 1]]
    : [[bill.base_amount, 1], [bill.discount_amount, -1], [bill.additional_amount, 1]];
  return floorSum([...charge,
    [next('base_amount'), 1], [next('discount_amount'), -1], [next('additional_amount'), 1],
    [bill.base_amount, -1], [bill.discount_amount, 1], [bill.additional_amount, -1],
    [next('carryover_amount'), -1]], 1000);
}
