import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SmsLog } from './sms-types';
import { SmsStatusBadge } from './sms-status-badge';
import { SmsTypeBadge } from './sms-type-badge';

interface SmsLogsCardProps {
  logs: SmsLog[];
  isLoading: boolean;
  errorMessage?: string | null;
}

export function SmsLogsCard({ logs, isLoading, errorMessage }: SmsLogsCardProps) {
  return (
    <Card className="rounded-lg border-border/80 shadow-none">
      <CardHeader className="border-b border-border/70 p-4">
        <div className="flex items-center gap-2">
          <History className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-base font-semibold">최근 발송 내역</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="p-0">
        {isLoading ? (
          <div className="space-y-3 p-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-12 animate-pulse rounded-md bg-muted" />
            ))}
          </div>
        ) : errorMessage ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-semibold text-foreground">발송 내역을 불러오지 못했습니다</p>
            <p className="mt-1 text-xs text-muted-foreground">{errorMessage}</p>
          </div>
        ) : logs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">발송 내역이 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">문자를 발송하면 최근 내역이 표시됩니다.</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {logs.map((log) => (
              <div key={log.id} className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2">
                  <SmsTypeBadge type={log.message_type} />
                  <SmsStatusBadge status={log.status} />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-foreground">{log.recipient_name || '-'}</p>
                  <p className="truncate text-xs text-muted-foreground">{log.recipient_phone}</p>
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{log.message_content}</p>
                <p className="text-xs text-muted-foreground">{formatLogDate(log.sent_at || log.created_at)}</p>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function formatLogDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}
