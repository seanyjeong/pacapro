import type { InstructorWorkSchedule } from '@/lib/api/schedules';

export interface InstructorWorkCalendarDay {
  date: string;
  dayOfMonth: number;
  isCurrentMonth: boolean;
  isToday: boolean;
}

export function buildInstructorWorkCalendarDays(year: number, monthIndex: number): InstructorWorkCalendarDay[] {
  const firstDay = new Date(year, monthIndex, 1);
  const gridStart = new Date(year, monthIndex, 1 - firstDay.getDay());
  const today = formatLocalDate(new Date());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    const dateText = formatLocalDate(date);
    return {
      date: dateText,
      dayOfMonth: date.getDate(),
      isCurrentMonth: date.getMonth() === monthIndex,
      isToday: dateText === today,
    };
  });
}

export function groupInstructorSchedulesByDate<T extends Pick<InstructorWorkSchedule, 'work_date' | 'time_slot'>>(schedules: T[]) {
  const grouped = new Map<string, T[]>();
  schedules.forEach((schedule) => {
    const current = grouped.get(schedule.work_date) || [];
    current.push(schedule);
    grouped.set(schedule.work_date, current);
  });
  return grouped;
}

export function formatScheduleTime(value?: string | null): string {
  return value ? value.slice(0, 5) : '';
}

function formatLocalDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}
