import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';

export type MarkableAttendanceStatus = Extract<AttendanceStatus, 'present' | 'absent' | 'late' | 'excused'>;

export interface MobileAttendanceStudent {
  student_id: number;
  student_name: string;
  grade?: string;
  attendance_status: AttendanceStatus | null;
  notes?: string | null;
  season_type?: string | null;
  is_trial?: boolean | null;
  trial_remaining?: number | null;
  phone?: string | null;
  parent_phone?: string | null;
  is_makeup?: boolean | null;
  is_season_student?: boolean;
}

export interface MobileAttendanceSchedule {
  id: number;
  students: MobileAttendanceStudent[];
}

export interface ReasonSheetState {
  studentId: number;
  studentName: string;
  status: 'absent' | 'excused';
  reason: string;
  customReason: string;
}

export interface AttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
}

export interface TimeSlotOption {
  value: TimeSlot;
  label: string;
}
