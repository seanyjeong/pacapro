import type { SalaryDetail } from '@/lib/types/salary';
import type { SalaryType } from '@/lib/types/instructor';

export interface AttendanceDetail {
  time_slot: string;
  time_slot_label: string;
  check_in_time: string | null;
  check_out_time: string | null;
  attendance_status: string;
}

export interface DailyBreakdown {
  slots: string[];
  details: AttendanceDetail[];
}

export interface AttendanceSummary {
  work_year_month: string;
  attendance_days: number;
  total_classes: number;
  morning_classes: number;
  afternoon_classes: number;
  evening_classes: number;
  total_hours: number;
  daily_breakdown: Record<string, DailyBreakdown>;
}

export interface SalaryDetailWithRates extends Omit<SalaryDetail, 'salary_type' | 'hourly_rate'> {
  salary_type?: SalaryType;
  hourly_rate?: number | string;
  morning_class_rate?: number | string;
  afternoon_class_rate?: number | string;
  evening_class_rate?: number | string;
  base_salary?: number | string;
}

export interface SalaryDetailResponseForPage {
  salary: SalaryDetailWithRates;
  attendance_summary?: AttendanceSummary | null;
}
