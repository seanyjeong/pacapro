'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { PaymentList } from '@/components/payments/payment-list';
import { TabletPaymentsError } from './tablet-payments-error';
import { TabletPaymentsFilters } from './tablet-payments-filters';
import { TabletPaymentsHeader } from './tablet-payments-header';
import { TabletPaymentsSummary } from './tablet-payments-summary';
import { useTabletPaymentsState } from './use-tablet-payments-state';

export function TabletPaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const state = useTabletPaymentsState({
    studentIdParam: searchParams.get('studentId'),
    statusFromUrl: searchParams.get('status'),
  });

  if (state.error && !state.loading) {
    return <TabletPaymentsError message={state.error} detail={state.errorDetail} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-4 pb-24 lg:pb-0">
      <TabletPaymentsHeader
        selectedYearMonth={state.selectedYearMonth}
        studentId={state.studentId}
        studentName={state.studentName}
        visibleCount={state.visiblePayments.length}
      />

      <TabletPaymentsSummary summary={state.summary} />

      <TabletPaymentsFilters
        filters={state.filters}
        onChangeMonth={state.changeMonth}
        onFilterChange={state.updateFilters}
        onReload={state.reload}
      />

      <PaymentList
        payments={state.visiblePayments}
        loading={state.loading}
        onPaymentClick={(id) => router.push(`/payments/${id}`)}
        showPaymentMarkButton
        onPaymentMark={state.markPayment}
        markingPaymentId={state.markingPaymentId}
        hideDueDate
        confirmBeforePayment
      />
    </div>
  );
}
