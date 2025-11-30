/**
 * Custom Hooks for Instructor Management
 * 강사 관리 커스텀 훅
 */

import { useState, useEffect } from 'react';
import { instructorsAPI } from '@/lib/api/instructors';
import type {
  Instructor,
  InstructorFilters,
  InstructorDetail,
  InstructorAttendance,
  SalaryRecord,
} from '@/lib/types/instructor';

/**
 * 강사 목록 관리 훅
 */
export function useInstructors(initialFilters?: InstructorFilters) {
  const [instructors, setInstructors] = useState<Instructor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<InstructorFilters>(initialFilters || {});

  const loadInstructors = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await instructorsAPI.getInstructors(filters);
      setInstructors(data.instructors);
    } catch (err: any) {
      console.error('Failed to load instructors:', err);
      setError(err.response?.data?.message || '강사 목록을 불러오는데 실패했습니다.');
      setInstructors([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadInstructors();
  }, [JSON.stringify(filters)]);

  const updateFilters = (newFilters: Partial<InstructorFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({});
  };

  return {
    instructors,
    loading,
    error,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    reload: loadInstructors,
  };
}

/**
 * 강사 상세 정보 관리 훅
 */
export function useInstructor(id: number) {
  const [instructor, setInstructor] = useState<InstructorDetail | null>(null);
  const [attendances, setAttendances] = useState<InstructorAttendance[]>([]);
  const [salaries, setSalaries] = useState<SalaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInstructor = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await instructorsAPI.getInstructor(id);
      setInstructor(data.instructor);
      setAttendances(data.attendances || []);
      setSalaries(data.salaries || []);
    } catch (err: any) {
      console.error('Failed to load instructor:', err);
      setError(err.response?.data?.message || '강사 정보를 불러오는데 실패했습니다.');
      setInstructor(null);
      setAttendances([]);
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadInstructor();
    }
  }, [id]);

  return {
    instructor,
    attendances,
    salaries,
    loading,
    error,
    reload: loadInstructor,
  };
}
