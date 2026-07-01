'use client';

import { useParams, useRouter } from 'next/navigation';
import { PaymentEditorError } from './payment-editor-error';
import { PaymentEditorLoading } from './payment-editor-loading';
import { PaymentEditorShell } from './payment-editor-shell';
import { PaymentForm } from './payment-form';
import { toPaymentFormData } from './payment-editor-utils';
import { usePaymentEditState } from './use-payment-edit-state';

export function PaymentEditPage() {
  const params = useParams();
  const router = useRouter();
  const paymentId = Number(params.id);
  const state = usePaymentEditState(paymentId);
  const subtitle = state.payment ? `${state.payment.student_name} · ${state.payment.year_month}` : undefined;

  return (
    <PaymentEditorShell title="학원비 수정" subtitle={subtitle} onBack={() => router.back()}>
      {state.loading ? <PaymentEditorLoading /> : null}
      {!state.loading && state.error ? <PaymentEditorError message={state.error} onRetry={state.reload} onList={() => router.push('/payments')} /> : null}
      {!state.loading && !state.error && state.payment ? (
        <PaymentForm
          mode="edit"
          initialData={toPaymentFormData(state.payment)}
          editingPayment={state.payment}
          students={state.students}
          onSubmit={(data) => state.submitPayment(data, () => router.push(`/payments/${paymentId}`))}
          onCancel={() => router.back()}
          loading={state.saving}
        />
      ) : null}
    </PaymentEditorShell>
  );
}
