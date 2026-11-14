import type { SeasonStatus } from '@/lib/types/season';
import { SEASON_STATUS_LABELS } from '@/lib/types/season';

interface SeasonStatusBadgeProps {
  status: SeasonStatus;
}

export function SeasonStatusBadge({ status }: SeasonStatusBadgeProps) {
  const className =
    status === 'active'
      ? 'border-success/30 bg-success-soft text-success'
      : status === 'draft' || status === 'upcoming'
        ? 'border-warning/30 bg-warning-soft text-warning'
        : status === 'completed' || status === 'ended'
          ? 'border-border bg-muted text-secondary-foreground'
          : 'border-destructive/30 bg-destructive-soft text-destructive';

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {SEASON_STATUS_LABELS[status]}
    </span>
  );
}
