import { CalendarDays, Clock3, WalletCards } from 'lucide-react';
import type { Season } from '@/lib/types/season';
import { SEASON_TYPE_LABELS } from '@/lib/types/season';
import { ALL_TIME_SLOTS, formatWon, parseSeasonFee, TIME_SLOT_LABELS } from './season-enroll-utils';

interface SeasonEnrollContextPanelProps {
  season: Season;
}

export function SeasonEnrollContextPanel({ season }: SeasonEnrollContextPanelProps) {
  return (
    <aside className="space-y-4">
      <section className="rounded-md border border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-4 py-3">
          <h2 className="text-sm font-semibold text-slate-950">등록 기준</h2>
        </div>
        <dl className="divide-y divide-slate-100 text-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="flex items-center gap-2 text-slate-500">
              <CalendarDays className="h-4 w-4" />
              시즌 유형
            </dt>
            <dd className="font-medium text-slate-950">{SEASON_TYPE_LABELS[season.season_type]}</dd>
          </div>
          <div className="flex items-center justify-between gap-3 px-4 py-3">
            <dt className="flex items-center gap-2 text-slate-500">
              <WalletCards className="h-4 w-4" />
              기본 시즌비
            </dt>
            <dd className="font-medium text-slate-950">{formatWon(parseSeasonFee(season))}</dd>
          </div>
          <div className="flex items-start justify-between gap-3 px-4 py-3">
            <dt className="flex items-center gap-2 text-slate-500">
              <Clock3 className="h-4 w-4" />
              선택 시간대
            </dt>
            <dd className="flex flex-wrap justify-end gap-1">
              {ALL_TIME_SLOTS.map((slot) => (
                <span key={slot} className="rounded-md border border-slate-200 bg-slate-50 px-2 py-1 text-xs text-slate-700">
                  {TIME_SLOT_LABELS[slot]}
                </span>
              ))}
            </dd>
          </div>
        </dl>
      </section>
      <section className="rounded-md border border-slate-200 bg-slate-50 px-4 py-4 text-sm text-slate-600">
        시간대는 학생별로 여러 개 선택할 수 있고, 최소 1개는 유지됩니다.
      </section>
    </aside>
  );
}
