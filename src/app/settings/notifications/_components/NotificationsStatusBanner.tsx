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
        <section className={`rounded-md border p-4 ${message.type === 'success' ? 'border-success/30 bg-success-soft text-success' : 'border-destructive/30 bg-destructive-soft text-destructive'}`}>
          <div className="flex items-start gap-3">
            {message.type === 'success' ? <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" /> : <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />}
            <p className="text-sm font-medium">{message.text}</p>
          </div>
        </section>
      ) : null}

      {loadErrors.length > 0 ? (
        <section className="rounded-md border border-warning/30 bg-warning-soft p-4 text-warning">
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
