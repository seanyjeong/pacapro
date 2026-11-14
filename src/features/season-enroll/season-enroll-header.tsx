import { Badge } from '@/components/ui/badge';
import { SeasonPageHeader } from '@/features/seasons/season-page-header';
import type { Season } from '@/lib/types/season';
import { SEASON_TYPE_LABELS } from '@/lib/types/season';

interface SeasonEnrollHeaderProps {
  season: Season;
  onBack: () => void;
}

export function SeasonEnrollHeader({ season, onBack }: SeasonEnrollHeaderProps) {
  return (
    <SeasonPageHeader
      title="학생 등록"
      description={
        <span className="break-keep">
          {season.season_name} · {SEASON_TYPE_LABELS[season.season_type]}
        </span>
      }
      actions={<Badge variant="secondary" className="px-3 py-1.5 text-[13px]">대상: 고3, N수</Badge>}
      onBack={onBack}
    />
  );
}
