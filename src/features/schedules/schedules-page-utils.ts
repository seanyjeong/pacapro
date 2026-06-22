import type { ScheduleFilters } from '@/lib/types/schedule';
import { getMonthRange } from '@/lib/utils/schedule-helpers';

export const SCHEDULES_LOAD_ERROR = '수업 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';
export const SCHEDULE_DELETE_ERROR = '수업을 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.';

export function createInitialScheduleFilters(): ScheduleFilters {
  const today = new Date();
  const { start, end } = getMonthRange(today.getFullYear(), today.getMonth());
  return { start_date: start, end_date: end };
}

export function getInitialYearMonth() {
  const today = new Date();
  return { year: today.getFullYear(), month: today.getMonth() };
}
