import type { ClassDaySlot } from '@/lib/types/student';

export interface StudentEdit {
  class_days: ClassDaySlot[];
  changed: boolean;
}

export type TimeSlot = ClassDaySlot['timeSlot'];
