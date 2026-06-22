export type MobileInstructorTimeSlot = 'morning' | 'afternoon' | 'evening';

export type MobileInstructorAttendanceStatus = 'present' | 'absent' | 'late' | 'half_day';

export interface MobileInstructor {
  id: number;
  name: string;
  timeSlot: MobileInstructorTimeSlot;
  source?: string | null;
  salaryType?: string | null;
}

export interface MobileInstructorStats {
  total: number;
  checked: number;
  present: number;
  late: number;
  halfDay: number;
  absent: number;
  cleared: number;
}

export interface SlotOption {
  value: MobileInstructorTimeSlot;
  label: string;
}

export interface StatusOption {
  value: MobileInstructorAttendanceStatus;
  label: string;
  activeClassName: string;
  buttonClassName: string;
  badgeClassName: string;
}
