/**
 * Custom Hooks for Salary Management
 * 급여 관리 커스텀 훅
 */

import { useState, useEffect } from 'react';
import { salariesAPI } from '@/lib/api/salaries';
import type { Salary, SalaryDetail, SalaryFilters } from '@/lib/types/salary';

/**
 * 급여 목록 관리 훅
 * @param initialFilters 초기 필터 값
 */
export function useSalaries(initialFilters?: SalaryFilters) {
  const [salaries, setSalaries] = useState<Salary[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filters, setFilters] = useState<SalaryFilters>(initialFilters || {});

  const loadSalaries = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await salariesAPI.getSalaries(filters);
      setSalaries(data.salaries);
    } catch (err: any) {
      console.error('Failed to load salaries:', err);
      setError(err.response?.data?.message || '급여 목록을 불러오는데 실패했습니다.');
      setSalaries([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSalaries();
  }, [JSON.stringify(filters)]);

  const updateFilters = (newFilters: Partial<SalaryFilters>) => {
    setFilters((prev) => ({ ...prev, ...newFilters }));
  };

  const resetFilters = () => {
    setFilters({});
  };

  return {
    salaries,
    loading,
    error,
    filters,
    setFilters,
    updateFilters,
    resetFilters,
    reload: loadSalaries,
  };
}

/**
 * 급여 상세 정보 관리 훅
 * @param id 급여 ID
 */
export function useSalary(id: number) {
  const [salary, setSalary] = useState<SalaryDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadSalary = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await salariesAPI.getSalary(id);
      setSalary(data.salary);
    } catch (err: any) {
      console.error('Failed to load salary:', err);
      setError(err.response?.data?.message || '급여 정보를 불러오는데 실패했습니다.');
      setSalary(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadSalary();
    }
  }, [id]);

  return {
    salary,
    loading,
    error,
    reload: loadSalary,
  };
}
