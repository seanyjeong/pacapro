'use client';

import { useOrientation } from '@/components/tablet/orientation-context';
import { cn } from '@/lib/utils';
import { SmsComposeCard } from './sms-compose-card';
import { SmsInfoPanel } from './sms-info-panel';
import { SmsLogsCard } from './sms-logs-card';
import { TabletSmsHeader } from './tablet-sms-header';
import { getRecipientCount } from './sms-utils';
import { useSmsPageState } from './use-sms-page-state';

export function TabletSmsPage() {
  const sms = useSmsPageState();
  const orientation = useOrientation();
  const recipientCount = getRecipientCount(
    sms.sendMode,
    sms.recipientType,
    sms.customPhones,
    sms.recipientsCount
  );

  return (
    <main className="space-y-5 pb-20">
      <TabletSmsHeader
        messageType={sms.messageType}
        recipientCount={recipientCount}
        senderCount={sms.senderNumbers.length}
        onRefresh={sms.reloadLogs}
      />

      <div
        className={cn(
          'grid gap-5',
          orientation === 'landscape' && 'lg:grid-cols-12'
        )}
      >
        <div className={cn(orientation === 'landscape' && 'lg:col-span-8')}>
          <SmsComposeCard sms={sms} />
        </div>
        <aside className={cn('space-y-5', orientation === 'landscape' && 'lg:col-span-4')}>
          <SmsInfoPanel senderCount={sms.senderNumbers.length} selectedSenderId={sms.selectedSenderId} />
          <SmsLogsCard logs={sms.logs} isLoading={sms.logsLoading} />
        </aside>
      </div>
    </main>
  );
}
