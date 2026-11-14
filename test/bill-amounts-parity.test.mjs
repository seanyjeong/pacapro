import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { loadTypeScript } from './helpers/load-typescript.mjs';

// 청구 수정 화면 미리보기(프론트)와 저장(서버)이 같은 입력에 같은 금액을 내는지 같은 표로 비교한다
const front = loadTypeScript('src/lib/utils/bill-amounts.ts');
const server = createRequire(import.meta.url)('../backend/utils/monthlyBillAmounts.js');
const { buildPaymentUpdate, getFinalPaymentAmount, toPaymentFormData } = loadTypeScript('src/features/payment-editor/payment-editor-utils.ts');

const bill = (base, final, carryover = 0, additional = '0.00', discount = '0.00') => ({
  base_amount: base, discount_amount: discount, additional_amount: additional, carryover_amount: carryover, final_amount: final,
});
const BILLS = [
  bill('450000.00', '450000.00'), // 보통 청구
  bill('450000.00', '283000.00', 166500), // 보통 청구 + 크레딧(천원 단위 아님)
  bill('450000.00', '225000.00'), // 휴원 정산으로 최종 금액만 줄인 청구
  bill('450000.00', '195000.00', 30000), // 줄인 청구 + 크레딧
  bill('450000.00', '283500.00', 166500), // 예전 식(절삭 뒤 크레딧 빼기) 청구
  bill('333333.33', '291000.00', 0, '0.00', '41666.66'), // 전 단위 학원비
  bill('100000.00', '0.00', 120000), // 크레딧이 더 큰 청구
  bill('120000.00', '120000.00', null, null, null), // 비시즌 종강 일할(빈 칸)
];
const CHANGES = [
  {}, { additional_amount: 10000 }, { additional_amount: 0 }, { base_amount: 400000 }, { base_amount: 225000 },
  { discount_amount: 20000 }, { carryover_amount: 30000 }, { base_amount: '333333.33', additional_amount: 666.67 },
  { additional_amount: -5000 },
];

test('billFinalAmount·hasSeparateFinal·billFinalAfterChange: 프론트 = 서버 (같은 표)', () => {
  for (const b of BILLS) {
    assert.equal(front.hasSeparateFinal(b), server.hasSeparateFinal(b), JSON.stringify(b));
    assert.equal(front.billFinalAmount(b.base_amount, b.discount_amount, b.additional_amount, b.carryover_amount),
      server.billFinalAmount(b.base_amount, b.discount_amount, b.additional_amount, b.carryover_amount), JSON.stringify(b));
    for (const c of CHANGES) {
      assert.equal(front.billFinalAfterChange(b, c), server.billFinalAfterChange(b, c), `${JSON.stringify(b)} ${JSON.stringify(c)}`);
    }
  }
  for (const [base, discount, additional, carryover] of [[450000, 0, 0, 166500], ['333333.33', 0, '666.67', 0], [1000, 2000, 0, 0], ['999.99', 0, 0, 0]]) {
    assert.equal(front.billFinalAmount(base, discount, additional, carryover), server.billFinalAmount(base, discount, additional, carryover));
  }
});

test('편집 화면: 줄인 청구에 추가 10,000원 → 미리보기 235,000원 = 저장 금액, 기본 금액은 안 보낸다', () => {
  const payment = { ...bill('450000.00', '225000.00'), student_id: 1, payment_type: 'monthly', due_date: '2027-11-05', year_month: '2027-11', separately_priced: true };
  const initial = toPaymentFormData(payment);
  const data = { ...initial, additional_amount: 10000 };
  const payload = buildPaymentUpdate(initial, data);
  assert.equal('base_amount' in payload, false);
  assert.equal('discount_amount' in payload, false);
  assert.equal(payload.additional_amount, 10000);
  assert.equal(getFinalPaymentAmount(data, { payment, initial }), 235000);
  assert.equal(server.billFinalAfterChange(payment, payload), 235000);
});

test('편집 화면: 보통 청구의 크레딧도 미리보기에서 빠진다(미리보기 = 저장 금액)', () => {
  const payment = { ...bill('450000.00', '283000.00', 166500), student_id: 1, payment_type: 'monthly', due_date: '2027-11-05', year_month: '2027-11' };
  const initial = toPaymentFormData(payment);
  const data = { ...initial, additional_amount: 10000 };
  assert.equal(getFinalPaymentAmount(data, { payment, initial }), 293000);
  assert.equal(server.billFinalAfterChange(payment, buildPaymentUpdate(initial, data)), 293000);
  // 메모만 고치면 금액 칸을 보내지 않아 그대로
  const memo = buildPaymentUpdate(initial, { ...initial, notes: '메모' });
  assert.deepEqual(['base_amount', 'discount_amount', 'additional_amount'].filter((key) => key in memo), []);
  assert.equal(getFinalPaymentAmount({ ...initial, notes: '메모' }, { payment, initial }), 283000);
});

test('편집 화면: 원 단위가 있는 청구도 바꾸지 않은 칸은 내림 값으로 보내지 않는다', () => {
  const payment = { ...bill('333333.33', '291000.00', 0, '0.00', '41666.66'), student_id: 1, payment_type: 'monthly', due_date: '2027-11-05', year_month: '2027-11' };
  const initial = toPaymentFormData(payment);
  const payload = buildPaymentUpdate(initial, { ...initial, description: '설명' });
  assert.deepEqual(['base_amount', 'discount_amount', 'additional_amount'].filter((key) => key in payload), []);
  assert.equal(server.billFinalAfterChange(payment, payload), 291000);
});
