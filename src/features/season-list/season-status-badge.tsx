import type { SeasonStatus } from '@/lib/types/season';
import { SEASON_STATUS_LABELS } from '@/lib/types/season';

interface SeasonStatusBadgeProps {
  status: SeasonStatus;
}

export function SeasonStatusBadge({ status }: SeasonStatusBadgeProps) {
  const className =
    status === 'active'
      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
      : status === 'draft' || status === 'upcoming'
        ? 'border-yellow-200 bg-yellow-50 text-yellow-700'
        : status === 'completed' || status === 'ended'
          ? 'border-slate-200 bg-slate-50 text-slate-600'
          : 'border-rose-200 bg-rose-50 text-rose-700';

  return (
    <span className={`inline-flex rounded-md border px-2 py-1 text-xs font-medium ${className}`}>
      {SEASON_STATUS_LABELS[status]}
    </span>
  );
}
