/**
 * Student Filters Component
 * 학생 필터 컴포넌트 - 학생 유형, 학년, 입시유형 필터 (본문 카드 맨 위 한 줄)
 */

import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { nativeSelectClass } from '@/features/students/student-status-badge';
import { cn } from '@/lib/utils/cn';
import type { StudentFilters, StudentType, Grade, AdmissionType, StudentStatus, Gender } from '@/lib/types/student';
import {
  STUDENT_TYPE_OPTIONS,
  GRADE_OPTIONS,
  ADMISSION_TYPE_OPTIONS,
  STATUS_OPTIONS,
  GENDER_OPTIONS,
} from '@/lib/types/student';

interface StudentFiltersComponentProps {
  filters: StudentFilters;
  onFilterChange: (filters: StudentFilters) => void;
  onReset: () => void;
  hideStatusFilter?: boolean; // 탭에서 status를 관리할 때 status 필터 숨김
}

function FilterSelect({ label, value, options, onChange }: {
  label: string;
  value: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  onChange: (value: string) => void;
}) {
  return (
    <label className="min-w-0 sm:w-36">
      <span className="sr-only">{label}</span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={cn(nativeSelectClass, value && 'bg-primary-soft font-semibold text-primary')}
      >
        <option value="">{label} 전체</option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  );
}

export function StudentFiltersComponent({
  filters,
  onFilterChange,
  onReset,
  hideStatusFilter = false,
}: StudentFiltersComponentProps) {
  const handleChange = (key: keyof StudentFilters, value: unknown) => {
    onFilterChange({
      ...filters,
      [key]: value,
    });
  };

  // 탭에서 status를 관리하면 status는 활성 필터로 취급 안 함
  const hasActiveFilters =
    filters.student_type || filters.grade || filters.admission_type || filters.gender || (!hideStatusFilter && filters.status);

  return (
    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap sm:items-center">
      <FilterSelect
        label="학생 유형"
        value={filters.student_type || ''}
        options={STUDENT_TYPE_OPTIONS}
        onChange={(value) => handleChange('student_type', value as StudentType || undefined)}
      />
      <FilterSelect
        label="학년"
        value={filters.grade || ''}
        options={GRADE_OPTIONS}
        onChange={(value) => handleChange('grade', value as Grade || undefined)}
      />
      <FilterSelect
        label="입시유형"
        value={filters.admission_type || ''}
        options={ADMISSION_TYPE_OPTIONS}
        onChange={(value) => handleChange('admission_type', value as AdmissionType || undefined)}
      />
      <FilterSelect
        label="성별"
        value={filters.gender || ''}
        options={GENDER_OPTIONS}
        onChange={(value) => handleChange('gender', value as Gender || undefined)}
      />
      {/* 상태 - hideStatusFilter가 true면 숨김 (탭에서 관리) */}
      {!hideStatusFilter && (
        <FilterSelect
          label="상태"
          value={filters.status || ''}
          options={STATUS_OPTIONS}
          onChange={(value) => handleChange('status', value as StudentStatus || undefined)}
        />
      )}
      {hasActiveFilters && (
        <Button variant="ghost" className="col-span-2 sm:col-span-1" onClick={onReset}>
          <X className="h-4 w-4" />
          초기화
        </Button>
      )}
    </div>
  );
}
