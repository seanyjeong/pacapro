import { CreditCard, SearchX } from 'lucide-react';
import { EmptyState } from '@/components/ui/page';
import { MobileErrorCard, MobileSkeleton } from '../mobile-home/mobile-screen';
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
    return <MobileSkeleton className="h-36" testId="mobile-unpaid-loading" />;
  }

  if (error) {
    return <MobileErrorCard message={error} onRetry={onRetry} />;
  }

  if (totalCount === 0) {
    const emptyMessage = scope === 'month'
      ? `${formatYearMonthLabel(selectedMonth)} 전체 미납자가 없어요.`
      : dayName
        ? `오늘(${dayName}요일) 수업 학생 중 미납자가 없어요.`
        : '오늘 수업 미납자가 없어요.';

    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={CreditCard} title={emptyMessage} />
      </div>
    );
  }

  if (payments.length === 0) {
    return (
      <div className="rounded-2xl bg-card">
        <EmptyState icon={SearchX} title="검색 결과가 없어요" description="학생명, 연락처, 수납 월을 다시 확인해 주세요." />
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
