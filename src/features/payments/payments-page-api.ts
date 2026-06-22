import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type { Payment, PaymentFilters, PaymentRecordData, PaymentsResponse } from '@/lib/types/payment';
import type { ClassDaysResponse, StudentDetailResponse } from '@/lib/types/student';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export async function getPaymentsForPage(filters: PaymentFilters): Promise<Payment[]> {
  const response = await apiClient.get<PaymentsResponse>('/payments', {
    ...SILENT_CONFIG,
    params: createPaymentParams(filters),
  });
  return response.payments || [];
}

export function getClassDaysForPaymentsPage(): Promise<ClassDaysResponse> {
  return apiClient.get<ClassDaysResponse>('/students/class-days', SILENT_CONFIG);
}

export function getStudentForCredit(studentId: number): Promise<StudentDetailResponse> {
  return apiClient.get<StudentDetailResponse>(`/students/${studentId}`, SILENT_CONFIG);
}

export async function sendUnpaidNotifications(year: number, month: number): Promise<{ sent: number; failed: number }> {
  const response = await apiClient.post<{ sent?: number; failed?: number }>(
    '/notifications/send-unpaid',
    { year, month },
    SILENT_CONFIG
  );
  return { sent: response.sent || 0, failed: response.failed || 0 };
}

export function recordQuickPayment(paymentId: number, data: PaymentRecordData): Promise<unknown> {
  return apiClient.post<unknown>(`/payments/${paymentId}/pay`, data, SILENT_CONFIG);
}

function createPaymentParams(filters: PaymentFilters) {
  const params: Record<string, string | number | boolean> = {};
  if (filters.student_id) params.student_id = filters.student_id;
  if (filters.payment_status) params.payment_status = filters.payment_status;
  if (filters.payment_type) params.payment_type = filters.payment_type;
  if (filters.year) params.year = filters.year;
  if (filters.month) params.month = filters.month;
  if (filters.include_previous_unpaid) params.include_previous_unpaid = true;
  return params;
}
