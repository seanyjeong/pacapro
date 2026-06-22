import { SALARY_TYPE_LABELS } from '@/lib/types/instructor';
import type { SalaryDetailWithRates } from './salary-detail-types';

export function formatCurrency(amount: number | string | null | undefined): string {
  const numeric = typeof amount === 'string' ? Number(amount) : amount || 0;
  const rounded = Math.floor((Number.isFinite(numeric) ? numeric : 0) / 10) * 10;
  return `${new Intl.NumberFormat('ko-KR').format(rounded)}원`;
}

export function toNumber(value: number | string | null | undefined) {
  const parsed = typeof value === 'string' ? Number(value) : value || 0;
  return Number.isFinite(parsed) ? parsed : 0;
}

export function getSalaryTypeLabel(salary: SalaryDetailWithRates) {
  const salaryType = salary.salary_type || '';
  return SALARY_TYPE_LABELS[salaryType as keyof typeof SALARY_TYPE_LABELS] || salaryType || '-';
}

export function parseInsuranceDetails(value: string | object | null | undefined) {
  if (!value) return null;
  if (typeof value === 'object') return value as Record<string, number>;
  try {
    return JSON.parse(value) as Record<string, number>;
  } catch {
    return null;
  }
}

export function getDayName(date: string) {
  return ['일', '월', '화', '수', '목', '금', '토'][new Date(date).getDay()];
}

export function isWeekend(date: string) {
  const day = new Date(date).getDay();
  return day === 0 || day === 6;
}
