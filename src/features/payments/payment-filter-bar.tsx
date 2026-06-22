import { Banknote, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { PAYMENT_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS } from '@/lib/types/payment';
import type { PaymentFilters } from '@/lib/types/payment';
import type { PaymentStatusFilter, PaymentTypeFilter } from './payments-types';

interface PaymentFilterBarProps {
  filters: PaymentFilters;
  todayUnpaidOnly: boolean;
  onFilterChange: (filters: Partial<PaymentFilters>) => void;
  onTodayUnpaidToggle: () => void;
  onReset: () => void;
}

export function PaymentFilterBar({
  filters,
  todayUnpaidOnly,
  onFilterChange,
  onTodayUnpaidToggle,
  onReset,
}: PaymentFilterBarProps) {
  const selectedMonth = filters.year && filters.month ? `${filters.year}-${String(filters.month).padStart(2, '0')}` : '';

  return (
    <section className="rounded-lg border border-border/70 bg-card p-4 shadow-none" aria-label="학원비 필터">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1 lg:flex-none">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            type="text"
            aria-label="학생 이름 검색"
            placeholder="학생 이름 검색"
            value={filters.search || ''}
            onChange={(event) => onFilterChange({ search: event.target.value || undefined })}
            className="h-10 w-full rounded-md border border-border bg-background pl-9 pr-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
          />
        </div>

        <select
          aria-label="납부 상태"
          value={filters.payment_status || ''}
          onChange={(event) => onFilterChange({ payment_status: (event.target.value || undefined) as PaymentStatusFilter })}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
        >
          <option value="">납부 상태 전체</option>
          {PAYMENT_STATUS_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <select
          aria-label="청구 유형"
          value={filters.payment_type || ''}
          onChange={(event) => onFilterChange({ payment_type: (event.target.value || undefined) as PaymentTypeFilter })}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
        >
          <option value="">청구 유형 전체</option>
          {PAYMENT_TYPE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>

        <input
          type="month"
          aria-label="청구 월"
          value={selectedMonth}
          onChange={(event) => {
            const [year, month] = event.target.value.split('-');
            onFilterChange({ year: Number(year), month: Number(month) });
          }}
          className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground outline-none focus:ring-2 focus:ring-ring/25"
        />

        <Button type="button" variant={todayUnpaidOnly ? 'default' : 'outline'} onClick={onTodayUnpaidToggle}>
          <Banknote className="mr-1.5 h-4 w-4" />
          오늘 수업 미납자
        </Button>

        <Button type="button" variant="outline" onClick={onReset} className="lg:ml-auto">
          필터 초기화
        </Button>
      </div>
    </section>
  );
}
