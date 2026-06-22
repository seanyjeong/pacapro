import { addDays, isBefore, startOfDay } from 'date-fns';
import type { WeeklyHour } from '@/lib/types/consultation';

export function buildCalendarDays(currentMonth: Date, advanceDays: number) {
  const today = startOfDay(new Date());
  const maxDate = addDays(today, advanceDays || 30);
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const firstDay = new Date(year, month, 1);
  const lastDay = new Date(year, month + 1, 0);
  const days: Array<Date | null> = [];

  for (let index = 0; index < firstDay.getDay(); index += 1) {
    days.push(null);
  }
  for (let day = 1; day <= lastDay.getDate(); day += 1) {
    days.push(new Date(year, month, day));
  }

  return { days, maxDate, today };
}

export function isBookingDateAvailable(date: Date, today: Date, maxDate: Date, weeklyHours: WeeklyHour[]): boolean {
  if (isBefore(date, today)) return false;
  if (isBefore(maxDate, date)) return false;
  const weeklyHour = weeklyHours.find((hour) => hour.dayOfWeek === date.getDay());
  return weeklyHour?.isAvailable ?? false;
}
