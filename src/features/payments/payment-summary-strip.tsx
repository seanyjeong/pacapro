import { AlertCircle, Banknote, CheckCircle2, Percent } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { PaymentFilters } from '@/lib/types/payment';
import { cn } from '@/lib/utils/cn';
import type { PaymentSummary } from './payments-types';

interface PaymentSummaryStripProps {
  summary: PaymentSummary;
  viewOnly: boolean;
  isOwner: boolean;
  filters: PaymentFilters;
  onFilterChange: (filters: Partial<PaymentFilters>) => void;
}

const selectedTile = 'ring-2 ring-primary/40';

export function PaymentSummaryStrip({ summary, viewOnly, isOwner, filters, onFilterChange }: PaymentSummaryStripProps) {
  if (viewOnly) {
    return (
      <section className="grid grid-cols-2 gap-3" aria-label="미납 요약">
        <StatTile label="미납 건수" value={`${summary.filteredCount}건`} tone="danger" icon={AlertCircle} />
        <StatTile
          label="미납 금액"
          value={<span className="text-[20px] sm:text-[26px]">{summary.unpaidAmount.toLocaleString()}원</span>}
          tone="danger"
          icon={Banknote}
        />
      </section>
    );
  }

  const allSelected = !filters.payment_status;
  const unpaidSelected = filters.payment_status === 'pending';

  // 총 청구·미납 칸을 누르면 표 필터가 바뀐다(옛 수납 작업 보드의 숫자 칸과 같은 동작).
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="학원비 요약">
      <div className="min-w-0" data-testid="payments-metric-total">
        <StatTile
          className={cn('flex h-full w-full flex-col', allSelected && selectedTile)}
          label="총 청구"
          value={`${summary.filteredCount}건`}
          tone="primary"
          icon={Banknote}
          onClick={() => onFilterChange({ payment_status: undefined })}
        />
      </div>
      <StatTile label="완납" value={`${summary.paidCount}건`} tone="success" icon={CheckCircle2} />
      <div className="min-w-0" data-testid="payments-metric-unpaid">
        <StatTile
          className={cn('flex h-full w-full flex-col', unpaidSelected && selectedTile)}
          label="미납"
          value={`${summary.unpaidCount}건`}
          note={summary.previousUnpaidPayments.length > 0
            ? <span data-testid="payments-metric-previous">전달 미납 {summary.previousUnpaidPayments.length}건</span>
            : undefined}
          tone="danger"
          icon={AlertCircle}
          onClick={() => onFilterChange({ payment_status: 'pending' })}
        />
      </div>
      <div className="min-w-0" data-testid="payments-metric-rate">
        <StatTile
          className="h-full"
          label="납부율"
          value={`${summary.paidRate}%`}
          note={isOwner ? `${summary.paidAmount.toLocaleString()} / ${summary.totalAmount.toLocaleString()}원` : undefined}
          icon={Percent}
        />
      </div>
    </section>
  );
}
