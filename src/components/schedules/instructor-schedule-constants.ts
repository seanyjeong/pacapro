import { Moon, Sun, Sunrise, type LucideIcon } from 'lucide-react';
import type { TimeSlot } from '@/lib/types/schedule';

export interface InstructorScheduleSlotConfig {
  slot: TimeSlot;
  label: string;
  icon: LucideIcon;
  color: string;
  bgColor: string;
  darkBgColor: string;
  defaultStart: string;
  defaultEnd: string;
}

export const INSTRUCTOR_SCHEDULE_TIME_SLOTS: InstructorScheduleSlotConfig[] = [
  {
    slot: 'morning',
    label: '오전',
    icon: Sunrise,
    color: 'text-orange-600 dark:text-orange-400',
    bgColor: 'bg-orange-50',
    darkBgColor: 'dark:bg-orange-950',
    defaultStart: '09:00',
    defaultEnd: '12:00',
  },
  {
    slot: 'afternoon',
    label: '오후',
    icon: Sun,
    color: 'text-blue-600 dark:text-blue-400',
    bgColor: 'bg-blue-50',
    darkBgColor: 'dark:bg-blue-950',
    defaultStart: '13:00',
    defaultEnd: '17:00',
  },
  {
    slot: 'evening',
    label: '저녁',
    icon: Moon,
    color: 'text-purple-600 dark:text-purple-400',
    bgColor: 'bg-purple-50',
    darkBgColor: 'dark:bg-purple-950',
    defaultStart: '18:00',
    defaultEnd: '21:00',
  },
];

export const INSTRUCTOR_SCHEDULE_LOAD_ERROR =
  '강사 배정 정보를 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export const INSTRUCTOR_SCHEDULE_SAVE_ERROR =
  '강사 배정 정보를 저장하지 못했습니다. 선택 내용을 확인한 뒤 다시 시도해주세요.';
