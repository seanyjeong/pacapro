/**
 * Custom Hooks for Student Management
 * 학생 관리 커스텀 훅 - React Query 기반 (backward-compatible interface)
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsAPI } from '@/lib/api/students';
import type {
  Student,
  StudentFilters,
  StudentDetail,
  StudentFormData,
} from '@/lib/types/student';
import { toast } from 'sonner';

const QUERY_KEYS = {
  students: (filters?: StudentFilters) => ['students', filters] as const,
  student: (id: number) => ['students', id] as const,
  search: (query: string) => ['students', 'search', query] as const,
  attendance: (id: number, yearMonth: string) => ['students', id, 'attendance', yearMonth] as const,
};

/**
 * 학생 목록 조회 훅
 */
export function useStudents(initialFilters?: StudentFilters) {
  const [filters, setFilters] = useState<StudentFilters>(initialFilters || {});

  const query = useQuery({
    queryKey: QUERY_KEYS.students(filters),
    queryFn: async () => {
      const data = await studentsAPI.getStudents(filters);
      return data.students as Student[];
    },
  });

  const updateFilters = useCallback((newFilters: Partial<StudentFilters>) => {
    setFilters((prev) => {
      const merged = { ...prev, ...newFilters };
      Object.keys(merged).forEach(key => {
        if (merged[key as keyof StudentFilters] === undefined) {
          delete merged[key as keyof StudentFilters];
        }
      });
      return merged;
    });
  }, []);

  const resetFilters = useCallback(() => {
    setFilters({});
  }, []);

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    students: query.data || [],
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
 * 학생 상세 정보 조회 훅
 */
export function useStudent(id: number) {
  const query = useQuery({
    queryKey: QUERY_KEYS.student(id),
    queryFn: async () => {
      const data = await studentsAPI.getStudent(id);
      return {
        student: data.student as StudentDetail,
        performances: data.performances || [],
        payments: data.payments || [],
      };
    },
    enabled: !!id,
  });

  const reload = useCallback(() => {
    query.refetch();
  }, [query]);

  return {
    student: query.data?.student || null,
    performances: query.data?.performances || [],
    payments: query.data?.payments || [],
    loading: query.isLoading,
    error: query.error?.message || null,
    reload,
  };
}

/**
 * 학생 검색 훅 (자동완성용)
 */
export function useStudentSearch(searchQuery: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.search(searchQuery),
    queryFn: async () => {
      const data = await studentsAPI.searchStudents(searchQuery);
      return data.students as Student[];
    },
    enabled: searchQuery.length >= 2,
    staleTime: 30 * 1000, // 30초 캐시
  });

  return {
    students: query.data || [],
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}

/**
 * 학생 월별 출결 현황 조회 훅
 */
export function useStudentAttendance(studentId: number, yearMonth: string) {
  const query = useQuery({
    queryKey: QUERY_KEYS.attendance(studentId, yearMonth),
    queryFn: () => studentsAPI.getStudentAttendance(studentId, yearMonth),
    enabled: !!studentId && !!yearMonth,
    staleTime: 60 * 1000,
  });

  return {
    data: query.data || null,
    loading: query.isLoading,
    error: query.error?.message || null,
  };
}

/**
 * 학생 등록 뮤테이션 훅
 */
export function useCreateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: StudentFormData) => studentsAPI.createStudent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('학생이 등록되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`학생 등록 실패: ${error.message}`);
    },
  });
}

/**
 * 학생 수정 뮤테이션 훅
 */
export function useUpdateStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ id, data }: { id: number; data: Partial<StudentFormData> }) =>
      studentsAPI.updateStudent(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: QUERY_KEYS.student(variables.id) });
      toast.success('학생 정보가 수정되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`학생 수정 실패: ${error.message}`);
    },
  });
}

/**
 * 학생 삭제 뮤테이션 훅
 */
export function useDeleteStudent() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (id: number) => studentsAPI.deleteStudent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      toast.success('학생이 삭제되었습니다.');
    },
    onError: (error: Error) => {
      toast.error(`학생 삭제 실패: ${error.message}`);
    },
  });
}
