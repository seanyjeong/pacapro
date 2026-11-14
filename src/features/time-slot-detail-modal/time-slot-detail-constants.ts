import type { LucideIcon } from 'lucide-react';
import { Moon, Sun, Sunrise } from 'lucide-react';
import type { TimeSlot } from '@/lib/types/schedule';

export const TIME_SLOT_INFO: Record<TimeSlot, {
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
}> = {
  morning: {
    label: '오전',
    icon: Sunrise,
    color: 'text-warning',
    bgColor: 'bg-warning-soft',
  },
  afternoon: {
    label: '오후',
    icon: Sun,
    color: 'text-primary',
    bgColor: 'bg-primary-soft',
  },
  evening: {
    label: '저녁',
    icon: Moon,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-100 dark:bg-purple-950',
  },
};

export const OTHER_SLOTS: Record<TimeSlot, TimeSlot[]> = {
  morning: ['afternoon', 'evening'],
  afternoon: ['morning', 'evening'],
  evening: ['morning', 'afternoon'],
};

export const INSTRUCTOR_ATTENDANCE_STATUS = [
  { value: 'present', label: '출근', color: 'bg-success' },
  { value: 'absent', label: '결근', color: 'bg-destructive' },
  { value: 'late', label: '지각', color: 'bg-warning' },
  { value: 'half_day', label: '반차', color: 'bg-primary' },
] as const;

export const STUDENT_ATTENDANCE_STATUS = [
  { value: 'present', label: '출석', color: 'bg-success' },
  { value: 'absent', label: '결석', color: 'bg-destructive' },
  { value: 'late', label: '지각', color: 'bg-warning' },
  { value: 'excused', label: '공결', color: 'bg-primary' },
] as const;

export const EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
] as const;

export const ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
] as const;
