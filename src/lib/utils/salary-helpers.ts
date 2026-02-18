/**
 * Salary Helper Functions
 * Aligned with backend field names
 */

import type { Salary } from '@/lib/types/salary';

/**
 * 금액을 천원 단위로 절삭
 */
export function truncateToThousands(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

/**
 * 금액 포맷팅
 */
export function formatSalaryAmount(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '₩0';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '₩0';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(Math.floor(num));
}

/**
 * 년월 포맷팅 (YYYY-MM -> YYYY년 MM월)
 */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${parseInt(month)}월`;
}

/**
 * 날짜 포맷팅
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  return dateString.replace(/-/g, '.');
}

/**
 * 급여 상태별 색상 반환
 */
export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return 'text-green-700 dark:text-green-200 bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700';
    case 'unpaid':
      return 'text-yellow-700 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700';
    case 'partial':
      return 'text-orange-700 dark:text-orange-200 bg-orange-100 dark:bg-orange-900 border-orange-200 dark:border-orange-700';
    default:
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  }
}

/**
 * 급여 그룹화 (월별)
 */
export function groupSalariesByMonth(salaries: Salary[]): Record<string, Salary[]> {
  return salaries.reduce((acc, salary) => {
    const yearMonth = salary.year_month;
    if (!acc[yearMonth]) {
      acc[yearMonth] = [];
    }
    acc[yearMonth].push(salary);
    return acc;
  }, {} as Record<string, Salary[]>);
}

/**
 * 급여 그룹화 (강사별)
 */
export function groupSalariesByInstructor(salaries: Salary[]): Record<number, Salary[]> {
  return salaries.reduce((acc, salary) => {
    const instructorId = salary.instructor_id;
    if (!acc[instructorId]) {
      acc[instructorId] = [];
    }
    acc[instructorId].push(salary);
    return acc;
  }, {} as Record<number, Salary[]>);
}

/**
 * 총 지급액 계산
 */
export function calculateTotalPaid(salaries: Salary[]): number {
  return Math.floor(salaries
    .filter((s) => s.payment_status === 'paid')
    .reduce((sum, s) => sum + s.total_salary, 0));
}

/**
 * 총 미지급액 계산
 */
export function calculateTotalUnpaid(salaries: Salary[]): number {
  return Math.floor(salaries
    .filter((s) => s.payment_status !== 'paid')
    .reduce((sum, s) => sum + s.total_salary, 0));
}

/**
 * 현재 년월 가져오기 (YYYY-MM)
 */
export function getCurrentYearMonth(): string {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 이전 월 가져오기 (YYYY-MM)
 */
export function getPreviousYearMonth(): string {
  const today = new Date();
  const lastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
  const year = lastMonth.getFullYear();
  const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

/**
 * 급여 지급 예정일 가져오기 (다음 달 25일)
 */
export function getNextPaymentDate(): string {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 25);
  return nextMonth.toISOString().split('T')[0];
}

/**
 * year_month 문자열에서 이전 달 계산
 */
export function getPrevYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (m === 1) return `${y - 1}-12`;
  return `${y}-${String(m - 1).padStart(2, '0')}`;
}

/**
 * year_month 문자열에서 다음 달 계산
 */
export function getNextYearMonth(yearMonth: string): string {
  const [y, m] = yearMonth.split('-').map(Number);
  if (m === 12) return `${y + 1}-01`;
  return `${y}-${String(m + 1).padStart(2, '0')}`;
}
