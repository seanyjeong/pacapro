'use client';

// Phase 4 #1 — 최근 발송 내역 sub-component
import { CheckCircle, XCircle, Clock } from 'lucide-react';
import { NotificationLog } from '@/lib/api/notifications';

interface Props {
  logs: NotificationLog[];
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'sent':
    case 'delivered':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-green-100 text-green-800"><CheckCircle className="w-3 h-3" /> 발송</span>;
    case 'failed':
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-red-100 text-red-800"><XCircle className="w-3 h-3" /> 실패</span>;
    default:
      return <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs bg-yellow-100 text-yellow-800"><Clock className="w-3 h-3" /> 대기</span>;
  }
}

export default function SendLogs({ logs }: Props) {
  return (
    <div className="bg-card rounded-lg shadow-sm border border-border p-6">
      <h2 className="text-lg font-semibold text-foreground mb-4">최근 발송 내역</h2>

      {logs.length === 0 ? (
        <p className="text-muted-foreground text-center py-8">발송 내역이 없습니다</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 text-muted-foreground">발송시간</th>
                <th className="text-left py-2 px-2 text-muted-foreground">수신자</th>
                <th className="text-left py-2 px-2 text-muted-foreground">전화번호</th>
                <th className="text-left py-2 px-2 text-muted-foreground">상태</th>
              </tr>
            </thead>
            <tbody>
              {logs.map(log => (
                <tr key={log.id} className="border-b border-border last:border-0">
                  <td className="py-2 px-2 text-muted-foreground">
                    {log.sent_at ? new Date(log.sent_at).toLocaleString('ko-KR') : '-'}
                  </td>
                  <td className="py-2 px-2 text-foreground">{log.recipient_name || log.student_name || '-'}</td>
                  <td className="py-2 px-2 text-foreground">{log.recipient_phone}</td>
                  <td className="py-2 px-2">{getStatusBadge(log.status)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
