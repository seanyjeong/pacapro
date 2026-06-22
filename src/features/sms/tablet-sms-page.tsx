'use client';

import { useOrientation } from '@/components/tablet/orientation-context';
import { AlertCircle } from 'lucide-react';
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
        selectedStudent={sms.selectedStudent}
        onRefresh={sms.reloadLogs}
      />

      {sms.loadErrors.length > 0 ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold">문자 준비 정보를 일부 불러오지 못했습니다</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {sms.loadErrors.map((message) => (
                  <li key={message}>{message}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}

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
          <SmsLogsCard logs={sms.logs} isLoading={sms.logsLoading} errorMessage={sms.logsError} />
        </aside>
      </div>
    </main>
  );
}
