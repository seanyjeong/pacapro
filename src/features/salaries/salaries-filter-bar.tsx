import { CheckCircle, ChevronLeft, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Instructor } from '@/lib/types/instructor';
import { PAYMENT_STATUS_OPTIONS, type SalaryFilters } from '@/lib/types/salary';

interface SalariesFilterBarProps {
  filters: SalaryFilters;
  instructors: Instructor[];
  pendingCount: number;
  bulkPaying: boolean;
  onFilterChange: (filters: Partial<SalaryFilters>) => void;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onDefaultMonth: () => void;
  onBulkPay: () => void;
}

export function SalariesFilterBar({
  filters,
  instructors,
  pendingCount,
  bulkPaying,
  onFilterChange,
  onPrevMonth,
  onNextMonth,
  onDefaultMonth,
  onBulkPay,
}: SalariesFilterBarProps) {
  return (
    <section className="rounded-md border border-border bg-card p-4 shadow-none" aria-label="급여 필터">
      <div className="grid gap-2 lg:grid-cols-[minmax(150px,auto)_minmax(150px,auto)_auto_auto_auto] lg:items-center">
        <select
          aria-label="강사"
          value={filters.instructor_id || ''}
          onChange={(event) => onFilterChange({ instructor_id: event.target.value ? Number(event.target.value) : undefined })}
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
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
          className="h-10 w-full rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
        >
          <option value="">지급 상태 전체</option>
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <div className="flex w-full items-center gap-1" aria-label="급여 월 이동">
          <Button type="button" variant="outline" size="sm" onClick={onPrevMonth} aria-label="이전 월">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <div
            aria-label="조회 월"
            className="flex h-9 min-w-[118px] flex-1 items-center justify-center rounded-md border border-border bg-muted/35 px-3 text-sm font-medium text-foreground sm:flex-none"
          >
            {filters.year && filters.month ? `${filters.year}년 ${filters.month}월` : '전체'}
          </div>
          <Button type="button" variant="outline" size="sm" onClick={onNextMonth} aria-label="다음 월">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <Button type="button" variant="outline" onClick={onDefaultMonth} className="w-full">
          오늘 기준
        </Button>
        <Button type="button" onClick={onBulkPay} disabled={bulkPaying || pendingCount === 0} className="w-full whitespace-nowrap">
          <CheckCircle className="mr-2 h-4 w-4" />
          {bulkPaying ? '처리 중' : `모두 지급처리 (${pendingCount}건)`}
        </Button>
      </div>
    </section>
  );
}
