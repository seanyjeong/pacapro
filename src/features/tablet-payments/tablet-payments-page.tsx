import { Suspense } from 'react';
import { TabletPaymentsLoading } from './tablet-payments-loading';
import { TabletPaymentsPageContent } from './tablet-payments-page-content';

export function TabletPaymentsPage() {
  return (
    <Suspense fallback={<TabletPaymentsLoading />}>
      <TabletPaymentsPageContent />
    </Suspense>
  );
}
