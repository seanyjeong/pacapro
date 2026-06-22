import { Suspense } from 'react';
import { SMSPage } from '@/features/sms/sms-page';

export default function Page() {
  return (
    <Suspense fallback={null}>
      <SMSPage />
    </Suspense>
  );
}
