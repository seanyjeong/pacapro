import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmsLog } from './sms-types';

interface SmsStatusBadgeProps {
  status: SmsLog['status'];
}

export function SmsStatusBadge({ status }: SmsStatusBadgeProps) {
  if (status === 'sent' || status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-success/30 bg-success-soft px-2 py-1 text-xs font-medium text-success">
        <CheckCircle className="h-3 w-3" />
        발송
      </span>
    );
  }

  const isFailed = status === 'failed';
  const Icon = isFailed ? XCircle : Clock;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 rounded-full border px-2 py-1 text-xs font-medium',
        isFailed
          ? 'border-destructive/30 bg-destructive-soft text-destructive'
          : 'border-warning/30 bg-warning-soft text-warning'
      )}
    >
      <Icon className="h-3 w-3" />
      {isFailed ? '실패' : '대기'}
    </span>
  );
}
