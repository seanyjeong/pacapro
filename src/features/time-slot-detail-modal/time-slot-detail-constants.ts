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
    color: 'text-secondary-foreground',
    bgColor: 'bg-muted',
  },
};

export const OTHER_SLOTS: Record<TimeSlot, TimeSlot[]> = {
  morning: ['afternoon', 'evening'],
  afternoon: ['morning', 'evening'],
  evening: ['morning', 'afternoon'],
};

export const INSTRUCTOR_ATTENDANCE_STATUS = [
  { value: 'present', label: '출근', color: 'bg-success-soft text-success ring-2 ring-inset ring-success/50' },
  { value: 'absent', label: '결근', color: 'bg-destructive-soft text-destructive ring-2 ring-inset ring-destructive/50' },
  { value: 'late', label: '지각', color: 'bg-warning-soft text-warning ring-2 ring-inset ring-warning/50' },
  { value: 'half_day', label: '반차', color: 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50' },
] as const;

export const STUDENT_ATTENDANCE_STATUS = [
  { value: 'present', label: '출석', color: 'bg-success-soft text-success ring-2 ring-inset ring-success/50' },
  { value: 'absent', label: '결석', color: 'bg-destructive-soft text-destructive ring-2 ring-inset ring-destructive/50' },
  { value: 'late', label: '지각', color: 'bg-warning-soft text-warning ring-2 ring-inset ring-warning/50' },
  { value: 'excused', label: '공결', color: 'bg-primary-soft text-primary ring-2 ring-inset ring-primary/50' },
] as const;

export const EXCUSED_REASONS = [
  { value: '질병', label: '질병' },
  { value: '학교시험', label: '학교 시험' },
] as const;

export const ABSENT_REASONS = [
  { value: '개인사정', label: '개인 사정' },
  { value: '무단결석', label: '무단 결석' },
] as const;
