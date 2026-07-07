import apiClient, { type APIRequestConfig } from '@/lib/api/client';
import type {
  Payment,
  PaymentCancelData,
  PaymentDeleteResponse,
  PaymentDetailResponse,
  PaymentRecordData,
  PaymentUpdateResponse,
} from '@/lib/types/payment';

const SILENT_CONFIG: APIRequestConfig = { suppressErrorToast: true };

export type PaymentPaidDatePatch = { paid_date: string };

export function getPaymentForDetail(id: number): Promise<PaymentDetailResponse> {
  return apiClient.get<PaymentDetailResponse>(`/payments/${id}`, SILENT_CONFIG);
}

export function recordPaymentForDetail(id: number, data: PaymentRecordData): Promise<PaymentUpdateResponse> {
  return apiClient.post<PaymentUpdateResponse>(`/payments/${id}/pay`, data, SILENT_CONFIG);
}

export function cancelPaymentForDetail(id: number, data: PaymentCancelData): Promise<PaymentUpdateResponse> {
  return apiClient.post<PaymentUpdateResponse>(`/payments/${id}/cancel`, data, SILENT_CONFIG);
}

export function updatePaymentPaidDate(id: number, data: PaymentPaidDatePatch): Promise<PaymentUpdateResponse> {
  return apiClient.put<PaymentUpdateResponse>(`/payments/${id}`, data, SILENT_CONFIG);
}

export function deletePaymentForDetail(id: number): Promise<PaymentDeleteResponse> {
  return apiClient.delete<PaymentDeleteResponse>(`/payments/${id}`, SILENT_CONFIG);
}

export function getPaymentFromResponse(response: PaymentDetailResponse): Payment {
  return response.payment;
}
