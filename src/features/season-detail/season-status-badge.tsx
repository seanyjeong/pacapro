import { Badge } from '@/components/ui/badge';
import type { SeasonStatus } from '@/lib/types/season';
import { SEASON_STATUS_LABELS } from '@/lib/types/season';

interface SeasonStatusBadgeProps {
  status?: SeasonStatus;
  label?: string;
  tone?: 'default' | 'info' | 'success' | 'warning';
}

export function SeasonStatusBadge({ status, label, tone }: SeasonStatusBadgeProps) {
  const badgeTone = tone ?? getStatusTone(status);
  const badgeLabel = label ?? (status ? SEASON_STATUS_LABELS[status] ?? status : '-');

  return (
    <Badge className="rounded-md" variant={badgeTone === 'default' ? 'outline' : badgeTone}>
      {badgeLabel}
    </Badge>
  );
}

function getStatusTone(status?: SeasonStatus): 'default' | 'success' | 'warning' | 'info' {
  if (status === 'active') return 'success';
  if (status === 'draft' || status === 'upcoming') return 'warning';
  if (status === 'completed' || status === 'ended') return 'info';
  return 'default';
}
