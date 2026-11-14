/**
 * Instructor Filters Component
 * 강사 필터 컴포넌트
 */

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
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

  const fields: { key: keyof InstructorFilters; label: string; options: ReadonlyArray<{ value: string; label: string }> }[] = [
    { key: 'salary_type', label: '급여타입', options: SALARY_TYPE_OPTIONS },
    { key: 'instructor_type', label: '강사 유형', options: INSTRUCTOR_TYPE_OPTIONS },
    { key: 'gender', label: '성별', options: GENDER_OPTIONS },
    { key: 'status', label: '상태', options: INSTRUCTOR_STATUS_OPTIONS },
  ];

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      {fields.map((field) => {
        const value = (filters[field.key] as string | undefined) || '';
        return (
          <label key={field.key} className="min-w-0 sm:w-36">
            <span className="sr-only">{field.label}</span>
            <select
              value={value}
              onChange={(e) => handleChange(field.key, e.target.value || undefined)}
              className={cn(
                'h-11 w-full rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground focus:border-primary focus:bg-card focus:outline-none focus:ring-4 focus:ring-primary/10',
                value && 'bg-primary-soft font-semibold text-primary'
              )}
            >
              <option value="">{field.label} 전체</option>
              {field.options.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
        );
      })}
      {hasActiveFilters && (
        <Button variant="ghost" className="col-span-2 sm:col-span-1" onClick={onReset}>
          <X className="h-4 w-4" />
          초기화
        </Button>
      )}
    </div>
  );
}
