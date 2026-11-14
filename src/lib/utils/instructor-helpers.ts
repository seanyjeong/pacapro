/**
 * Instructor Helper Functions
 * 강사 관련 유틸리티 함수
 */

import type { Instructor } from '@/lib/types/instructor';

/**
 * 전화번호 포맷팅
 */
export function formatPhoneNumber(phone: string): string {
  if (!phone) return '';
  const numbers = phone.replace(/[^\d]/g, '');
  if (numbers.length === 11) {
    return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (numbers.length === 10) {
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }
  return phone;
}

/**
 * 날짜 포맷팅
 */
export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  } catch {
    return dateStr;
  }
}

/**
 * 금액 포맷팅 (10원 단위 이하 버림)
 */
export function formatCurrency(amount: number | string | null | undefined): string {
  if (amount === null || amount === undefined) return '0원';
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0원';
  // 10원 단위 이하 버림
  const rounded = Math.floor(num / 10) * 10;
  return `${rounded.toLocaleString('ko-KR')}원`;
}

/**
 * 상태 뱃지 색상
 */
export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-success-soft text-success border-success/30',
    inactive: 'bg-muted text-foreground border-border',
    resigned: 'bg-destructive-soft text-destructive border-destructive/30',
  };
  return colors[status] || 'bg-muted text-foreground border-border';
}

/**
 * 급여 상태 뱃지 색상
 */
export function getPaymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    pending: 'bg-warning-soft text-warning border-warning/30',
    paid: 'bg-success-soft text-success border-success/30',
  };
  return colors[status] || 'bg-muted text-foreground border-border';
}

/**
 * 근무 시간 포맷팅
 */
export function formatWorkHours(hours: string | number | null): string {
  if (hours === null || hours === undefined) return '-';
  const num = typeof hours === 'string' ? parseFloat(hours) : hours;
  if (isNaN(num) || num <= 0) return '-';
  const h = Math.floor(num);
  const m = Math.round((num - h) * 60);
  return m > 0 ? `${h}시간 ${m}분` : `${h}시간`;
}

/**
 * 시간 포맷팅 (HH:mm:ss → HH:mm)
 */
export function formatTime(timeStr: string): string {
  if (!timeStr) return '-';
  return timeStr.substring(0, 5); // HH:mm
}

/**
 * 근속 년수 계산
 */
export function calculateYearsOfService(hireDate: string): number {
  const hire = new Date(hireDate);
  const now = new Date();
  const years = now.getFullYear() - hire.getFullYear();
  const monthDiff = now.getMonth() - hire.getMonth();
  return monthDiff < 0 ? years - 1 : years;
}

/**
 * 강사 검색 매칭
 */
export function matchInstructorSearch(instructor: Instructor, query: string): boolean {
  if (!query) return true;
  const lowerQuery = query.toLowerCase();
  return (
    instructor.name.toLowerCase().includes(lowerQuery) ||
    (instructor.phone ? instructor.phone.includes(query) : false) ||
    (instructor.email ? instructor.email.toLowerCase().includes(lowerQuery) : false)
  );
}
