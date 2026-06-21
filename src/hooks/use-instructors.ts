/**
 * Custom Hooks for Instructor Management
 * 강사 관리 커스텀 훅 - React Query 기반 (backward-compatible interface)
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { instructorsAPI } from '@/lib/api/instructors';
import type {
  Instructor,
  InstructorFilters,
  InstructorDetail,
  InstructorAttendance,
  SalaryRecord,
  InstructorFormData,
} from '@/lib/types/instructor';
import { toast } from 'sonner';

const QUERY_KEYS = {
  instructors: (filters?: InstructorFilters) => ['instructors', filters] as const,
  instructor: (id: number) => ['instructors', id] as const,
};

/**
 * 강사 목록 조회 훅
 */
export function useInstructors(initialFilters?: InstructorFilters) {
  const [filters, setFilters] = useState<InstructorFilters>(initialFilters || {});

  const query = useQuery({
    queryKey: QUERY_KEYS.instructors(filters),
    queryFn: async () => {
      const data = await instructorsAPI.getInstructors(filters);
      return data.instructors as Instructor[];
    },
  });

  const updateFilters = useCallback((newFilters: Partial<InstructorFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    instructors: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    reload,
  };
}

/**
 * 강사 상세 정보 조회 훅
 */
export function useInstructor(id: number) {
  const query = useQuery({
    queryKey: QUERY_KEYS.instructor(id),
    queryFn: async () => {
      const data = await instructorsAPI.getInstructor(id);
      return {
        instructor: data.instructor as InstructorDetail,
        attendances: (data.attendances || []) as InstructorAttendance[],
        salaries: (data.salaries || []) as SalaryRecord[],
      };
    },
    enabled: !!id,
  });

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    instructor: query.data?.instructor || null,
    attendances: query.data?.attendances || [],
    salaries: query.data?.salaries || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    reload,
  };
}

/**
 * 강사 등록 뮤테이션 훅
 */
export function useCreateInstructor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: InstructorFormData) => instructorsAPI.createInstructor(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      toast.success('강사가 등록되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`강사 등록 실패: ${error.message}`);
    },
  });
}

/**
 * 강사 수정 뮤테이션 훅
 */
export function useUpdateInstructor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<InstructorFormData> }) =>
      instructorsAPI.updateInstructor(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.instructor(variables.id) });
      toast.success('강사 정보가 수정되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`강사 수정 실패: ${error.message}`);
    },
  });
}

/**
 * 강사 삭제 뮤테이션 훅
 */
export function useDeleteInstructor() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => instructorsAPI.deleteInstructor(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['instructors'] });
      toast.success('강사가 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`강사 삭제 실패: ${error.message}`);
    },
  });
}
