/**
 * Student Filters Component
 * 학생 필터 컴포넌트 - 학생 유형, 학년, 입시유형 필터
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';
import type { StudentFilters, StudentType, Grade, AdmissionType, StudentStatus } from '@/lib/types/student';
import {
  STUDENT_TYPE_OPTIONS,
  GRADE_OPTIONS,
  ADMISSION_TYPE_OPTIONS,
  STATUS_OPTIONS,
} from '@/lib/types/student';

interface StudentFiltersComponentProps {
  filters: StudentFilters;
  onFilterChange: (filters: StudentFilters) => void;
  onReset: () => void;
}

export function StudentFiltersComponent({
  filters,
  onFilterChange,
  onReset,
}: StudentFiltersComponentProps) {
  const handleChange = (key: keyof StudentFilters, value: unknown) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const hasActiveFilters =
    filters.student_type || filters.grade || filters.admission_type || filters.status;

  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="w-4 h-4 text-gray-600" />
            <h3 className="text-sm font-semibold text-gray-900">필터</h3>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" onClick={onReset}>
              <X className="w-4 h-4 mr-1" />
              초기화
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {/* 학생 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">학생 유형</label>
            <select
              value={filters.student_type || ''}
              onChange={(e) => handleChange('student_type', e.target.value as StudentType || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {STUDENT_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 학년 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">학년</label>
            <select
              value={filters.grade || ''}
              onChange={(e) => handleChange('grade', e.target.value as Grade || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {GRADE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 입시유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">입시유형</label>
            <select
              value={filters.admission_type || ''}
              onChange={(e) => handleChange('admission_type', e.target.value as AdmissionType || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {ADMISSION_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 상태 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">상태</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleChange('status', e.target.value as StudentStatus || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
