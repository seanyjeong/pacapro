import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Season } from '@/lib/types/season';
import { formatSeasonFee, SEASON_TYPE_LABELS } from '@/lib/types/season';

interface SeasonEnrollHeaderProps {
  season: Season;
  onBack: () => void;
}

export function SeasonEnrollHeader({ season, onBack }: SeasonEnrollHeaderProps) {
  return (
    <header className="flex flex-col gap-3 border-b border-slate-200 pb-4 md:flex-row md:items-end md:justify-between">
      <div className="min-w-0">
        <Button className="-ml-2 mb-2" variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          뒤로
        </Button>
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-normal text-slate-950">학생 등록</h1>
          <p className="mt-1 break-keep text-sm text-slate-600">
            {season.season_name} · {SEASON_TYPE_LABELS[season.season_type]} · {formatSeasonFee(season.default_season_fee)}
          </p>
        </div>
      </div>
      <div className="flex h-9 items-center rounded-md border border-slate-200 bg-slate-50 px-3 text-sm text-slate-600">
        대상: 고3, N수
      </div>
    </header>
  );
}
