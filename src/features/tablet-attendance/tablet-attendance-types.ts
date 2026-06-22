import type { AttendanceStatus, TimeSlot } from '@/lib/types/schedule';

export type TabletAttendanceMark = Extract<AttendanceStatus, 'present' | 'absent' | 'late' | 'excused'>;
export type TabletStatusFilter = TabletAttendanceMark | 'not_marked' | 'all';
export type TabletStudentFilter = 'all' | 'regular' | 'trial' | 'makeup' | 'season';

export interface TabletAttendanceStudent {
  student_id: number;
  student_name: string;
  grade?: string | null;
  attendance_status: AttendanceStatus | null;
  notes?: string | null;
  is_trial?: boolean | null;
  trial_remaining?: number | null;
  season_type?: string | null;
  is_makeup?: boolean | null;
}

export interface TabletAttendanceSchedule {
  id: number;
  class_date?: string;
  time_slot?: string;
  students: TabletAttendanceStudent[];
}

export interface TabletAttendanceFilters {
  query: string;
  status: TabletStatusFilter;
  studentType: TabletStudentFilter;
}

export interface TabletReasonState {
  studentId: number;
  studentName: string;
  status: 'absent' | 'excused';
  reason: string;
  customReason: string;
}

export interface TabletAttendanceStats {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  notMarked: number;
}

export interface TabletTimeSlotOption {
  value: TimeSlot;
  label: string;
}
