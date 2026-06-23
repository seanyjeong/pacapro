import type { TimeSlot } from '@/lib/types/schedule';

export interface InstructorScheduleInstructor {
  id: number;
  name: string;
  salary_type: 'hourly' | 'per_class' | 'monthly' | 'mixed';
  hourly_rate?: number;
}

export interface InstructorScheduleEntry {
  instructor_id: number;
  instructor_name: string;
  salary_type: string;
  scheduled_start_time?: string | null;
  scheduled_end_time?: string | null;
}

export type InstructorSchedulesBySlot = Record<TimeSlot, InstructorScheduleEntry[]>;

export interface InstructorScheduleSelection {
  selected: boolean;
  startTime?: string;
  endTime?: string;
}

export type InstructorScheduleSelections = Record<TimeSlot, Record<number, InstructorScheduleSelection>>;

export interface InstructorSchedulePayloadEntry {
  instructor_id: number;
  time_slot: TimeSlot;
  scheduled_start_time?: string;
  scheduled_end_time?: string;
}
