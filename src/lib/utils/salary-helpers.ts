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
      return 'text-green-600 bg-green-50';
    case 'pending':
      return 'text-yellow-600 bg-yellow-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * 세금 타입별 색상 반환
 */
export function getTaxTypeColor(taxType: string): string {
  switch (taxType) {
    case '3.3%':
    case 'resident':
      return 'text-blue-600 bg-blue-50';
    case 'insurance':
    case 'freelancer':
      return 'text-purple-600 bg-purple-50';
    case 'none':
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
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
 * 공제액 계산 (4대보험 등)
 */
export function calculateDeductions(
  grossSalary: number,
  includeInsurance: boolean = false
): number {
  if (!includeInsurance) return 0;

  // 간단한 4대보험 계산 (실제로는 더 복잡함)
  const nationalPension = grossSalary * 0.045; // 국민연금 4.5%
  const healthInsurance = grossSalary * 0.03545; // 건강보험 3.545%
  const employmentInsurance = grossSalary * 0.009; // 고용보험 0.9%

  return Math.floor(nationalPension + healthInsurance + employmentInsurance);
}

/**
 * 급여 지급 예정일 가져오기 (다음 달 25일)
 */
export function getNextPaymentDate(): string {
  const today = new Date();
  const nextMonth = new Date(today.getFullYear(), today.getMonth() + 1, 25);
  return nextMonth.toISOString().split('T')[0];
}
