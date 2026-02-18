/**
 * Custom Hooks for Salary Management
 * 급여 관리 커스텀 훅 - React Query 기반 (backward-compatible interface)
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { salariesAPI } from '@/lib/api/salaries';
import type { Salary, SalaryDetail, SalaryFilters, SalaryFormData } from '@/lib/types/salary';
import { toast } from 'sonner';

const QUERY_KEYS = {
  salaries: (filters?: SalaryFilters) => ['salaries', filters] as const,
  salary: (id: number) => ['salaries', id] as const,
};

/**
 * 급여 목록 조회 훅
 */
export function useSalaries(initialFilters?: SalaryFilters) {
  const [filters, setFilters] = useState<SalaryFilters>(initialFilters || {});

  const query = useQuery({
    queryKey: QUERY_KEYS.salaries(filters),
    queryFn: async () => {
      const data = await salariesAPI.getSalaries(filters);
      return data.salaries as Salary[];
    },
  });

  const updateFilters = useCallback((newFilters: Partial<SalaryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    salaries: query.data || [],
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
 * 급여 상세 정보 조회 훅
 */
export function useSalary(id: number) {
  const query = useQuery({
    queryKey: QUERY_KEYS.salary(id),
    queryFn: async () => {
      const data = await salariesAPI.getSalary(id);
      return data.salary as SalaryDetail;
    },
    enabled: !!id,
  });

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    salary: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
    reload,
  };
}

/**
 * 급여 등록 뮤테이션 훅
 */
export function useCreateSalary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: SalaryFormData) => salariesAPI.createSalary(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      toast.success('급여가 등록되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`급여 등록 실패: ${error.message}`);
    },
  });
}

/**
 * 급여 수정 뮤테이션 훅
 */
export function useUpdateSalary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<SalaryFormData> }) =>
      salariesAPI.updateSalary(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.salary(variables.id) });
      toast.success('급여 정보가 수정되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`급여 수정 실패: ${error.message}`);
    },
  });
}

/**
 * 급여 삭제 뮤테이션 훅
 */
export function useDeleteSalary() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => salariesAPI.deleteSalary(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['salaries'] });
      toast.success('급여가 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`급여 삭제 실패: ${error.message}`);
    },
  });
}
