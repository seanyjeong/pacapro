'use client';

import { ChevronLeft, ChevronRight, Search, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
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
}

/** 결제 표 카드 맨 위 필터 줄(`PaymentList` toolbar 자리) */
export function TabletPaymentsFilters({
  filters,
  onChangeMonth,
  onFilterChange,
}: TabletPaymentsFiltersProps) {
  return (
    <div className="flex flex-wrap items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-5" role="search" aria-label="결제 필터">
      <div className="flex h-11 shrink-0 items-center gap-1 rounded-xl bg-muted px-1">
        <Button variant="ghost" size="icon-sm" onClick={() => onChangeMonth(-1)} aria-label="이전 달">
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <span className="min-w-[96px] text-center text-[15px] font-bold text-foreground tabular-nums">{formatKoreanYearMonth(filters)}</span>
        <Button variant="ghost" size="icon-sm" onClick={() => onChangeMonth(1)} aria-label="다음 달">
          <ChevronRight className="h-4 w-4" />
        </Button>
      </div>

      <div className="relative min-w-[200px] flex-1">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          aria-label="학생 이름 검색"
          className="pl-10 pr-10"
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

      <div className="flex flex-wrap gap-1.5" role="group" aria-label="납부 상태">
        {STATUS_FILTERS.map((option) => {
          const active = filters.payment_status === option.value;
          return (
            <button
              key={option.label}
              type="button"
              aria-pressed={active}
              onClick={() => onFilterChange({ payment_status: option.value })}
              className={cn(
                'inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors',
                active ? 'bg-foreground text-background' : 'bg-muted text-secondary-foreground hover:text-foreground'
              )}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
