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
  assigned?: boolean; // 반으로 볼 때만: 그날 수업에 아직 없는 반 학생이면 false
}

export interface TabletAttendanceSchedule {
  id: number | null; // 반으로 볼 때 그날 수업이 아직 없으면 null
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
