import { Suspense } from 'react';
import { PaymentPageLoading } from './payment-page-loading';
import { PaymentsPageContent } from './payments-page-content';

export function PaymentsPage() {
  return (
    <Suspense fallback={<PaymentPageLoading />}>
      <PaymentsPageContent />
    </Suspense>
  );
}
