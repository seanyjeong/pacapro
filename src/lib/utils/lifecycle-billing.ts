import type { PauseBillingResult, WithdrawalBillingResult, BillingAmount } from '../types/lifecycle-billing';
import { getSafeApiToastMessage } from '../api/error-message';
import { LIFECYCLE_CREDIT_STATUS_LABELS } from '@/constants/lifecycle-billing';

export function getKoreaDateText(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function formatLifecycleMoney(value: BillingAmount | null | undefined): string {
  if (value == null || (typeof value === 'string' && !value.trim()) || !Number.isFinite(Number(value))) return '금액 확인 필요';
  return `${new Intl.NumberFormat('ko-KR', { maximumFractionDigits: 2 }).format(Number(value))}원`;
}

export function needsPauseBillingPreview(
  initial: { status: string; rest_start_date: string | null } | undefined,
  next: { status?: string; rest_start_date?: string | null },
): boolean {
  if (!initial || (next.status ?? initial.status) !== 'paused') return false;
  return initial.status !== 'paused' || (next.rest_start_date !== undefined && (next.rest_start_date || '') !== (initial.rest_start_date || ''));
}

export function omitUnchangedPauseStartDate<T extends { status?: string; rest_start_date?: string | null }>(
  initial: { status: string; rest_start_date: string | null } | undefined,
  next: T,
): T {
  const result = { ...next };
  if (initial?.status === 'paused' && (next.status ?? initial.status) === 'paused'
      && (next.rest_start_date || '') === (initial.rest_start_date || '')) delete result.rest_start_date;
  return result;
}

export function describePauseBillingResult(result: PauseBillingResult): string {
  if (result.action === 'unchanged') return result.message;
  return `학원비 ${result.paymentIds.length}건: ${formatLifecycleMoney(result.summary?.before_final_amount ?? result.originalAmount)} → ${formatLifecycleMoney(result.summary?.adjusted_amount ?? result.adjustedAmount)}. 납부 이력을 보존했습니다.`;
}

export function describeWithdrawalBillingResult(result: WithdrawalBillingResult): string {
  const amounts = result.summary ? ` 청구 ${formatLifecycleMoney(result.summary.before_final_amount)} → ${formatLifecycleMoney(result.summary.adjusted_amount)}, 남은 미납 ${formatLifecycleMoney(result.summary.outstanding_amount)}.` : '';
  return `미납 청구 ${result.cancelledPayments}건 취소 · 부분납 ${result.adjustedPayments}건 잔액 정산 · 감액 ${formatLifecycleMoney(result.waivedAmount)}.${amounts} 납부 이력을 보존했습니다.`;
}

export function describeRestCreditResult(credit: { credit_amount: BillingAmount; credit_type: string; status: string }): string {
  return `${credit.credit_type === 'refund' ? '환불' : '이월'} 크레딧 ${formatLifecycleMoney(credit.credit_amount)} (${LIFECYCLE_CREDIT_STATUS_LABELS[credit.status] || '기록 보존'})`;
}

export function getLifecycleErrorMessage(error: unknown, fallback: string): string {
  if (error && typeof error === 'object') {
    const message = (error as { response?: { data?: { message?: unknown } } }).response?.data?.message;
    if (typeof message === 'string' && /[가-힣]/.test(message)) {
      const safe = getSafeApiToastMessage(message);
      if (safe === message.trim()) return safe;
    }
  }
  return fallback;
}
