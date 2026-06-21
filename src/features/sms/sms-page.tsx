'use client';

import { SmsComposeCard } from './sms-compose-card';
import { SmsHeader } from './sms-header';
import { SmsInfoPanel } from './sms-info-panel';
import { SmsLogsCard } from './sms-logs-card';
import { useSmsPageState } from './use-sms-page-state';

export function SMSPage() {
  const sms = useSmsPageState();

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <SmsHeader
          messageType={sms.messageType}
          recipientCount={
            sms.sendMode === 'all'
              ? sms.recipientType === 'student'
                ? sms.recipientsCount.students
                : sms.recipientsCount.parents
              : sms.sendMode === 'custom'
                ? sms.customPhones.filter((phone) => phone.trim()).length
                : sms.selectedStudent
                  ? 1
                  : 0
          }
          senderCount={sms.senderNumbers.length}
        />

        <div className="grid gap-5 lg:grid-cols-12">
          <div className="lg:col-span-8">
            <SmsComposeCard sms={sms} />
          </div>
          <aside className="space-y-5 lg:col-span-4">
            <SmsInfoPanel senderCount={sms.senderNumbers.length} selectedSenderId={sms.selectedSenderId} />
            <SmsLogsCard logs={sms.logs} isLoading={sms.logsLoading} />
          </aside>
        </div>
      </div>
    </main>
  );
}
