import { Suspense } from 'react';
import { TabletSmsPage } from '@/features/sms/tablet-sms-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <TabletSmsPage />
    </Suspense>
  );
}
