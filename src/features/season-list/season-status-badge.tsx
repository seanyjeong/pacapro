import { Badge } from '@/components/ui/badge';
import type { SeasonStatus } from '@/lib/types/season';
import { SEASON_STATUS_LABELS } from '@/lib/types/season';

interface SeasonStatusBadgeProps {
  status: SeasonStatus;
}

export function SeasonStatusBadge({ status }: SeasonStatusBadgeProps) {
  const variant =
    status === 'active'
      ? 'success'
      : status === 'draft' || status === 'upcoming'
        ? 'warning'
        : status === 'completed' || status === 'ended'
          ? 'secondary'
          : 'destructive';

  return <Badge variant={variant}>{SEASON_STATUS_LABELS[status]}</Badge>;
}
