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
  GENDER_OPTIONS,
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
  const handleChange = (key: keyof InstructorFilters, value: InstructorFilters[keyof InstructorFilters]) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  const hasActiveFilters = filters.status || filters.salary_type || filters.instructor_type || filters.gender;

  return (
    <Card className="rounded-md">
      <CardContent className="p-4">
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-semibold text-foreground">필터</h3>
          </div>
          {hasActiveFilters && (
            <Button variant="outline" size="sm" className="gap-1" onClick={onReset}>
              <X className="h-4 w-4" />
              초기화
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          {/* 급여타입 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">급여타입</label>
            <select
              value={filters.salary_type || ''}
              onChange={(e) => handleChange('salary_type', e.target.value || undefined)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
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
            <label className="mb-2 block text-xs font-medium text-muted-foreground">강사 유형</label>
            <select
              value={filters.instructor_type || ''}
              onChange={(e) => handleChange('instructor_type', e.target.value || undefined)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">전체</option>
              {INSTRUCTOR_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 성별 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">성별</label>
            <select
              value={filters.gender || ''}
              onChange={(e) => handleChange('gender', e.target.value || undefined)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              <option value="">전체</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>

          {/* 상태 */}
          <div>
            <label className="mb-2 block text-xs font-medium text-muted-foreground">상태</label>
            <select
              value={filters.status || ''}
              onChange={(e) => handleChange('status', e.target.value || undefined)}
              className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary-500"
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
