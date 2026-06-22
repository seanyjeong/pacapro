import type { GradeTimeSlots, PaymentStatus, Season, StudentSeason, TimeSlot } from '@/lib/types/season';

export const SEASON_DETAIL_LOAD_ERROR = '시즌 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const ENROLLED_STUDENTS_LOAD_ERROR = '등록 학생 목록을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SEASON_DELETE_ERROR = '시즌을 삭제하지 못했습니다. 등록 학생 또는 권한을 확인해주세요.';
export const REFUND_PREVIEW_ERROR = '환불 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const REFUND_CONFIRM_ERROR = '환불 처리를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
export const ENROLLMENT_CANCEL_ERROR = '시즌 등록 취소를 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
export const TIME_SLOT_UPDATE_ERROR = '시간대를 변경하지 못했습니다. 잠시 후 다시 시도해주세요.';

export const DETAIL_TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export function parseSeasonId(value: string | string[] | undefined): number | null {
  const rawValue = Array.isArray(value) ? value[0] : value;
  const parsed = Number(rawValue);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : null;
}

export function parseGradeTimeSlots(value: Season['grade_time_slots']): GradeTimeSlots | null {
  if (!value) return null;
  if (typeof value !== 'string') return value;

  try {
    const parsed = JSON.parse(value) as unknown;
    return typeof parsed === 'object' && parsed !== null ? (parsed as GradeTimeSlots) : null;
  } catch {
    return null;
  }
}

export function getEnrollmentTimeSlots(season: Season | null, enrollment: StudentSeason): TimeSlot[] {
  const directSlots = normalizeTimeSlots(enrollment.time_slots);
  if (directSlots.length > 0) return directSlots;

  const gradeSlots = parseGradeTimeSlots(season?.grade_time_slots ?? null);
  const grade = enrollment.student_grade ?? '';
  const defaultSlots = gradeSlots ? normalizeTimeSlots(gradeSlots[grade]) : [];
  return defaultSlots.length > 0 ? defaultSlots : ['evening'];
}

export function toggleTimeSlot(currentSlots: TimeSlot[], slot: TimeSlot): TimeSlot[] {
  return currentSlots.includes(slot)
    ? currentSlots.filter((currentSlot) => currentSlot !== slot)
    : [...currentSlots, slot];
}

export function getPaymentStatusLabel(status: PaymentStatus): string {
  const labels: Record<PaymentStatus, string> = {
    pending: '미납',
    paid: '완납',
    partial: '일부납부',
    cancelled: '취소됨',
  };
  return labels[status] ?? status;
}

export function normalizeTimeSlots(value: TimeSlot[] | string | undefined): TimeSlot[] {
  if (!value) return [];
  const source = typeof value === 'string' ? parseJsonArray(value) : value;
  return source.filter(isTimeSlot);
}

function parseJsonArray(value: string): unknown[] {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function isTimeSlot(value: unknown): value is TimeSlot {
  return DETAIL_TIME_SLOTS.includes(value as TimeSlot);
}
