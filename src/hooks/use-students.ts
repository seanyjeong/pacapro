/**
 * Custom Hooks for Student Management
 * 학생 관리 커스텀 훅
 */

import { useState, useEffect } from 'react';
import { studentsAPI } from '@/lib/api/students';
import type {
  Student,
  StudentFilters,
  StudentDetail,
  StudentPerformance,
  StudentPayment,
} from '@/lib/types/student';

/**
 * 학생 목록 관리 훅
 * @param initialFilters 초기 필터 값
 */
export function useStudents(initialFilters?: StudentFilters) {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<StudentFilters>(initialFilters || {});

  const loadStudents = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentsAPI.getStudents(filters);
      setStudents(data.students);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || '학생 목록을 불러오는데 실패했습니다.');
      setStudents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [JSON.stringify(filters)]); // filters 객체 변경 감지

  const updateFilters = (newFilters: Partial<StudentFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({});
  };

  return {
    students,
    loading,
    error,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    reload: loadStudents,
  };
}

/**
 * 학생 상세 정보 관리 훅
 * @param id 학생 ID
 */
export function useStudent(id: number) {
  const [student, setStudent] = useState<StudentDetail | null>(null);
  const [performances, setPerformances] = useState<StudentPerformance[]>([]);
  const [payments, setPayments] = useState<StudentPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadStudent = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await studentsAPI.getStudent(id);
      setStudent(data.student);
      setPerformances(data.performances || []);
      setPayments(data.payments || []);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || '학생 정보를 불러오는데 실패했습니다.');
      setStudent(null);
      setPerformances([]);
      setPayments([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadStudent();
    }
  }, [id]);

  return {
    student,
    performances,
    payments,
    loading,
    error,
    reload: loadStudent,
  };
}

/**
 * 학생 검색 훅 (자동완성용)
 */
export function useStudentSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<Student[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = async (searchQuery: string) => {
    if (!searchQuery || searchQuery.length < 2) {
      setResults([]);
      return;
    }

    try {
      setLoading(true);
      setError(null);
      const data = await studentsAPI.searchStudents(searchQuery);
      setResults(data.students);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { data?: { message?: string } } };
      setError(axiosErr.response?.data?.message || '학생 검색에 실패했습니다.');
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      search(query);
    }, 300); // 300ms debounce

    return () => clearTimeout(timer);
  }, [query]);

  return {
    query,
    setQuery,
    results,
    loading,
    error,
    search,
  };
}
