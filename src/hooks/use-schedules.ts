/**
 * 수업 관리 커스텀 훅
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { schedulesApi } from '@/lib/api/schedules';
import type {
  ClassSchedule,
  Attendance,
  ScheduleFormData,
  ScheduleFilters,
  AttendanceBatchSubmission,
  ScheduleStats,
} from '@/lib/types/schedule';
import { toast } from 'sonner';

const QUERY_KEYS = {
  schedules: (filters?: ScheduleFilters) => ['schedules', filters] as const,
  schedule: (id: number) => ['schedules', id] as const,
  attendance: (scheduleId: number) => ['schedules', scheduleId, 'attendance'] as const,
  stats: (filters?: ScheduleFilters) => ['schedules', 'stats', filters] as const,
};

/**
 * 수업 목록 조회 훅
 */
export function useSchedules(filters?: ScheduleFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.schedules(filters),
    queryFn: () => schedulesApi.getSchedules(filters),
  });
}

/**
 * 수업 상세 조회 훅
 */
export function useSchedule(id: number) {
  return useQuery({
    queryKey: QUERY_KEYS.schedule(id),
    queryFn: () => schedulesApi.getSchedule(id),
    enabled: !!id,
  });
}

/**
 * 출석 현황 조회 훅
 */
export function useAttendance(scheduleId: number) {
  return useQuery({
    queryKey: QUERY_KEYS.attendance(scheduleId),
    queryFn: async () => {
      const response = await schedulesApi.getAttendance(scheduleId);
      // students 배열만 반환 (백엔드가 { schedule, students } 형태로 반환)
      return response.students || [];
    },
    enabled: !!scheduleId,
  });
}

/**
 * 수업 통계 조회 훅
 */
export function useScheduleStats(filters?: ScheduleFilters) {
  return useQuery({
    queryKey: QUERY_KEYS.stats(filters),
    queryFn: () => schedulesApi.getStats(filters),
  });
}

/**
 * 수업 등록 뮤테이션 훅
 */
export function useCreateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: ScheduleFormData) => schedulesApi.createSchedule(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('수업이 등록되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`수업 등록 실패: ${error.message}`);
    },
  });
}

/**
 * 수업 수정 뮤테이션 훅
 */
export function useUpdateSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<ScheduleFormData> }) =>
      schedulesApi.updateSchedule(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(variables.id) });
      toast.success('수업이 수정되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`수업 수정 실패: ${error.message}`);
    },
  });
}

/**
 * 수업 삭제 뮤테이션 훅
 */
export function useDeleteSchedule() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => schedulesApi.deleteSchedule(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('수업이 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`수업 삭제 실패: ${error.message}`);
    },
  });
}

/**
 * 출석 체크 뮤테이션 훅
 */
export function useSubmitAttendance() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ scheduleId, data }: { scheduleId: number; data: AttendanceBatchSubmission }) =>
      schedulesApi.submitAttendance(scheduleId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.attendance(variables.scheduleId) });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.schedule(variables.scheduleId) });
      queryClient.invalidateQueries({ queryKey: ['schedules'] });
      toast.success('출석이 체크되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`출석 체크 실패: ${error.message}`);
    },
  });
}
