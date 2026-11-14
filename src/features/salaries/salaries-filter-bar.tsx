import { ChevronLeft, ChevronRight, RotateCcw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Instructor } from '@/lib/types/instructor';
import { PAYMENT_STATUS_OPTIONS, type SalaryFilters } from '@/lib/types/salary';

const FIELD_CLASS =
  'h-11 rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10';

interface SalariesFilterBarProps {
  filters: SalaryFilters;
  instructors: Instructor[];
  onFilterChange: (filters: Partial<SalaryFilters>) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDefaultMonth: () => void;
}

export function SalariesFilterBar({
  filters,
  instructors,
  onFilterChange,
  onPrevMonth,
  onNextMonth,
  onDefaultMonth,
}: SalariesFilterBarProps) {
  return (
    <div className="flex flex-wrap items-center gap-2" role="group" aria-label="급여 필터">
      <div className="flex w-full items-center gap-1 sm:w-auto" aria-label="급여 월 이동">
        <Button type="button" variant="outline" size="icon" onClick={onPrevMonth} aria-label="이전 월">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <div
          aria-label="조회 월"
          className="flex h-11 min-w-[124px] flex-1 items-center justify-center rounded-xl bg-muted px-3 text-[15px] font-bold tabular-nums text-foreground sm:flex-none"
        >
          {filters.year && filters.month ? `${filters.year}년 ${filters.month}월` : '전체'}
        </div>
        <Button type="button" variant="outline" size="icon" onClick={onNextMonth} aria-label="다음 월">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <select
        aria-label="강사"
        value={filters.instructor_id || ''}
        onChange={(event) => onFilterChange({ instructor_id: event.target.value ? Number(event.target.value) : undefined })}
        className={`${FIELD_CLASS} min-w-0 flex-1 sm:w-44 sm:flex-none`}
      >
        <option value="">강사 전체</option>
        {instructors.map((instructor) => (
          <option key={instructor.id} value={instructor.id}>
            {instructor.name}
          </option>
        ))}
      </select>

      <select
        aria-label="지급 상태"
        value={filters.payment_status || ''}
        onChange={(event) => onFilterChange({ payment_status: (event.target.value || undefined) as SalaryFilters['payment_status'] })}
        className={`${FIELD_CLASS} min-w-0 flex-1 sm:w-40 sm:flex-none`}
      >
        <option value="">지급 상태 전체</option>
        {PAYMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      <Button type="button" variant="outline" onClick={onDefaultMonth}>
        <RotateCcw className="h-4 w-4" />
        오늘 기준
      </Button>
    </div>
  );
}
