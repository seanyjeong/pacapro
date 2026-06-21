import { eachDayOfInterval, endOfMonth, format, isSameDay, parseISO, startOfMonth } from 'date-fns';
import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import {
  LEARNING_STATUS_DOT_COLORS,
  STATUS_DOT_COLORS,
} from './consultation-calendar-constants';
import type { StudentConsultationMemo } from './consultation-calendar-types';

export function getInitialMonth(dateParam: string | null) {
  if (!dateParam) return new Date();
  try {
    return parseISO(dateParam);
  } catch {
    return new Date();
  }
}

export function getMonthRange(currentMonth: Date) {
  const start = startOfMonth(currentMonth);
  const end = endOfMonth(currentMonth);
  return {
    start,
    end,
    startStr: format(start, 'yyyy-MM-dd'),
    endStr: format(end, 'yyyy-MM-dd'),
  };
}

export function getCalendarDays(currentMonth: Date) {
  const { start, end } = getMonthRange(currentMonth);
  return eachDayOfInterval({ start, end });
}

export function getStartPadding(currentMonth: Date) {
  return startOfMonth(currentMonth).getDay();
}

export function getConsultationsForDate(consultations: Consultation[], date: Date) {
  return consultations.filter((consultation) => (
    isSameDay(parseISO(consultation.preferred_date), date)
  ));
}

export function getMemosForDate(memos: StudentConsultationMemo[], date: Date) {
  return memos.filter((memo) => (
    isSameDay(parseISO(memo.consultation_date), date)
  ));
}

export function groupConsultationsByHour(consultations: Consultation[]) {
  const sorted = [...consultations].sort((a, b) => a.preferred_time.localeCompare(b.preferred_time));
  return sorted.reduce<Record<string, Consultation[]>>((acc, consultation) => {
    const hour = consultation.preferred_time.substring(0, 2);
    const timeLabel = `${hour}:00`;
    acc[timeLabel] = [...(acc[timeLabel] || []), consultation];
    return acc;
  }, {});
}

export function getStatusDot(status: ConsultationStatus, isLearning = false) {
  return isLearning ? LEARNING_STATUS_DOT_COLORS[status] : STATUS_DOT_COLORS[status];
}

export function isFinishedConsultation(status: ConsultationStatus) {
  return ['completed', 'cancelled', 'no_show'].includes(status);
}
