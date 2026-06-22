'use client';

// Phase 4 #1 — 최근 발송 내역 sub-component
import Link from 'next/link';
import { CheckCircle, Clock, ReceiptText, UserRound, XCircle } from 'lucide-react';
import { NotificationLog } from '@/lib/api/notifications';

interface Props {
  logs: NotificationLog[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'sent':
    case 'delivered':
      return <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-1 text-xs text-green-800"><CheckCircle className="h-3 w-3" /> 발송</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 rounded-full bg-red-100 px-2 py-1 text-xs text-red-800"><XCircle className="h-3 w-3" /> 실패</span>;
    default:
      return <span className="inline-flex items-center gap-1 rounded-full bg-yellow-100 px-2 py-1 text-xs text-yellow-800"><Clock className="h-3 w-3" /> 대기</span>;
  }
}

function formatSentAt(value: string | null) {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}

export default function SendLogs({ logs }: Props) {
  return (
    <div className="rounded-md border border-border bg-card p-5 shadow-none">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-normal text-muted-foreground">Send History</p>
          <h2 className="text-lg font-semibold text-foreground">최근 발송 내역</h2>
        </div>
        <span className="rounded-md border border-border bg-muted/30 px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {logs.length}건
        </span>
      </div>

      {logs.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted-foreground">발송 내역이 없습니다</p>
      ) : (
        <div className="space-y-3">
          {logs.map((log) => {
            const recipientLabel = log.recipient_name || log.student_name || log.recipient_phone;

            return (
              <article key={log.id} className="rounded-md border border-border bg-background p-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{recipientLabel}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">{log.recipient_phone}</p>
                  </div>
                  <div className="shrink-0">{getStatusBadge(log.status)}</div>
                </div>

                <p className="mt-2 line-clamp-2 text-sm text-muted-foreground">{log.message_content}</p>
                <p className="mt-2 text-xs text-muted-foreground">{formatSentAt(log.sent_at)}</p>

                {(log.student_id || log.payment_id) ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {log.student_id ? (
                      <Link
                        aria-label={`${recipientLabel} 학생 상세 보기`}
                        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        href={`/students/${log.student_id}`}
                      >
                        <UserRound className="h-3.5 w-3.5" />
                        학생
                      </Link>
                    ) : null}
                    {log.payment_id ? (
                      <Link
                        aria-label={`${recipientLabel} 결제 상세 보기`}
                        className="inline-flex min-h-8 items-center justify-center gap-1.5 rounded-md border border-border px-2.5 text-xs font-medium text-foreground transition-colors hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/30"
                        href={`/payments/${log.payment_id}`}
                      >
                        <ReceiptText className="h-3.5 w-3.5" />
                        결제
                      </Link>
                    ) : null}
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
