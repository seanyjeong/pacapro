import { History } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { SmsLog } from './sms-types';
import { SmsStatusBadge } from './sms-status-badge';
import { SmsTypeBadge } from './sms-type-badge';

interface SmsLogsCardProps {
  logs: SmsLog[];
  isLoading: boolean;
}

export function SmsLogsCard({ logs, isLoading }: SmsLogsCardProps) {
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
        ) : logs.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-sm font-medium text-foreground">발송 내역이 없습니다.</p>
            <p className="mt-1 text-xs text-muted-foreground">문자를 발송하면 최근 내역이 표시됩니다.</p>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full min-w-[640px] text-sm">
                <thead className="bg-muted/70 text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium">시간</th>
                    <th className="px-3 py-2 text-left font-medium">유형</th>
                    <th className="px-3 py-2 text-left font-medium">수신자</th>
                    <th className="px-3 py-2 text-left font-medium">내용</th>
                    <th className="px-3 py-2 text-left font-medium">상태</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-t border-border">
                      <td className="whitespace-nowrap px-3 py-3 text-xs text-muted-foreground">
                        {formatLogDate(log.sent_at || log.created_at)}
                      </td>
                      <td className="px-3 py-3"><SmsTypeBadge type={log.message_type} /></td>
                      <td className="px-3 py-3">
                        <span className="block font-medium text-foreground">{log.recipient_name || '-'}</span>
                        <span className="block text-xs text-muted-foreground">{log.recipient_phone}</span>
                      </td>
                      <td className="max-w-[180px] truncate px-3 py-3 text-muted-foreground" title={log.message_content}>
                        {log.message_content}
                      </td>
                      <td className="px-3 py-3"><SmsStatusBadge status={log.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="divide-y divide-border md:hidden">
              {logs.map((log) => (
                <div key={log.id} className="space-y-2 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <SmsTypeBadge type={log.message_type} />
                    <SmsStatusBadge status={log.status} />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">{log.recipient_name || '-'}</p>
                    <p className="text-xs text-muted-foreground">{log.recipient_phone}</p>
                  </div>
                  <p className="line-clamp-2 text-sm text-muted-foreground">{log.message_content}</p>
                  <p className="text-xs text-muted-foreground">{formatLogDate(log.sent_at || log.created_at)}</p>
                </div>
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

function formatLogDate(value: string | null): string {
  if (!value) return '-';
  return new Date(value).toLocaleString('ko-KR');
}
