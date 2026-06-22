'use client';

import { useRouter } from 'next/navigation';
import { PaymentEditorError } from './payment-editor-error';
import { PaymentEditorLoading } from './payment-editor-loading';
import { PaymentEditorShell } from './payment-editor-shell';
import { PaymentForm } from './payment-form';
import { usePaymentCreateState } from './use-payment-create-state';

export function PaymentCreatePage() {
  const router = useRouter();
  const state = usePaymentCreateState();

  return (
    <PaymentEditorShell title="학원비 청구" onBack={() => router.back()}>
      {state.loading ? <PaymentEditorLoading /> : null}
      {!state.loading && state.error ? <PaymentEditorError message={state.error} onRetry={state.reload} onList={() => router.push('/payments')} /> : null}
      {!state.loading && !state.error ? (
        <PaymentForm
          mode="create"
          students={state.students}
          onSubmit={(data) => state.submitPayment(data, () => router.push('/payments'))}
          onCancel={() => router.back()}
          loading={state.saving}
        />
      ) : null}
    </PaymentEditorShell>
  );
}
