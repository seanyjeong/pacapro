import type { Season, TimeSlot } from '@/lib/types/season';
import type { SeasonEnrollStudent } from './season-enroll-types';

export const SEASON_ENROLL_LOAD_ERROR = '시즌 등록 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SEASON_ENROLL_SUBMIT_ERROR = '학생 등록을 완료하지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SEASON_ENROLL_EMPTY_ERROR = '등록할 학생과 시간대를 다시 확인해주세요.';

export const ALL_TIME_SLOTS: TimeSlot[] = ['morning', 'afternoon', 'evening'];

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

export function parseSeasonId(id: unknown): number | null {
  const value = Array.isArray(id) ? id[0] : id;
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export function parseSeasonFee(season: Season | null): number {
  if (!season) return 0;
  const fee = Number.parseFloat(season.default_season_fee);
  return Number.isFinite(fee) ? fee : 0;
}

export function formatWon(value: number): string {
  return `${Math.max(0, value).toLocaleString()}원`;
}

export function formatTimeSlots(slots: TimeSlot[]): string {
  return slots.map((slot) => TIME_SLOT_LABELS[slot]).join(', ');
}

export function isEligibleSeasonStudent(student: SeasonEnrollStudent): boolean {
  return student.grade === '고3' || student.grade === 'N수' || student.grade_type === 'n_su';
}

export function filterEligibleStudents(students: SeasonEnrollStudent[]): SeasonEnrollStudent[] {
  return students.filter(isEligibleSeasonStudent);
}

export function filterStudents(students: SeasonEnrollStudent[], searchTerm: string): SeasonEnrollStudent[] {
  const term = searchTerm.trim();
  if (!term) return students;
  return students.filter((student) => student.name.includes(term) || student.phone.includes(term));
}

export function splitStudentsByEnrollment(students: SeasonEnrollStudent[], seasonId: number) {
  return {
    available: students.filter((student) => !student.is_season_registered || student.current_season_id !== seasonId),
    enrolled: students.filter((student) => student.is_season_registered && student.current_season_id === seasonId),
  };
}

export function toggleTimeSlot(current: TimeSlot[], slot: TimeSlot): TimeSlot[] {
  if (current.includes(slot)) {
    return current.length === 1 ? current : current.filter((item) => item !== slot);
  }
  return [...current, slot];
}

export function getDefaultTimeSlots(season: Season | null, student: SeasonEnrollStudent): TimeSlot[] {
  const gradeSlots = readGradeTimeSlots(season);
  const slots = gradeSlots?.[student.grade];
  return slots && slots.length > 0 ? slots : ['evening'];
}

function readGradeTimeSlots(season: Season | null): Partial<Record<string, TimeSlot[]>> | null {
  if (!season?.grade_time_slots) return null;
  if (typeof season.grade_time_slots !== 'string') return season.grade_time_slots;

  try {
    const parsed = JSON.parse(season.grade_time_slots) as Partial<Record<string, TimeSlot[]>>;
    return parsed && typeof parsed === 'object' ? parsed : null;
  } catch {
    return null;
  }
}
