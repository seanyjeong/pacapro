import type { ReactNode } from 'react';
import { AlertCircle, Banknote, CheckCircle, WalletCards } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { SalaryFilters } from '@/lib/types/salary';
import { cn } from '@/lib/utils/cn';
import type { SalarySummary } from './salaries-page-types';
import { formatWon } from './salaries-page-utils';

interface SalariesSummaryStripProps {
  summary: SalarySummary;
  filters: SalaryFilters;
  onFilterChange: (filters: Partial<SalaryFilters>) => void;
}

export function SalariesSummaryStrip({ summary, filters, onFilterChange }: SalariesSummaryStripProps) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="급여 요약">
      <Tile testId="salaries-metric-total" selected={!filters.payment_status}>
        <StatTile
          className="flex h-full w-full flex-col"
          label="전체"
          value={`${summary.totalCount}건`}
          note="선택 월 기준"
          icon={Banknote}
          tone="primary"
          onClick={() => onFilterChange({ payment_status: undefined })}
        />
      </Tile>
      <Tile testId="salaries-metric-pending" selected={filters.payment_status === 'pending'}>
        <StatTile
          className="flex h-full w-full flex-col"
          label="지급 대기"
          value={`${summary.pendingCount}건`}
          note={<span data-testid="salaries-metric-unpaid">미지급 {formatWon(summary.totalUnpaid)}</span>}
          icon={AlertCircle}
          tone="warning"
          onClick={() => onFilterChange({ payment_status: 'pending' })}
        />
      </Tile>
      <Tile testId="salaries-metric-paid" selected={filters.payment_status === 'paid'}>
        <StatTile
          className="flex h-full w-full flex-col"
          label="지급 완료"
          value={`${summary.paidCount}건`}
          icon={CheckCircle}
          tone="success"
          onClick={() => onFilterChange({ payment_status: 'paid' })}
        />
      </Tile>
      <StatTile label="총 지급액" value={formatWon(summary.totalPaid)} note="지급 완료 기준" icon={WalletCards} />
    </section>
  );
}

function Tile({ testId, selected, children }: { testId: string; selected: boolean; children: ReactNode }) {
  return (
    <div data-testid={testId} data-selected={selected} className={cn('min-w-0 rounded-2xl', selected && 'ring-2 ring-primary/40')}>
      {children}
    </div>
  );
}
