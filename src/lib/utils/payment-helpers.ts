/**
 * Payment Helper Functions
 * 학원비 관련 유틸리티 함수
 */

import type { Payment, UnpaidPayment } from '@/lib/types/payment';

/**
 * 금액을 천원 단위로 절삭 (백원 단위 버림)
 */
export function truncateToThousands(amount: number): number {
  return Math.floor(amount / 1000) * 1000;
}

/**
 * 학원비 금액 포맷팅 (정수만, 소수점 없음)
 */
export function formatPaymentAmount(amount: number): string {
  const intAmount = Math.floor(amount);
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency',
    currency: 'KRW',
    maximumFractionDigits: 0,
  }).format(intAmount);
}

/**
 * 최종 금액 계산 (백원 단위 절삭)
 */
export function calculateFinalAmount(
  baseAmount: number,
  discountAmount: number = 0,
  additionalAmount: number = 0
): number {
  const result = baseAmount - discountAmount + additionalAmount;
  return truncateToThousands(result);
}

/**
 * 연체일수 계산
 */
export function calculateOverdueDays(dueDate: string): number {
  const today = new Date();
  const due = new Date(dueDate);
  const diffTime = today.getTime() - due.getTime();
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return Math.max(0, diffDays);
}

/**
 * 납부 상태 확인
 */
export function isOverdue(payment: Payment): boolean {
  if (payment.payment_status === 'paid') return false;
  return calculateOverdueDays(payment.due_date) > 0;
}

/**
 * 납부 상태별 색상 반환
 */
export function getPaymentStatusColor(status: string): string {
  switch (status) {
    case 'paid':
      return 'text-green-600 bg-green-50';
    case 'partial':
      return 'text-yellow-600 bg-yellow-50';
    case 'pending':
      return 'text-red-600 bg-red-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * 납부 타입별 색상 반환
 */
export function getPaymentTypeColor(type: string): string {
  switch (type) {
    case 'monthly':
      return 'text-blue-600 bg-blue-50';
    case 'season':
      return 'text-purple-600 bg-purple-50';
    case 'material':
      return 'text-orange-600 bg-orange-50';
    case 'other':
      return 'text-gray-600 bg-gray-50';
    default:
      return 'text-gray-600 bg-gray-50';
  }
}

/**
 * 년월 포맷팅 (YYYY-MM -> YYYY년 MM월)
 */
export function formatYearMonth(yearMonth: string): string {
  const [year, month] = yearMonth.split('-');
  return `${year}년 ${parseInt(month)}월`;
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD -> YYYY.MM.DD)
 */
export function formatDate(dateString: string): string {
  if (!dateString) return '-';
  return dateString.replace(/-/g, '.');
}

/**
 * 미납 학원비 정렬 (연체일수 많은 순)
 */
export function sortUnpaidPayments(payments: UnpaidPayment[]): UnpaidPayment[] {
  return [...payments].sort((a, b) => b.days_overdue - a.days_overdue);
}

/**
 * 학원비 그룹화 (월별)
 */
export function groupPaymentsByMonth(payments: Payment[]): Record<string, Payment[]> {
  return payments.reduce((acc, payment) => {
    const yearMonth = payment.year_month;
    if (!acc[yearMonth]) {
      acc[yearMonth] = [];
    }
    acc[yearMonth].push(payment);
    return acc;
  }, {} as Record<string, Payment[]>);
}

/**
 * 학원비 그룹화 (학생별)
 */
export function groupPaymentsByStudent(payments: Payment[]): Record<number, Payment[]> {
  return payments.reduce((acc, payment) => {
    const studentId = payment.student_id;
    if (!acc[studentId]) {
      acc[studentId] = [];
    }
    acc[studentId].push(payment);
    return acc;
  }, {} as Record<number, Payment[]>);
}

/**
 * 총 미납 금액 계산
 */
export function calculateTotalUnpaid(payments: Payment[]): number {
  return Math.floor(payments
    .filter((p) => p.payment_status !== 'paid')
    .reduce((sum, p) => sum + parseFloat(String(p.final_amount)), 0));
}

/**
 * 총 납부 금액 계산
 */
export function calculateTotalPaid(payments: Payment[]): number {
  return Math.floor(payments
    .filter((p) => p.payment_status === 'paid')
    .reduce((sum, p) => sum + parseFloat(String(p.final_amount)), 0));
}

/**
 * 납부율 계산 (%)
 */
export function calculatePaymentRate(payments: Payment[]): number {
  const total = payments.length;
  if (total === 0) return 0;
  const paid = payments.filter((p) => p.payment_status === 'paid').length;
  return Math.round((paid / total) * 100);
}

/**
 * 다음 납부 기한 가져오기 (오늘 + 7일)
 */
export function getNextDueDate(): string {
  const today = new Date();
  const dueDate = new Date(today.getTime() + 7 * 24 * 60 * 60 * 1000);
  return dueDate.toISOString().split('T')[0];
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
 * 연체 경고 메시지 생성
 */
export function getOverdueWarningMessage(daysOverdue: number): string {
  if (daysOverdue === 0) return '';
  if (daysOverdue <= 7) return '납부 기한이 지났습니다.';
  if (daysOverdue <= 14) return `${daysOverdue}일 연체 중입니다.`;
  return `${daysOverdue}일 연체 - 즉시 납부가 필요합니다.`;
}
