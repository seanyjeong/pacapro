/**
 * 수업 관리 타입 정의
 */

export type TimeSlot = 'morning' | 'afternoon' | 'evening';

export type AttendanceStatus = 'present' | 'absent' | 'late' | 'excused' | 'makeup';

export interface ClassSchedule {
  id: number;
  class_date: string; // YYYY-MM-DD
  time_slot: TimeSlot;
  instructor_id: number;
  instructor_name?: string;
  title?: string;
  content?: string;
  attendance_taken: boolean;
  notes?: string;
  student_count?: number; // 배정된 학생 수
  created_at: string;
  updated_at?: string;
}

export interface Attendance {
  student_id: number;
  student_name: string;
  student_number: string;
  attendance_status: AttendanceStatus | null;
  makeup_date?: string; // 보충 날짜 (YYYY-MM-DD)
  is_makeup?: boolean; // 이 학생이 다른 날짜에서 보충으로 온 학생인지
  original_date?: string; // 보충인 경우 원래 결석했던 날짜
  notes?: string;
}

export interface AttendanceRecord extends Attendance {
  schedule_id: number;
  class_date: string;
  time_slot: TimeSlot;
  instructor_name?: string;
}

export interface ScheduleFormData {
  class_date: string;
  time_slot: TimeSlot;
  instructor_id: number;
  title?: string;
  content?: string;
  notes?: string;
}

export interface ScheduleFilters {
  start_date?: string;
  end_date?: string;
  instructor_id?: number;
  time_slot?: TimeSlot;
  attendance_taken?: boolean;
}

export interface AttendanceSubmission {
  student_id: number;
  attendance_status: AttendanceStatus;
  makeup_date?: string; // 보충 상태일 때 보충 날짜
  notes?: string;
}

export interface AttendanceBatchSubmission {
  attendance_records: AttendanceSubmission[];
}

export interface ScheduleStats {
  total_schedules: number;
  attendance_completed: number;
  attendance_pending: number;
  by_time_slot: {
    morning: number;
    afternoon: number;
    evening: number;
  };
}

export interface CalendarEvent {
  id: number;
  date: string;
  time_slot: TimeSlot;
  title: string;
  instructor_name: string;
  attendance_taken: boolean;
}

export const TIME_SLOT_LABELS: Record<TimeSlot, string> = {
  morning: '오전',
  afternoon: '오후',
  evening: '저녁',
};

export const TIME_SLOT_COLORS: Record<TimeSlot, string> = {
  morning: 'bg-blue-100 text-blue-800 border-blue-200',
  afternoon: 'bg-green-100 text-green-800 border-green-200',
  evening: 'bg-purple-100 text-purple-800 border-purple-200',
};

export const ATTENDANCE_STATUS_LABELS: Record<AttendanceStatus, string> = {
  present: '출석',
  absent: '결석',
  late: '지각',
  excused: '공결',
  makeup: '보충',
};

export const ATTENDANCE_STATUS_COLORS: Record<AttendanceStatus, string> = {
  present: 'bg-green-100 text-green-800',
  absent: 'bg-red-100 text-red-800',
  late: 'bg-yellow-100 text-yellow-800',
  excused: 'bg-blue-100 text-blue-800',
  makeup: 'bg-purple-100 text-purple-800',
};

// 요일 라벨 (0=일요일 ~ 6=토요일)
export const WEEKDAY_LABELS: Record<number, string> = {
  0: '일',
  1: '월',
  2: '화',
  3: '수',
  4: '목',
  5: '금',
  6: '토',
};
