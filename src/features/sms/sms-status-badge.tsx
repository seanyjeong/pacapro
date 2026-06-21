import { CheckCircle, Clock, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { SmsLog } from './sms-types';

interface SmsStatusBadgeProps {
  status: SmsLog['status'];
}

export function SmsStatusBadge({ status }: SmsStatusBadgeProps) {
  if (status === 'sent' || status === 'delivered') {
    return (
      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
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
          ? 'border-red-200 bg-red-50 text-red-700'
          : 'border-amber-200 bg-amber-50 text-amber-700'
      )}
    >
      <Icon className="h-3 w-3" />
      {isFailed ? '실패' : '대기'}
    </span>
  );
}
