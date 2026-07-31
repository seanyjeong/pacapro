'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { ManualCreditModal } from '@/components/students/manual-credit-modal';
import { PaymentList } from '@/components/payments/payment-list';
import { PaymentRecordModal } from '@/components/payments/payment-record-modal';
import { ProrationCalculatorModal } from '@/components/payments/proration-calculator-modal';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import type { Payment, PaymentRecordData } from '@/lib/types/payment';
import { getPaidPaymentAmount } from '@/lib/utils/payment-helpers';
import { usePermissions } from '@/lib/utils/permissions';
import { recordQuickPayment } from './payments-page-api';
import { PaymentFilterBar } from './payment-filter-bar';
import { PaymentPageError } from './payment-page-error';
import { PaymentsHeader } from './payments-header';
import { PaymentsOperationsBoard } from './payments-operations-board';
import { PaymentSummaryStrip } from './payment-summary-strip';
import { usePaymentsPageState } from './use-payments-page-state';

export function PaymentsPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [unpaidDialogOpen, setUnpaidDialogOpen] = useState(false);
  const [recordPayment, setRecordPayment] = useState<Payment | null>(null);
  const { canEdit, canView, isOwner } = usePermissions();
  const canEditPayments = canEdit('payments');
  const canViewPayments = canView('payments');
  const viewOnly = canViewPayments && !canEditPayments;
  const state = usePaymentsPageState({ statusFromUrl: searchParams.get('status'), viewOnly });

  const submitDetailedPayment = async (data: {
    paid_amount: number;
    payment_method: string;
    payment_date: string;
    discount_amount?: number;
  }) => {
    if (!recordPayment) return;
    try {
      await recordQuickPayment(recordPayment.id, {
        paid_amount: data.paid_amount,
        payment_method: data.payment_method as PaymentRecordData['payment_method'],
        payment_date: data.payment_date,
        discount_amount: data.discount_amount,
        notes: '상세 납부 기록',
      });
      toast.success(`${recordPayment.student_name}님의 납부 기록이 저장되었습니다.`);
      setRecordPayment(null);
      await state.reload();
    } catch {
      toast.error('납부 기록을 저장하지 못했습니다. 잠시 후 다시 시도해주세요.');
      throw new Error('record failed');
    }
  };

  if (state.error && !state.loading) {
    return <PaymentPageError viewOnly={viewOnly} message={state.error} onRetry={state.reload} />;
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1760px] space-y-5">
      <PaymentsHeader
        viewOnly={viewOnly}
        canEdit={canEditPayments}
        sendingNotification={state.sendingNotification}
        unpaidCount={state.summary.unpaidCount}
        onOpenCalculator={() => state.setCalculatorOpen(true)}
        onReload={state.reload}
        onSendUnpaid={() => setUnpaidDialogOpen(true)}
        onAddPayment={() => router.push('/payments/new')}
      />

      <PaymentSummaryStrip summary={state.summary} viewOnly={viewOnly} isOwner={isOwner} />

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_300px] xl:items-start">
        <main className="order-2 min-w-0 space-y-5 xl:order-1">
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
            onDetailedPay={canEditPayments ? (payment) => setRecordPayment(payment) : undefined}
            showPaymentMarkButton={canEditPayments}
            markingPaymentId={state.markingPaymentId}
            confirmBeforePayment
          />
        </main>
        <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
          <PaymentsOperationsBoard
            canEdit={canEditPayments}
            filters={state.filters}
            sendingNotification={state.sendingNotification}
            summary={state.summary}
            viewOnly={viewOnly}
            onAddPayment={() => router.push('/payments/new')}
            onFilterChange={state.updateFilters}
            onOpenCalculator={() => state.setCalculatorOpen(true)}
            onReload={state.reload}
            onSendUnpaid={() => setUnpaidDialogOpen(true)}
          />
        </div>
      </div>

      <ProrationCalculatorModal open={state.calculatorOpen} onClose={() => state.setCalculatorOpen(false)} />

      <AlertDialog open={unpaidDialogOpen} onOpenChange={setUnpaidDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>미납 알림 발송</AlertDialogTitle>
            <AlertDialogDescription>
              미납자 {state.summary.unpaidCount}명에게 알림톡을 발송할까요?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={state.sendingNotification}>취소</AlertDialogCancel>
            <AlertDialogAction
              disabled={state.sendingNotification}
              onClick={(event) => {
                event.preventDefault();
                void state.sendUnpaid().then(() => setUnpaidDialogOpen(false));
              }}
            >
              발송
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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

      {recordPayment ? (
        <PaymentRecordModal
          isOpen={Boolean(recordPayment)}
          onClose={() => setRecordPayment(null)}
          onSubmit={submitDetailedPayment}
          studentName={recordPayment.student_name}
          finalAmount={Number(recordPayment.final_amount) || 0}
          paidAmount={getPaidPaymentAmount(recordPayment)}
        />
      ) : null}
    </div>
  );
}
