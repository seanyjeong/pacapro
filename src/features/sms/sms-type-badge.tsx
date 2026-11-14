import { cn } from '@/lib/utils';

interface SmsTypeBadgeProps {
  type: string;
}

export function SmsTypeBadge({ type }: SmsTypeBadgeProps) {
  const normalizedType = type?.toUpperCase() || 'SMS';

  return (
    <span
      className={cn(
        'inline-flex rounded-md border px-2 py-1 text-xs font-semibold',
        normalizedType === 'MMS' && 'border-violet-200 bg-violet-50 text-violet-700',
        normalizedType === 'LMS' && 'border-warning/30 bg-warning-soft text-warning',
        normalizedType === 'SMS' && 'border-border bg-muted text-secondary-foreground'
      )}
    >
      {normalizedType}
    </span>
  );
}
