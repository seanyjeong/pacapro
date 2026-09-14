import type { StudentParentNames } from '@/lib/types/student-parent-names';

export interface TabletStudentDetail extends StudentParentNames {
  address: string | null;
  class_days: unknown;
  discount_rate: number | string;
  enrollment_date: string;
  final_monthly_tuition?: number | string | null;
  gender: string;
  grade: string;
  id: number;
  is_trial: boolean;
  memo: string | null;
  monthly_tuition: number | string;
  name: string;
  parent_phone: string | null;
  phone: string | null;
  school: string;
  status: string;
  student_type: string;
  trial_remaining: number;
}

export interface TabletAttendanceSummary {
  absent: number;
  present: number;
  rate: number;
  total: number;
}
