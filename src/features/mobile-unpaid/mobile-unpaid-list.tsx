import { CreditCard } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { UnpaidPayment } from '@/lib/types/payment';
import { MobileUnpaidCard } from './mobile-unpaid-card';
import { formatYearMonthLabel } from './mobile-unpaid-month.mjs';
import type { MobileUnpaidScope } from './mobile-unpaid-types';

interface MobileUnpaidListProps {
  canMarkPaid: boolean;
  canViewAmount: boolean;
  dayName: string;
  error: string | null;
  loading: boolean;
  payments: UnpaidPayment[];
  processing: boolean;
  query: string;
  scope: MobileUnpaidScope;
  selectedMonth: string;
  totalCount: number;
  onCall: (payment: UnpaidPayment) => void;
  onPay: (payment: UnpaidPayment) => void;
  onRetry: () => void;
}

export function MobileUnpaidList({
  canMarkPaid,
  canViewAmount,
  dayName,
  error,
  loading,
  payments,
  processing,
  query,
  scope,
  selectedMonth,
  totalCount,
  onCall,
  onPay,
  onRetry,
}: MobileUnpaidListProps) {
  if (loading) {
    return (
      <div className="space-y-3" data-testid="mobile-unpaid-loading">
        {[0, 1, 2].map((key) => (
          <div key={key} className="h-36 animate-pulse rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-rose-800 dark:border-rose-900 dark:bg-rose-950/40 dark:text-rose-200">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 w-full border-rose-200 bg-white dark:border-rose-800 dark:bg-zinc-950" onClick={onRetry}>
          다시 불러오기
        </Button>
      </div>
    );
  }

  if (totalCount === 0) {
    const emptyMessage = scope === 'month'
      ? `${formatYearMonthLabel(selectedMonth)} 전체 미납자가 없습니다.`
      : dayName
        ? `오늘(${dayName}요일) 수업 학생 중 미납자가 없습니다.`
        : '오늘 수업 미납자가 없습니다.';

    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-12 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <CreditCard className="mx-auto h-10 w-10 text-zinc-400" />
        <p className="mt-3 text-sm font-medium text-zinc-700 dark:text-zinc-300">
          {emptyMessage}
        </p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-zinc-300 bg-white px-4 py-10 text-center dark:border-zinc-700 dark:bg-zinc-950">
        <p className="text-sm font-medium text-zinc-700 dark:text-zinc-300">검색 결과가 없습니다.</p>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">학생명, 연락처, 수납 월을 다시 확인해주세요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-3" aria-label={query ? '검색된 미납자 목록' : '미납자 목록'}>
      {payments.map((payment) => (
        <MobileUnpaidCard
          key={payment.id}
          canMarkPaid={canMarkPaid}
          canViewAmount={canViewAmount}
          payment={payment}
          processing={processing}
          onCall={onCall}
          onPay={onPay}
        />
      ))}
    </div>
  );
}
