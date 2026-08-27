'use client';

import { useQuery } from '@tanstack/react-query';
import { schedulesApi } from '@/lib/api/schedules';

const LOAD_ERROR_MESSAGE = '출근 예정 일정을 불러오지 못했습니다. 잠시 후 다시 시도해주세요.';

export function useInstructorWorkCalendar(instructorId: number, year: number, monthIndex: number) {
  const query = useQuery({
    queryKey: ['instructor-work-calendar', instructorId, year, monthIndex],
    queryFn: () => schedulesApi.getMonthlyInstructorWorkSchedule(
      instructorId,
      year,
      monthIndex + 1,
      { suppressErrorToast: true }
    ),
    enabled: instructorId > 0,
  });

  return {
    schedules: query.data?.schedules || [],
    loading: query.isLoading,
    error: query.error ? LOAD_ERROR_MESSAGE : null,
    retry: query.refetch,
  };
}
