import type { SeasonType } from '@/lib/types/season';
import { SEASON_TYPE_LABELS } from '@/lib/types/season';

interface SeasonTypeBadgeProps {
  type: SeasonType;
}

export function SeasonTypeBadge({ type }: SeasonTypeBadgeProps) {
  const className = type === 'early'
    ? 'border-sky-200 bg-sky-50 text-sky-700'
    : 'border-amber-200 bg-amber-50 text-amber-700';

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {SEASON_TYPE_LABELS[type]}
    </span>
  );
}
