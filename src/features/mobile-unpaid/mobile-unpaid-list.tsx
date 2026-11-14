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
          <div key={key} className="h-36 animate-pulse rounded-lg border border-border bg-card" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-destructive/30 bg-destructive-soft p-4 text-destructive">
        <p className="text-sm font-medium">{error}</p>
        <Button variant="outline" className="mt-3 w-full border-destructive/30 bg-card" onClick={onRetry}>
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
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-12 text-center">
        <CreditCard className="mx-auto h-10 w-10 text-muted-foreground" />
        <p className="mt-3 text-sm font-medium text-secondary-foreground">
          {emptyMessage}
        </p>
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border bg-card px-4 py-10 text-center">
        <p className="text-sm font-medium text-secondary-foreground">검색 결과가 없습니다.</p>
        <p className="mt-1 text-xs text-muted-foreground">학생명, 연락처, 수납 월을 다시 확인해주세요.</p>
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
