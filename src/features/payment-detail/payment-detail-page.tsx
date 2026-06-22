'use client';

import { useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { PaymentRecordModal } from '@/components/payments/payment-record-modal';
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
import type { PaymentRecordData } from '@/lib/types/payment';
import { isOwner, usePermissions } from '@/lib/utils/permissions';
import { PaymentDetailAmountSection } from './payment-detail-amount-section';
import { PaymentDetailError } from './payment-detail-error';
import { PaymentDetailHeader } from './payment-detail-header';
import { PaymentDetailLoading } from './payment-detail-loading';
import { PaymentDetailMetaSection } from './payment-detail-meta-section';
import { PaymentDetailNotes } from './payment-detail-notes';
import { PaymentDetailSummary } from './payment-detail-summary';
import { usePaymentDetailState } from './use-payment-detail-state';

export function PaymentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = Number(params.id);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const state = usePaymentDetailState(paymentId);
  const { canEdit } = usePermissions();
  const canEditPayments = canEdit('payments');
  const canDeletePayments = isOwner();

  if (state.loading) return <PaymentDetailLoading onBack={() => router.back()} />;
  if (state.error || !state.payment) {
    return <PaymentDetailError message={state.error || '학원비 정보를 찾을 수 없습니다.'} onBack={() => router.back()} onRetry={state.reload} />;
  }

  const submitRecordPayment = (data: { paid_amount: number; payment_method: string; payment_date: string; discount_amount?: number }) => {
    return state.recordPayment({
      paid_amount: data.paid_amount,
      payment_method: data.payment_method as PaymentRecordData['payment_method'],
      payment_date: data.payment_date,
      discount_amount: data.discount_amount,
    });
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <PaymentDetailHeader
        payment={state.payment}
        canEdit={canEditPayments}
        canDelete={canDeletePayments}
        deleting={state.deleting}
        onBack={() => router.back()}
        onRecordPayment={() => state.setShowRecordModal(true)}
        onEdit={() => router.push(`/payments/${paymentId}/edit`)}
        onDelete={() => setDeleteDialogOpen(true)}
      />
      <PaymentDetailSummary payment={state.payment} />
      <PaymentDetailAmountSection payment={state.payment} />
      <PaymentDetailMetaSection payment={state.payment} canEditPaidDate={canEditPayments && Boolean(state.payment.paid_date)} onUpdatePaidDate={state.updatePaidDate} />
      <PaymentDetailNotes payment={state.payment} />
      <PaymentRecordModal
        isOpen={state.showRecordModal}
        onClose={() => state.setShowRecordModal(false)}
        onSubmit={submitRecordPayment}
        studentName={state.payment.student_name}
        finalAmount={state.payment.final_amount}
        paidAmount={state.payment.paid_amount}
      />
      <AlertDialog
        open={deleteDialogOpen}
        onOpenChange={(open) => {
          if (!state.deleting) setDeleteDialogOpen(open);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>학원비 청구 삭제</AlertDialogTitle>
            <AlertDialogDescription>
              {state.payment.student_name}님의 {state.payment.year_month} 학원비 청구를 삭제할까요? 삭제 후에는 목록에서
              확인할 수 없습니다.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={state.deleting}>취소</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={state.deleting}
              onClick={(event) => {
                event.preventDefault();
                void state.deletePayment(() => {
                  setDeleteDialogOpen(false);
                  router.push('/payments');
                });
              }}
            >
              {state.deleting ? '삭제 중' : '삭제'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
