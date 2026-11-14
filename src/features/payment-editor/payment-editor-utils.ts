import type { Payment, PaymentFormData } from '@/lib/types/payment';
import { billFinalAfterChange, billFinalAmount, monthlyBillAmounts } from '@/lib/utils/bill-amounts';
import { getCurrentYearMonth, getNextDueDate } from '@/lib/utils/payment-helpers';
import type { PaymentFormStudent } from './payment-editor-types';

export function buildDefaultPaymentFormData(): PaymentFormData {
  return {
    student_id: 0,
    payment_type: 'monthly',
    base_amount: 0,
    discount_amount: 0,
    additional_amount: 0,
    due_date: getNextDueDate(),
    year_month: getCurrentYearMonth(),
    description: '',
    notes: '',
  };
}

export function toPaymentFormData(payment: Payment): PaymentFormData {
  return {
    student_id: payment.student_id,
    payment_type: payment.payment_type,
    base_amount: Math.floor(Number(payment.base_amount) || 0),
    discount_amount: Math.floor(Number(payment.discount_amount) || 0),
    additional_amount: Math.floor(Number(payment.additional_amount) || 0),
    due_date: payment.due_date?.split('T')[0] || payment.due_date,
    year_month: payment.year_month,
    description: payment.description || '',
    notes: payment.notes || '',
  };
}

export function getStudentTuitionValues(student: PaymentFormStudent | undefined) {
  if (!student) return { base_amount: 0, discount_amount: 0 };
  const baseAmount = Math.floor(Number(student.monthly_tuition) || 0);
  const finalMonthlyTuition = student.final_monthly_tuition;
  if (typeof finalMonthlyTuition === 'number' && finalMonthlyTuition >= 0 && finalMonthlyTuition <= baseAmount) {
    return { base_amount: baseAmount, discount_amount: baseAmount - Math.floor(finalMonthlyTuition) };
  }
  // 월 청구와 같은 할인액(서버 monthlyBillAmounts) — 예전 소수 곱셈은 125,000 × 32.8% 를 40,000 으로 잘랐다(맞는 값 41,000)
  return { base_amount: baseAmount, discount_amount: monthlyBillAmounts(baseAmount, student.discount_rate).discount };
}

const AMOUNT_FIELDS = ['base_amount', 'discount_amount', 'additional_amount'] as const;

/** 화면에서 실제로 바꾼 금액 칸만 — 바꾸지 않은 칸은 보내지 않아(서버 원래 값 그대로) '바뀐 것'으로 잡히지 않는다 */
export function getChangedAmountFields(initial: PaymentFormData, data: PaymentFormData) {
  return Object.fromEntries(AMOUNT_FIELDS.filter((key) => (data[key] || 0) !== (initial[key] || 0)).map((key) => [key, data[key] || 0]));
}

/** 청구 수정 저장 내용: 바꾸지 않은 금액 칸은 빼고 보낸다 */
export function buildPaymentUpdate(initial: PaymentFormData, data: PaymentFormData): Partial<PaymentFormData> {
  const payload: Partial<PaymentFormData> = { ...data };
  for (const key of AMOUNT_FIELDS) delete payload[key];
  return { ...payload, ...getChangedAmountFields(initial, data) };
}

/** 최종 청구 금액 미리보기 — 서버와 같은 식(크레딧 빼고 천원 절삭, 따로 정한 청구는 그 금액 기준) */
export function getFinalPaymentAmount(data: PaymentFormData, editing?: { payment: Payment; initial: PaymentFormData }) {
  if (editing) return billFinalAfterChange(editing.payment, getChangedAmountFields(editing.initial, data));
  return billFinalAmount(data.base_amount, data.discount_amount, data.additional_amount);
}

export function ensurePaymentStudent(students: PaymentFormStudent[], payment: Payment) {
  if (students.some((student) => student.id === payment.student_id)) return students;
  const baseAmount = Number(payment.base_amount) || 0;
  const discountAmount = Number(payment.discount_amount) || 0;
  return [
    {
      id: payment.student_id,
      name: payment.student_name,
      student_number: payment.student_number || '-',
      monthly_tuition: baseAmount,
      final_monthly_tuition: Math.max(baseAmount - discountAmount, 0),
      discount_rate: 0,
    },
    ...students,
  ];
}
