'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { ManualCreditModal } from '@/components/students/manual-credit-modal';
import { PaymentList } from '@/components/payments/payment-list';
import { ProrationCalculatorModal } from '@/components/payments/proration-calculator-modal';
import { usePermissions } from '@/lib/utils/permissions';
import { PaymentFilterBar } from './payment-filter-bar';
import { PaymentPageError } from './payment-page-error';
import { PaymentsHeader } from './payments-header';
import { PaymentSummaryStrip } from './payment-summary-strip';
import { usePaymentsPageState } from './use-payments-page-state';

export function PaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { canEdit, canView, isOwner } = usePermissions();
  const canEditPayments = canEdit('payments');
  const canViewPayments = canView('payments');
  const viewOnly = canViewPayments && !canEditPayments;
  const state = usePaymentsPageState({ statusFromUrl: searchParams.get('status'), viewOnly });

  if (state.error && !state.loading) {
    return <PaymentPageError viewOnly={viewOnly} message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full max-w-7xl space-y-5">
      <PaymentsHeader
        viewOnly={viewOnly}
        canEdit={canEditPayments}
        sendingNotification={state.sendingNotification}
        unpaidCount={state.summary.unpaidCount}
        onOpenCalculator={() => state.setCalculatorOpen(true)}
        onReload={state.reload}
        onSendUnpaid={state.sendUnpaid}
        onAddPayment={() => router.push('/payments/new')}
      />

      <PaymentSummaryStrip summary={state.summary} viewOnly={viewOnly} isOwner={isOwner} />

      <PaymentFilterBar
        filters={state.filters}
        todayUnpaidOnly={state.todayUnpaidOnly}
        onFilterChange={state.updateFilters}
        onTodayUnpaidToggle={() => state.setTodayUnpaidOnly(!state.todayUnpaidOnly)}
        onReset={state.resetPageFilters}
      />

      <PaymentList
        payments={state.filteredPayments}
        loading={state.loading}
        onPaymentClick={(id) => router.push(`/payments/${id}`)}
        onCreditClick={canEditPayments ? state.openCreditModal : undefined}
        showCreditButton={canEditPayments}
        onPaymentMark={canEditPayments ? state.markPayment : undefined}
        showPaymentMarkButton={canEditPayments}
        markingPaymentId={state.markingPaymentId}
        confirmBeforePayment
      />

      <ProrationCalculatorModal open={state.calculatorOpen} onClose={() => state.setCalculatorOpen(false)} />

      {state.creditStudentInfo ? (
        <ManualCreditModal
          open={state.creditModalOpen}
          onClose={() => {
            state.setCreditModalOpen(false);
            state.setCreditStudentInfo(null);
          }}
          studentId={state.creditStudentInfo.studentId}
          studentName={state.creditStudentInfo.studentName}
          monthlyTuition={state.creditStudentInfo.monthlyTuition}
          weeklyCount={state.creditStudentInfo.weeklyCount}
          classDays={state.creditStudentInfo.classDays}
          onSuccess={state.reload}
        />
      ) : null}
    </div>
  );
}
