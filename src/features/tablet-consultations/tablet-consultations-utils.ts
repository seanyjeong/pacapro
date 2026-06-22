import type { Consultation, ConsultationStatus } from '@/lib/types/consultation';
import { formatDateToString, getToday } from '@/lib/utils/schedule-helpers';

export type TabletConsultationDateFilter = 'selected' | 'all';
export type TabletConsultationStats = Partial<Record<ConsultationStatus | 'total', number>>;

const ACTIVE_STATUSES: ConsultationStatus[] = ['pending', 'confirmed'];

export function moveTabletConsultationDate(dateStr: string, delta: number): string {
  const date = new Date(`${dateStr}T00:00:00`);
  date.setDate(date.getDate() + delta);
  return formatDateToString(date);
}

export function isSelectedDateToday(dateStr: string): boolean {
  return dateStr === getToday();
}

export function formatTabletConsultationDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}월 ${date.getDate()}일 (${weekdays[date.getDay()]})`;
}

export function formatTabletConsultationShortDate(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00`);
  const weekdays = ['일', '월', '화', '수', '목', '금', '토'];
  return `${date.getMonth() + 1}/${date.getDate()} (${weekdays[date.getDay()]})`;
}

export function formatTabletConsultationTime(time: string | null | undefined): string {
  if (!time) return '시간 미정';
  const [hourValue, minuteValue = '00'] = time.split(':');
  const hour = Number(hourValue);
  if (Number.isNaN(hour)) return time;
  const period = hour < 12 ? '오전' : '오후';
  const displayHour = hour === 0 ? 12 : hour > 12 ? hour - 12 : hour;
  return `${period} ${displayHour}:${minuteValue.padStart(2, '0')}`;
}

export function sortTabletConsultations(consultations: Consultation[]): Consultation[] {
  return [...consultations].sort((first, second) => {
    const firstKey = `${first.preferred_date || ''} ${first.preferred_time || ''} ${first.student_name}`;
    const secondKey = `${second.preferred_date || ''} ${second.preferred_time || ''} ${second.student_name}`;
    return firstKey.localeCompare(secondKey);
  });
}

export function isActiveTabletConsultation(status: ConsultationStatus): boolean {
  return ACTIVE_STATUSES.includes(status);
}

export function getTabletConsultationPhone(consultation: Consultation): string {
  return consultation.student_phone || consultation.parent_phone || '';
}

export function getTabletConsultationTotal(stats: TabletConsultationStats, fallback: number): number {
  if (typeof stats.total === 'number') return stats.total;
  const statusTotal = (['pending', 'confirmed', 'completed', 'cancelled', 'no_show'] as ConsultationStatus[])
    .reduce((sum, status) => sum + (stats[status] || 0), 0);
  return statusTotal || fallback;
}
