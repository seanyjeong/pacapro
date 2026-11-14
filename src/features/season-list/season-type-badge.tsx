import { Badge } from '@/components/ui/badge';
import type { SeasonType } from '@/lib/types/season';
import { SEASON_TYPE_LABELS } from '@/lib/types/season';

interface SeasonTypeBadgeProps {
  type: SeasonType;
}

export function SeasonTypeBadge({ type }: SeasonTypeBadgeProps) {
  return <Badge variant={type === 'early' ? 'default' : 'warning'}>{SEASON_TYPE_LABELS[type]}</Badge>;
}
