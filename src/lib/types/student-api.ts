import type { Student, StudentDetail, StudentPayment, StudentPerformance } from './student';

export interface StudentAttendanceRecord {
  date: string;
  time_slot: 'morning' | 'afternoon' | 'evening';
  attendance_status: 'present' | 'absent' | 'late' | 'excused' | null;
  is_makeup: boolean;
  notes: string | null;
}

export interface StudentAttendanceSummary {
  total: number;
  present: number;
  absent: number;
  late: number;
  excused: number;
  makeup: number;
  attendance_rate: number;
}

export interface StudentAttendanceResponse {
  student_id: number;
  year_month: string;
  summary: StudentAttendanceSummary;
  records: StudentAttendanceRecord[];
}

export interface StudentsResponse {
  message: string;
  students: Student[];
}

export interface StudentDetailResponse {
  message?: string;
  student: StudentDetail;
  performances: StudentPerformance[];
  payments: StudentPayment[];
}

export interface StudentCreateResponse {
  message: string;
  student: Student;
}

export interface StudentUpdateResponse {
  message: string;
  student: Student;
  pendingInfo?: {
    deletedSchedules: number;
    message: string;
  } | null;
  enrollmentDateRecalc?: {
    type: 'recalculated' | 'skipped';
    message: string;
    finalAmount?: number;
  };
}

export interface StudentDeleteResponse {
  message: string;
  student: {
    id: number;
    name: string;
  };
}
