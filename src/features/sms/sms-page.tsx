'use client';

import { AlertCircle } from 'lucide-react';
import { SmsComposeCard } from './sms-compose-card';
import { SmsHeader } from './sms-header';
import { SmsLogsCard } from './sms-logs-card';
import { SmsOperationsBoard } from './sms-operations-board';
import { SmsSendConfirmDialog } from './sms-send-confirm-dialog';
import { useSmsPageState } from './use-sms-page-state';

export function SMSPage() {
  const sms = useSmsPageState();

  return (
    <main className="min-h-screen bg-muted/20 px-4 py-5 sm:px-6 lg:px-8">
      <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl">
        <SmsHeader
          messageType={sms.messageType}
          recipientCount={sms.recipientCount}
          senderCount={sms.senderNumbers.length}
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

        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_280px] 2xl:grid-cols-[minmax(0,1fr)_320px] xl:items-start">
          <main className="min-w-0">
            <SmsComposeCard sms={sms} />
          </main>
          <aside className="space-y-5 xl:sticky xl:top-20">
            <SmsOperationsBoard sms={sms} />
            <SmsLogsCard logs={sms.logs} isLoading={sms.logsLoading} errorMessage={sms.logsError} />
          </aside>
        </div>

        <SmsSendConfirmDialog
          confirmation={sms.sendConfirmation}
          open={Boolean(sms.sendConfirmation)}
          sending={sms.sending}
          onConfirm={sms.confirmSend}
          onOpenChange={sms.handleSendConfirmationOpenChange}
        />
      </div>
    </main>
  );
}
