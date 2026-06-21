import type { Attendance, AttendanceStatus, AttendanceSubmission } from '@/lib/types/schedule';

export interface AttendanceCheckerProps {
  attendances: Attendance[];
  onSubmit: (submissions: AttendanceSubmission[]) => void;
  isSubmitting?: boolean;
  readOnly?: boolean;
  currentDate?: string;
  scheduleId?: number;
  timeSlot?: string;
  onStudentAdded?: () => void;
}

export interface EditedAttendanceData {
  status: AttendanceStatus | null;
  makeup_date?: string;
  notes?: string;
}

export interface AttendanceSearchStudent {
  id: number;
  name: string;
  grade: string;
  student_number: string;
}

export interface ReasonModalData {
  studentId: number;
  studentName: string;
  status: 'absent' | 'excused';
  reason: string;
  customReason: string;
}
