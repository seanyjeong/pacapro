import { Banknote, RotateCcw, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { PAYMENT_STATUS_OPTIONS, PAYMENT_TYPE_OPTIONS, UNPAID_PAYMENT_STATUS_FILTER } from '@/lib/types/payment';
import type { PaymentFilters } from '@/lib/types/payment';
import type { PaymentStatusFilter, PaymentTypeFilter } from './payments-types';

interface PaymentFilterBarProps {
  filters: PaymentFilters;
  todayUnpaidOnly: boolean;
  onFilterChange: (filters: Partial<PaymentFilters>) => void;
  onTodayUnpaidToggle: () => void;
  onReset: () => void;
}

// 네이티브 선택칸을 Input 과 같은 회색 칸 모양으로.
const fieldClass =
  'h-11 min-w-0 rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10';

export function PaymentFilterBar({
  filters,
  todayUnpaidOnly,
  onFilterChange,
  onTodayUnpaidToggle,
  onReset,
}: PaymentFilterBarProps) {
  const selectedMonth = filters.year && filters.month ? `${filters.year}-${String(filters.month).padStart(2, '0')}` : '';

  return (
    <div
      className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-5"
      role="search"
      aria-label="학원비 필터"
      data-testid="payment-filter-bar"
    >
      <div className="relative min-w-0 basis-full sm:basis-auto sm:flex-1 sm:min-w-[200px]">
        <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          aria-label="학생·부모님 이름 검색"
          placeholder="학생·부모님 이름 검색"
          value={filters.search || ''}
          onChange={(event) => onFilterChange({ search: event.target.value || undefined })}
          className="pl-10"
        />
      </div>

      <select
        aria-label="납부 상태"
        value={filters.payment_status || ''}
        onChange={(event) => onFilterChange({ payment_status: (event.target.value || undefined) as PaymentStatusFilter })}
        className={`${fieldClass} flex-1 sm:w-36 sm:flex-none`}
      >
        <option value="">납부 상태 전체</option>
        {PAYMENT_STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
        {/* 미납 칸·대시보드 '미납'으로 들어왔을 때의 필터(미납 + 부분 납부) */}
        <option value={UNPAID_PAYMENT_STATUS_FILTER}>미납·부분납부</option>
      </select>

      <select
        aria-label="청구 유형"
        value={filters.payment_type || ''}
        onChange={(event) => onFilterChange({ payment_type: (event.target.value || undefined) as PaymentTypeFilter })}
        className={`${fieldClass} flex-1 sm:w-36 sm:flex-none`}
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
        className={`${fieldClass} basis-full sm:basis-auto sm:w-40`}
      />

      <div className="flex min-w-0 basis-full items-center gap-2 sm:basis-auto">
        <Button
          type="button"
          variant={todayUnpaidOnly ? 'secondary' : 'outline'}
          aria-pressed={todayUnpaidOnly}
          onClick={onTodayUnpaidToggle}
          className="min-w-0 flex-1 px-3 sm:flex-none"
        >
          <Banknote className="h-4 w-4" />
          <span className="truncate">오늘 수업 미납</span>
        </Button>

        <Button
          type="button"
          variant={filters.early_paid_only ? 'secondary' : 'outline'}
          aria-pressed={Boolean(filters.early_paid_only)}
          onClick={() =>
            onFilterChange({
              early_paid_only: filters.early_paid_only ? undefined : true,
              payment_status: filters.early_paid_only ? undefined : 'paid',
            })
          }
          className="min-w-0 flex-1 px-3 sm:flex-none"
          data-testid="payment-filter-early-paid"
        >
          <Banknote className="h-4 w-4" />
          <span className="truncate">미리 납부</span>
        </Button>

        <Button type="button" variant="ghost" onClick={onReset} className="shrink-0 px-3" aria-label="초기화" title="초기화" data-testid="payment-filter-reset">
          <RotateCcw className="h-4 w-4" />
          <span className="hidden sm:inline">초기화</span>
        </Button>
      </div>
    </div>
  );
}
