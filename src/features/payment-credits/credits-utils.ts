import { format } from 'date-fns';
import { ko } from 'date-fns/locale';
import type { Credit, CreditStats, CreditsResponse, CreditsSummaryResponse } from '@/lib/types/payment';
import { CREDIT_STATUS_LABELS, CREDIT_TYPE_LABELS } from './credits-constants';

export const EMPTY_CREDIT_STATS: CreditStats = {
  total_count: 0,
  total_credit: 0,
  total_remaining: 0,
  pending_count: 0,
  pending_amount: 0,
  partial_count: 0,
  applied_count: 0,
};

export function normalizeCreditsResponse(response: CreditsResponse | null | undefined) {
  return {
    credits: response?.credits || [],
    stats: response?.stats || EMPTY_CREDIT_STATS,
  };
}

export function normalizeCreditsSummary(response: CreditsSummaryResponse | null | undefined) {
  return {
    studentsWithCredit: response?.students_with_credit || [],
    typeStats: response?.type_stats || [],
  };
}

export function formatWon(amount: number | null | undefined) {
  return `${Math.floor(Number(amount) || 0).toLocaleString()}원`;
}

export function formatCreditDate(value: string | null | undefined, pattern = 'yyyy-MM-dd') {
  if (!value) return '-';
  try {
    return format(new Date(value), pattern, { locale: ko });
  } catch {
    return '-';
  }
}

export function formatCreditPeriod(credit: Credit) {
  if (credit.rest_start_date && credit.rest_end_date) {
    return `${formatCreditDate(credit.rest_start_date, 'M/d')} ~ ${formatCreditDate(credit.rest_end_date, 'M/d')} (${credit.rest_days}일)`;
  }
  return formatCreditDate(credit.created_at);
}

export function getCreditTypeLabel(value: Credit['credit_type'] | string) {
  return CREDIT_TYPE_LABELS[value as Credit['credit_type']] || value;
}

export function getCreditStatusLabel(value: Credit['status'] | string) {
  return CREDIT_STATUS_LABELS[value as Credit['status']] || value;
}

export function getStudentStatusLabel(value: string) {
  if (value === 'active') return '재원';
  if (value === 'paused') return '휴원';
  if (value === 'pending') return '미등록';
  if (value === 'withdrawn') return '퇴원';
  return value;
}

export function sumStudentRemaining(students: Array<{ total_remaining: number }>) {
  return students.reduce((sum, student) => sum + student.total_remaining, 0);
}
