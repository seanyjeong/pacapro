import type { TimeSlot } from '@/lib/types/schedule';

export type InstructorAttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';

export type InstructorOption = {
  id: number;
  name: string;
};

export interface EditedInstructorAttendance {
  status: InstructorAttendanceStatus;
  checkInTime?: string;
  checkOutTime?: string;
  notes?: string;
}

export interface InstructorAttendanceStats {
  total: number;
  checked: number;
  present: number;
  absent: number;
  late: number;
  halfDay: number;
}

export type InstructorsBySlot = Record<TimeSlot, InstructorOption[]>;

export type SlotCounts = Record<TimeSlot, number>;
