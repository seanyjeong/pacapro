'use client';

import { AlertCircle, CheckCircle2 } from 'lucide-react';

interface Props {
  loadErrors: string[];
  message: { type: 'success' | 'error'; text: string } | null;
}

export default function NotificationsStatusBanner({ loadErrors, message }: Props) {
  return (
    <>
      {message ? (
        <section className={`rounded-md border p-4 ${message.type === 'success' ? 'border-green-200 bg-green-50 text-green-950 dark:border-green-900/60 dark:bg-green-950/40 dark:text-green-100' : 'border-red-200 bg-red-50 text-red-950 dark:border-red-900/60 dark:bg-red-950/40 dark:text-red-100'}`}>
          <div className="flex items-start gap-3">
            {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        </section>
      ) : null}

      {loadErrors.length > 0 ? (
        <section className="rounded-md border border-amber-200 bg-amber-50 p-4 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/45 dark:text-amber-100">
          <div className="flex items-start gap-3">
            <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
            <div>
              <h2 className="text-sm font-semibold">알림톡 준비 정보를 일부 불러오지 못했습니다</h2>
              <ul className="mt-2 space-y-1 text-sm">
                {loadErrors.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </div>
          </div>
        </section>
      ) : null}
    </>
  );
}
