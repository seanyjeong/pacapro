import type { TimeSlot } from '@/lib/types/schedule';

export type InstructorAttendanceValue = 'present' | 'absent' | 'late' | 'half_day' | 'none' | '';
export type StudentAttendanceValue = 'present' | 'absent' | 'late' | 'excused' | 'none' | '';
export type AbsenceStatus = 'absent' | 'excused';
export type InstructorClockField = 'checkIn' | 'checkOut';

export interface AttendanceStudent {
  student_id: number;
  student_name: string;
  grade?: string | null;
  attendance_status: StudentAttendanceValue | string | null;
  season_type?: string | null;
  is_trial?: boolean | null;
  trial_remaining?: number | null;
  trial_dates?: Array<{ date: string; attended: boolean; time_slot: string }> | null;
  is_makeup?: boolean | number | null;
  notes?: string | null;
}

export interface Instructor {
  id: number;
  name: string;
  salary_type: 'hourly' | 'per_class' | 'monthly' | 'mixed';
}

export interface InstructorAttendance {
  instructor_id: number;
  instructor_name: string;
  attendance_status: InstructorAttendanceValue | string | null;
  check_in_time?: string | null;
  check_out_time?: string | null;
  time_slot?: string;
}

export interface SearchStudent {
  id: number;
  name: string;
  grade: string;
  student_number: string;
}

export interface TimeSlotDetailModalProps {
  open: boolean;
  date: string | null;
  timeSlot: TimeSlot | null;
  onClose: () => void;
  onStudentMoved?: () => void;
}

export interface InstructorAttendanceState {
  status: InstructorAttendanceValue | string;
  checkIn?: string;
  checkOut?: string;
}

export interface StudentAttendanceState {
  status: StudentAttendanceValue | string;
  notes?: string;
}

export interface ReasonInputState {
  studentId: number;
  status: AbsenceStatus;
  reason: string;
  customReason: string;
}

export interface SlotDataResponse {
  schedule: { id: number; students: AttendanceStudent[] } | null;
}

export interface InstructorAttendanceResponse {
  instructors: Instructor[];
  instructors_by_slot?: Partial<Record<TimeSlot, Instructor[]>>;
  attendances?: InstructorAttendance[];
}

export interface InstructorAttendanceSubmission {
  instructor_id: number;
  time_slot: TimeSlot;
  attendance_status: InstructorAttendanceValue | string;
  check_in_time?: string | null;
  check_out_time?: string | null;
}

export interface StudentAttendanceSubmission {
  student_id: number;
  attendance_status: StudentAttendanceValue | string;
  notes?: string | null;
}
