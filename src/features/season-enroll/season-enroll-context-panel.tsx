import { Clock3 } from 'lucide-react';
import type { Season } from '@/lib/types/season';
import { ALL_TIME_SLOTS, TIME_SLOT_LABELS } from './season-enroll-utils';

interface SeasonEnrollContextPanelProps {
  season: Season;
}

/** 시즌 유형·기본 시즌비는 머리말·요약 줄에 있으므로 여기서는 시간대 기준만 보여 준다. */
export function SeasonEnrollContextPanel({ season }: SeasonEnrollContextPanelProps) {
  return (
    <aside className="rounded-2xl bg-card p-5 sm:p-6" aria-label={`${season.season_name} 등록 기준`}>
      <h2 className="text-[17px] font-bold tracking-tight text-foreground">등록 기준</h2>
      <div className="mt-3 flex items-start justify-between gap-3 text-sm">
        <span className="flex items-center gap-2 text-muted-foreground">
          <Clock3 className="h-4 w-4" />
          선택 시간대
        </span>
        <span className="flex flex-wrap justify-end gap-1">
          {ALL_TIME_SLOTS.map((slot) => (
            <span key={slot} className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-semibold text-secondary-foreground">
              {TIME_SLOT_LABELS[slot]}
            </span>
          ))}
        </span>
      </div>
      <p className="mt-4 rounded-xl bg-muted px-3.5 py-3 text-[13px] text-secondary-foreground">
        시간대는 학생별로 여러 개 고를 수 있고, 최소 1개는 남아요.
      </p>
    </aside>
  );
}
