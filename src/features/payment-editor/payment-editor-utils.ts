import type { Payment, PaymentFormData } from '@/lib/types/payment';
import { calculateFinalAmount, getCurrentYearMonth, getNextDueDate } from '@/lib/utils/payment-helpers';
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
  const discountRate = Number(student.discount_rate) || 0;
  const discountAmount = Math.floor((baseAmount * (discountRate / 100)) / 1000) * 1000;
  return { base_amount: baseAmount, discount_amount: discountAmount };
}

export function getFinalPaymentAmount(data: PaymentFormData) {
  return calculateFinalAmount(data.base_amount, data.discount_amount, data.additional_amount);
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
