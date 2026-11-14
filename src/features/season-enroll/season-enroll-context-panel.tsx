import { Building2, Clock3 } from 'lucide-react';
import { useBranchTree } from '@/hooks/use-branches';
import type { Season } from '@/lib/types/season';
import { ALL_TIME_SLOTS, TIME_SLOT_LABELS } from './season-enroll-utils';

interface SeasonEnrollContextPanelProps {
  season: Season;
}

/** 시즌 유형·기본 시즌비는 머리말·요약 줄에 있으므로 여기서는 시간대 기준만 보여 준다. */
export function SeasonEnrollContextPanel({ season }: SeasonEnrollContextPanelProps) {
  const { branches, enabled: branchesEnabled } = useBranchTree();
  const branchName = season.branch_id ? branches.find((branch) => branch.id === season.branch_id)?.name ?? '지점' : null;
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
      {branchesEnabled ? (
        <div className="mt-3 flex items-start justify-between gap-3 text-sm">
          <span className="flex items-center gap-2 text-muted-foreground">
            <Building2 className="h-4 w-4" />
            지점
          </span>
          <span className="rounded-full bg-primary-soft px-2.5 py-0.5 text-xs font-semibold text-primary">{branchName ?? '전 지점'}</span>
        </div>
      ) : null}
      <p className="mt-4 rounded-xl bg-muted px-3.5 py-3 text-[13px] text-secondary-foreground">
        시간대는 학생별로 여러 개 고를 수 있고, 최소 1개는 남아요.
        {branchName ? ` ${branchName} 지점 시즌이라 ${branchName} 학생만 보여요.` : ''}
      </p>
    </aside>
  );
}
