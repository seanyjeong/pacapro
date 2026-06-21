import { format } from 'date-fns';
import type { WeeklyHour } from '@/lib/types/consultation';
import type { DateFilter, Student } from './enrolled-consultations-types';

export function addDays(date: Date, days: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function getDateRange(dateFilter: DateFilter) {
  const today = new Date();
  if (dateFilter === 'today') {
    const dateStr = format(today, 'yyyy-MM-dd');
    return { startDate: dateStr, endDate: dateStr };
  }
  if (dateFilter === 'week') {
    return {
      startDate: format(today, 'yyyy-MM-dd'),
      endDate: format(addDays(today, 7), 'yyyy-MM-dd'),
    };
  }
  return { startDate: undefined, endDate: undefined };
}

export function generateTimeSlots(date: string, weeklyHours: WeeklyHour[]) {
  if (!date || weeklyHours.length === 0) return [];
  const dayOfWeek = new Date(date).getDay();
  const hourConfig = weeklyHours.find((hour) => hour.dayOfWeek === dayOfWeek);
  if (!hourConfig || !hourConfig.isAvailable) return [];

  const startHour = Number.parseInt(hourConfig.startTime?.substring(0, 2) || '09', 10);
  const startMin = Number.parseInt(hourConfig.startTime?.substring(3, 5) || '00', 10);
  const endHour = Number.parseInt(hourConfig.endTime?.substring(0, 2) || '18', 10);
  const endMin = Number.parseInt(hourConfig.endTime?.substring(3, 5) || '00', 10);
  const slots: string[] = [];
  let current = startHour * 60 + startMin;
  const end = endHour * 60 + endMin;

  while (current < end) {
    const hour = Math.floor(current / 60);
    const minute = current % 60;
    slots.push(`${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`);
    current += 30;
  }

  return slots;
}

export function filterStudents(students: Student[], keyword: string) {
  const normalized = keyword.toLowerCase();
  return students.filter((student) => (
    !normalized ||
    student.name?.toLowerCase().includes(normalized) ||
    student.grade?.toLowerCase().includes(normalized)
  ));
}
