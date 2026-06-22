import type { ConsultationFormData, StudentGrade } from '@/lib/types/consultation';

export const BOOKING_PAGE_ERROR = '상담 예약 페이지를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const BOOKING_SLOTS_ERROR = '상담 가능 시간을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const BOOKING_SUBMIT_ERROR = '상담 신청을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';

export const gradeOptions: StudentGrade[] = ['중3', '고1', '고2', '고3', 'N수', '성인'];
export const gradeSelectOptions = [
  { value: '', label: '선택' },
  ...gradeOptions.map((grade) => ({ value: grade, label: grade })),
];
export const genderOptions = [
  { value: '', label: '선택' },
  { value: 'male', label: '남' },
  { value: 'female', label: '여' },
];
export const gradeScoreOptions = [
  { value: '', label: '선택' },
  { value: '-1', label: '미응시' },
  ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((grade) => ({ value: String(grade), label: `${grade}등급` })),
];
export const admissionOptions = [
  { value: '', label: '선택' },
  { value: 'early', label: '수시' },
  { value: 'regular', label: '정시' },
  { value: 'both', label: '수시+정시' },
];

export function createInitialBookingForm(): ConsultationFormData {
  return {
    admissionType: '',
    consultationType: 'new_registration',
    gender: undefined,
    inquiryContent: '',
    mockTestGrades: {
      english: undefined,
      exploration: undefined,
      korean: undefined,
      math: undefined,
    },
    parentName: '',
    parentPhone: '',
    preferredDate: '',
    preferredTime: '',
    referralSource: '',
    referrerStudent: '',
    schoolGradeAvg: undefined,
    studentGrade: undefined,
    studentName: '',
    studentPhone: '',
    studentSchool: '',
    targetSchool: '',
  };
}

export function formatPhoneNumber(value: string): string {
  const numbers = value.replace(/\D/g, '').slice(0, 11);
  if (numbers.length <= 3) return numbers;
  if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
  return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7)}`;
}
