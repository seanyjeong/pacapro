import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { Payment, PaymentDetailResponse, PaymentFormData, PaymentUpdateResponse, PaymentCreateResponse } from '@/lib/types/payment';
import type { Student, StudentsResponse } from '@/lib/types/student';
import type { PaymentFormStudent } from './payment-editor-types';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

function toNumber(value: number | string | null | undefined) {
  const numeric = typeof value === 'string' ? Number(value) : value || 0;
  return Number.isFinite(numeric) ? numeric : 0;
}

function toOptionalNumber(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === '') return null;
  const numeric = typeof value === 'string' ? Number(value) : value;
  return Number.isFinite(numeric) ? numeric : null;
}

function toPaymentFormStudent(student: Student): PaymentFormStudent {
  return {
    id: student.id,
    name: student.name,
    student_number: student.student_number || '-',
    monthly_tuition: toNumber(student.monthly_tuition),
    final_monthly_tuition: toOptionalNumber(student.final_monthly_tuition),
    discount_rate: toNumber(student.discount_rate),
  };
}

export async function getActiveStudentsForPaymentForm(): Promise<PaymentFormStudent[]> {
  const response = await apiClient.get<StudentsResponse>('/students?status=active', SILENT_CONFIG);
  return response.students.map(toPaymentFormStudent);
}

export function getPaymentForEditor(id: number): Promise<PaymentDetailResponse> {
  return apiClient.get<PaymentDetailResponse>(`/payments/${id}`, SILENT_CONFIG);
}

export function createPaymentFromEditor(data: PaymentFormData): Promise<PaymentCreateResponse> {
  return apiClient.post<PaymentCreateResponse>('/payments', data, SILENT_CONFIG);
}

export function updatePaymentFromEditor(id: number, data: PaymentFormData): Promise<PaymentUpdateResponse> {
  return apiClient.put<PaymentUpdateResponse>(`/payments/${id}`, data, SILENT_CONFIG);
}

export function getPaymentFromEditorResponse(response: PaymentDetailResponse): Payment {
  return response.payment;
}
