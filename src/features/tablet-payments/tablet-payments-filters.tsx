'use client';

import { ChevronLeft, ChevronRight, RotateCcw, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { PaymentFilters } from '@/lib/types/payment';
import { formatKoreanYearMonth } from './tablet-payments-utils';

const STATUS_FILTERS = [
  { label: '전체', value: undefined },
  { label: '미납', value: 'pending' },
  { label: '부분납부', value: 'partial' },
  { label: '완납', value: 'paid' },
] as const;

interface TabletPaymentsFiltersProps {
  filters: PaymentFilters;
  onChangeMonth: (delta: number) => void;
  onFilterChange: (filters: Partial<PaymentFilters>) => void;
  onReload: () => void;
}

export function TabletPaymentsFilters({
  filters,
  onChangeMonth,
  onFilterChange,
  onReload,
}: TabletPaymentsFiltersProps) {
  return (
    <section className="rounded-md border border-border bg-background p-3 shadow-none" aria-label="결제 필터">
      <div className="grid gap-3 lg:grid-cols-[220px_minmax(240px,1fr)_auto] lg:items-center">
        <div className="flex items-center justify-between rounded-md border border-border bg-muted/30 px-2 py-1.5">
          <Button variant="ghost" size="icon" onClick={() => onChangeMonth(-1)} aria-label="이전 달">
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm font-semibold text-foreground">{formatKoreanYearMonth(filters)}</span>
          <Button variant="ghost" size="icon" onClick={() => onChangeMonth(1)} aria-label="다음 달">
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            aria-label="학생 이름 검색"
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-9 text-sm text-foreground outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            placeholder="학생 이름 검색"
            value={filters.search || ''}
            onChange={(event) => onFilterChange({ search: event.target.value })}
          />
          {filters.search ? (
            <button
              type="button"
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              onClick={() => onFilterChange({ search: undefined })}
              aria-label="검색어 지우기"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>

        <Button variant="outline" onClick={onReload} className="gap-2">
          <RotateCcw className="h-4 w-4" />
          새로고침
        </Button>
      </div>

      <div className="mt-3 flex flex-wrap gap-2" aria-label="납부 상태">
        {STATUS_FILTERS.map((option) => {
          const active = filters.payment_status === option.value;
          return (
            <Button
              key={option.label}
              type="button"
              size="sm"
              variant={active ? 'default' : 'outline'}
              onClick={() => onFilterChange({ payment_status: option.value })}
              className="min-w-16"
            >
              {option.label}
            </Button>
          );
        })}
      </div>
    </section>
  );
}
