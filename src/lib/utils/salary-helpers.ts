/**
 * Salary Helper Functions
 * 급여 관련 유틸리티 함수
 */

import type { Salary, SalaryCalculationResult } from '@/lib/types/salary';
import { TAX_RATES } from '@/lib/types/salary';

/**
 * 금액을 천원 단위로 절삭 (백원 단위 버림)
 */
export function truncateToThousands(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

/**
 * 금액 포맷팅 (정수만, 소수점 없음)
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
 * 세금 계산
 */
export function calculateTax(
  amount: number,
  taxType: string
): number {
  const rate = TAX_RATES[taxType] || 0;
  return Math.floor(amount * rate);
}

/**
 * 실수령액 계산 (백원 단위 절삭)
 */
export function calculateNetSalary(
  baseAmount: number,
  incentiveAmount: number = 0,
  taxAmount: number = 0,
  deductions: number = 0
): number {
  const grossSalary = baseAmount + incentiveAmount;
  const result = grossSalary - taxAmount - deductions;
  return truncateToThousands(result);
}

/**
 * 급여 상태별 색상 반환
 */
export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return 'text-green-700 dark:text-green-200 bg-green-100 dark:bg-green-900 border-green-200 dark:border-green-700';
    case 'pending':
      return 'text-yellow-700 dark:text-yellow-200 bg-yellow-100 dark:bg-yellow-900 border-yellow-200 dark:border-yellow-700';
    default:
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
  }
}

/**
 * 세금 타입별 색상 반환
 */
export function getTaxTypeColor(taxType: string): string {
  switch (taxType) {
    case '3.3%':
    case 'resident':
      return 'text-blue-700 dark:text-blue-200 bg-blue-100 dark:bg-blue-900 border-blue-200 dark:border-blue-700';
    case 'insurance':
    case 'freelancer':
      return 'text-purple-700 dark:text-purple-200 bg-purple-100 dark:bg-purple-900 border-purple-200 dark:border-purple-700';
    case 'none':
      return 'text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 border-gray-200 dark:border-gray-700';
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
    .reduce((sum, s) => sum + parseFloat(String(s.net_salary)), 0));
}

/**
 * 총 미지급액 계산
 */
export function calculateTotalUnpaid(salaries: Salary[]): number {
  return Math.floor(salaries
    .filter((s) => s.payment_status === 'pending')
    .reduce((sum, s) => sum + parseFloat(String(s.net_salary)), 0));
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
 * 급여 계산 결과 포맷팅
 */
export function formatSalaryBreakdown(result: SalaryCalculationResult): string[] {
  const breakdown: string[] = [];

  breakdown.push(`기본 급여: ${formatSalaryAmount(result.base_amount)}`);

  if (result.incentive_amount > 0) {
    breakdown.push(`인센티브: ${formatSalaryAmount(result.incentive_amount)}`);
  }

  breakdown.push(`총 급여: ${formatSalaryAmount(result.gross_salary)}`);

  if (result.tax_amount > 0) {
    breakdown.push(`세금: -${formatSalaryAmount(result.tax_amount)}`);
  }

  if (result.total_deduction > 0) {
    breakdown.push(`공제액: -${formatSalaryAmount(result.total_deduction)}`);
  }

  breakdown.push(`실수령액: ${formatSalaryAmount(result.net_salary)}`);

  return breakdown;
}

/**
 * 시급 기반 급여 계산 (백원 단위 절삭)
 */
export function calculateHourlySalary(hourlyRate: number, hoursWorked: number): number {
  return truncateToThousands(hourlyRate * hoursWorked);
}

/**
 * 공제액 계산 (4대보험 등) - 2026년 기준
 * 근로자 부담분만 계산
 */
export function calculateDeductions(
  grossSalary: number,
  includeInsurance: boolean = false
): number {
  if (!includeInsurance) return 0;

  // 2026년 4대보험 근로자 부담률
  const nationalPension = grossSalary * 0.0475; // 국민연금 4.75% (2026년 인상)
  const healthInsurance = grossSalary * 0.03595; // 건강보험 3.595%
  const longTermCare = healthInsurance * 0.1314; // 장기요양보험 (건보료의 13.14%)
  const employmentInsurance = grossSalary * 0.009; // 고용보험 0.9%

  return Math.floor(nationalPension + healthInsurance + longTermCare + employmentInsurance);
}

/**
 * 급여 지급 예정일 가져오기 (다음 달 25일)
 */
export function getNextPaymentDate(): string {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 25);
  return nextMonth.toISOString().split('T')[0];
}
