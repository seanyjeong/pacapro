/**
 * Instructor Filters Component
 * 강사 필터 컴포넌트
 */

import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Filter, X } from 'lucide-react';
import type { InstructorFilters } from '@/lib/types/instructor';
import {
  SALARY_TYPE_OPTIONS,
  INSTRUCTOR_STATUS_OPTIONS,
  INSTRUCTOR_TYPE_OPTIONS,
} from '@/lib/types/instructor';

interface InstructorFiltersComponentProps {
  filters: InstructorFilters;
  onFilterChange: (filters: InstructorFilters) => void;
  onReset: () => void;
}

export function InstructorFiltersComponent({
  filters,
  onFilterChange,
  onReset,
}: InstructorFiltersComponentProps) {
  const handleChange = (key: keyof InstructorFilters, value: any) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const hasActiveFilters = filters.status || filters.salary_type || filters.instructor_type;

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

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* 급여타입 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">급여타입</label>
            <select
              value={filters.salary_type || ''}
              onChange={(e) => handleChange('salary_type', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {SALARY_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 강사 유형 */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">강사 유형</label>
            <select
              value={filters.instructor_type || ''}
              onChange={(e) => handleChange('instructor_type', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {INSTRUCTOR_TYPE_OPTIONS.map((option) => (
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
              onChange={(e) => handleChange('status', e.target.value || undefined)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">전체</option>
              {INSTRUCTOR_STATUS_OPTIONS.map((option) => (
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
