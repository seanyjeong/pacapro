/**
 * Student Helper Functions
 * 학생 관련 유틸리티 함수 - 입시생/성인 구분 지원
 */

import type { Student, StudentType, Grade, StudentStatus } from '@/lib/types/student';
import { WEEKDAY_MAP, STUDENT_TYPE_LABELS, GRADE_LABELS } from '@/lib/types/student';

/**
 * 학번 포맷팅
 * @example formatStudentNumber('2024001') => '2024-001'
 */
export function formatStudentNumber(num: string | null): string {
  if (!num) return '';
  // 2024001 → 2024-001
  return num.replace(/(\d{4})(\d{3})/, '$1-$2');
}

/**
 * 전화번호 포맷팅
 * @example formatPhoneNumber('01012345678') => '010-1234-5678'
 */
export function formatPhoneNumber(phone: string | null): string {
  if (!phone) return '';

  // 숫자만 추출
  const numbers = phone.replace(/[^\d]/g, '');

  // 길이에 따라 포맷팅
  if (numbers.length === 11) {
    // 010-1234-5678
    return numbers.replace(/(\d{3})(\d{4})(\d{4})/, '$1-$2-$3');
  } else if (numbers.length === 10) {
    // 02-1234-5678 (서울)
    return numbers.replace(/(\d{2})(\d{4})(\d{4})/, '$1-$2-$3');
  }

  return phone;
}

/**
 * 학생 유형 레이블 생성
 * @example getStudentTypeLabel('exam') => '입시생'
 * @example getStudentTypeLabel('adult') => '성인'
 */
export function getStudentTypeLabel(studentType: StudentType): string {
  return STUDENT_TYPE_LABELS[studentType] || studentType;
}

/**
 * 학년 레이블 생성
 * @example getGradeLabel('고1') => '고1'
 * @example getGradeLabel('N수') => 'N수'
 */
export function getGradeLabel(grade: Grade | null): string {
  if (!grade) return '';
  return GRADE_LABELS[grade] || grade;
}

/**
 * 학생 유형과 학년/나이 표시
 * @example getStudentDisplayInfo(student) => '입시생 (고3)' 또는 '성인 (25세)'
 */
export function getStudentDisplayInfo(student: Student): string {
  if (student.student_type === 'adult') {
    return `성인 ${student.age ? `(${student.age}세)` : ''}`;
  }
  return student.grade ? `${student.grade}` : '입시생';
}

/**
 * 수업요일 파싱 (JSON string/number[] → number[])
 * @example parseClassDays('[1,3,5]') => [1, 3, 5]
 * @example parseClassDays([1, 3, 5]) => [1, 3, 5]
 */
export function parseClassDays(classDays: string | number[]): number[] {
  if (Array.isArray(classDays)) return classDays;

  if (!classDays) return [];

  try {
    const parsed = JSON.parse(classDays);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

/**
 * 수업요일 문자열로 변환 (숫자 배열 → 한글 요일)
 * @example formatClassDays([1, 3, 5]) => '월, 수, 금'
 */
export function formatClassDays(classDays: string | number[]): string {
  const days = parseClassDays(classDays);
  return days.map(d => WEEKDAY_MAP[d] || '').filter(Boolean).join(', ') || '-';
}

/**
 * 할인 적용 금액 계산
 * @example calculateDiscountedTuition(300000, 10) => 270000
 */
export function calculateDiscountedTuition(tuition: number | string, discountRate: number | string): number {
  const t = typeof tuition === 'string' ? parseFloat(tuition) : tuition;
  const d = typeof discountRate === 'string' ? parseFloat(discountRate) : discountRate;
  return Math.round(t * (1 - d / 100));
}

/**
 * 할인 금액 계산
 * @example calculateDiscountAmount(300000, 10) => 30000
 */
export function calculateDiscountAmount(tuition: number | string, discountRate: number | string): number {
  const t = typeof tuition === 'string' ? parseFloat(tuition) : tuition;
  const d = typeof discountRate === 'string' ? parseFloat(discountRate) : discountRate;
  return Math.round(t * (d / 100));
}

/**
 * 상태 뱃지 색상 클래스 반환
 */
export function getStatusColor(status: StudentStatus): string {
  const colors: Record<StudentStatus, string> = {
    active: 'bg-green-100 text-green-800 border-green-200',
    paused: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    graduated: 'bg-blue-100 text-blue-800 border-blue-200',
    withdrawn: 'bg-gray-100 text-gray-800 border-gray-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * 납부 상태 뱃지 색상 클래스 반환
 */
export function getPaymentStatusColor(status: string): string {
  const colors: Record<string, string> = {
    unpaid: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    partial: 'bg-orange-100 text-orange-800 border-orange-200',
    paid: 'bg-green-100 text-green-800 border-green-200',
    overdue: 'bg-red-100 text-red-800 border-red-200',
  };
  return colors[status] || 'bg-gray-100 text-gray-800 border-gray-200';
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD → YYYY년 MM월 DD일)
 */
export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    const year = date.getFullYear();
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${year}년 ${month}월 ${day}일`;
  } catch {
    return dateStr || '';
  }
}

/**
 * 날짜 포맷팅 (YYYY-MM-DD → MM/DD)
 */
export function formatDateShort(dateStr: string | null): string {
  if (!dateStr) return '';

  try {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();

    return `${month}/${day}`;
  } catch {
    return dateStr || '';
  }
}

/**
 * 금액 포맷팅 (숫자/문자열 → 천단위 콤마)
 * @example formatCurrency(300000) => '300,000원'
 * @example formatCurrency('300000.00') => '300,000원'
 */
export function formatCurrency(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  if (isNaN(num)) return '0원';
  return `${num.toLocaleString('ko-KR')}원`;
}

/**
 * 학생 검색 매칭 (이름, 학번, 전화번호)
 */
export function matchStudentSearch(student: Student, query: string): boolean {
  if (!query) return true;

  const lowerQuery = query.toLowerCase();

  return (
    student.name.toLowerCase().includes(lowerQuery) ||
    (student.student_number?.toLowerCase().includes(lowerQuery) || false) ||
    (student.phone?.includes(query) || false) ||
    (student.parent_phone?.includes(query) || false)
  );
}

/**
 * 학생 정렬 (이름 가나다순)
 */
export function sortStudentsByName(students: Student[]): Student[] {
  return [...students].sort((a, b) => a.name.localeCompare(b.name, 'ko-KR'));
}

/**
 * 학생 정렬 (학번순)
 */
export function sortStudentsByNumber(students: Student[]): Student[] {
  return [...students].sort((a, b) =>
    (a.student_number || '').localeCompare(b.student_number || '')
  );
}

/**
 * 학생 정렬 (등록일순 - 최신순)
 */
export function sortStudentsByEnrollmentDate(students: Student[]): Student[] {
  return [...students].sort((a, b) => {
    const dateA = a.enrollment_date ? new Date(a.enrollment_date).getTime() : 0;
    const dateB = b.enrollment_date ? new Date(b.enrollment_date).getTime() : 0;
    return dateB - dateA; // 최신순
  });
}
