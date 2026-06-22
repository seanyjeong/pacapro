import type { InstructorAttendanceRecord } from '@/lib/api/schedules';
import { MOBILE_INSTRUCTOR_TIME_SLOTS } from './mobile-instructor-constants';
import type {
  MobileInstructor,
  MobileInstructorAttendanceStatus,
  MobileInstructorStats,
  MobileInstructorTimeSlot,
} from './mobile-instructor-types';

interface InstructorApiItem {
  id: number;
  name: string;
  salary_type?: string | null;
  source?: string | null;
}

interface InstructorAttendanceResponse {
  instructors?: InstructorApiItem[];
  instructors_by_slot?: Partial<Record<MobileInstructorTimeSlot, InstructorApiItem[]>>;
  attendances?: InstructorAttendanceRecord[];
}

export function toLocalDateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

export function formatDateLabel(date: string) {
  return new Date(date).toLocaleDateString('ko-KR', {
    month: 'long',
    day: 'numeric',
    weekday: 'short',
  });
}

export function makeInstructorKey(instructorId: number, timeSlot: MobileInstructorTimeSlot) {
  return `${instructorId}-${timeSlot}`;
}

export function parseInstructorKey(key: string) {
  const [instructorId, timeSlot] = key.split('-');
  return {
    instructorId: Number(instructorId),
    timeSlot: timeSlot as MobileInstructorTimeSlot,
  };
}

export function normalizeInstructorsBySlot(response: InstructorAttendanceResponse) {
  const slots: Record<MobileInstructorTimeSlot, MobileInstructor[]> = {
    morning: [],
    afternoon: [],
    evening: [],
  };

  if (response.instructors_by_slot) {
    MOBILE_INSTRUCTOR_TIME_SLOTS.forEach((slot) => {
      slots[slot.value] = (response.instructors_by_slot?.[slot.value] || []).map((instructor) => ({
        id: instructor.id,
        name: instructor.name,
        timeSlot: slot.value,
        source: instructor.source,
        salaryType: instructor.salary_type,
      }));
    });
    return slots;
  }

  (response.instructors || []).forEach((instructor) => {
    MOBILE_INSTRUCTOR_TIME_SLOTS.forEach((slot) => {
      slots[slot.value].push({
        id: instructor.id,
        name: instructor.name,
        timeSlot: slot.value,
        source: instructor.source,
        salaryType: instructor.salary_type,
      });
    });
  });

  return slots;
}

export function buildAttendanceMap(records: InstructorAttendanceRecord[] = []) {
  const map = new Map<string, MobileInstructorAttendanceStatus>();
  records.forEach((record) => {
    if (record.attendance_status) {
      map.set(
        makeInstructorKey(record.instructor_id, record.time_slot),
        record.attendance_status as MobileInstructorAttendanceStatus
      );
    }
  });
  return map;
}

export function calculateInstructorStats(
  instructorsBySlot: Record<MobileInstructorTimeSlot, MobileInstructor[]>,
  attendances: Map<string, MobileInstructorAttendanceStatus>,
  clearedKeys: Set<string>
): MobileInstructorStats {
  const stats: MobileInstructorStats = {
    total: MOBILE_INSTRUCTOR_TIME_SLOTS.reduce((sum, slot) => sum + instructorsBySlot[slot.value].length, 0),
    checked: attendances.size,
    present: 0,
    late: 0,
    halfDay: 0,
    absent: 0,
    cleared: clearedKeys.size,
  };

  attendances.forEach((status) => {
    if (status === 'half_day') stats.halfDay += 1;
    else stats[status] += 1;
  });

  return stats;
}
