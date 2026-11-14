'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BranchChecks, useBranchChecks } from '@/features/branches/branch-checks';
import { SeasonConfirmDialog } from '@/features/seasons/season-confirm-dialog';
import { useBranchTree } from '@/hooks/use-branches';
import type { Season } from '@/lib/types/season';
import { SeasonActivePanel } from './season-active-panel';
import { SeasonListEmpty } from './season-list-empty';
import { SeasonListError } from './season-list-error';
import { SeasonListFilters } from './season-list-filters';
import { SeasonListHeader } from './season-list-header';
import { SeasonListLoading } from './season-list-loading';
import { SeasonListSummary } from './season-list-summary';
import { SeasonListTable } from './season-list-table';
import { getSeasonStats } from './season-list-utils';
import { useSeasonListState } from './use-season-list-state';

export function SeasonListPage() {
  const router = useRouter();
  const state = useSeasonListState();
  const [deleteTarget, setDeleteTarget] = useState<{ seasonId: number; seasonName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);
  // 지점 칩: 고른 지점의 시즌 + 전 지점 시즌. 지점이 없는 학원은 칩도 지점 표시도 없다.
  const { branches, enabled: branchesEnabled } = useBranchTree();
  const [branchIds, setBranchIds] = useBranchChecks();
  const seasons = useMemo(() => state.seasons.filter((season) =>
    branchIds.length === 0 || season.branch_id == null || branchIds.includes(season.branch_id)), [state.seasons, branchIds]);
  const stats = useMemo(() => getSeasonStats(seasons), [seasons]);
  const branchNameOf = useMemo(() => {
    if (!branchesEnabled) return undefined;
    const names = new Map(branches.map((branch) => [branch.id, branch.name]));
    return (season: Season) => (season.branch_id ? names.get(season.branch_id) ?? '지점' : '전 지점');
  }, [branches, branchesEnabled]);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const deleted = await state.deleteSeason(deleteTarget.seasonId);
    setDeleting(false);
    if (deleted) setDeleteTarget(null);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[1760px] space-y-4" data-testid="season-list-workspace">
      <SeasonListHeader onAddSeason={() => router.push('/seasons/new')} onRefresh={state.reload} />

      {state.error ? (
        <SeasonListError message={state.error} onRetry={state.reload} />
      ) : (
        <>
          <BranchChecks branches={branches} selected={branchIds} withoutNone onChange={setBranchIds} />

          <SeasonListSummary
            filters={state.filters}
            stats={stats}
            onClearFilters={state.clearFilters}
            onFilterChange={state.setFilters}
          />

          <SeasonActivePanel seasons={seasons} />

          <section className="min-w-0 overflow-hidden rounded-2xl bg-card">
            <SeasonListFilters
              filters={state.filters}
              years={state.years}
              onClear={state.clearFilters}
              onChange={state.setFilters}
            />

            {state.loading ? (
              <SeasonListLoading />
            ) : seasons.length === 0 ? (
              <SeasonListEmpty onAddSeason={() => router.push('/seasons/new')} />
            ) : (
              <SeasonListTable
                seasons={seasons}
                branchNameOf={branchNameOf}
                onDelete={(seasonId, seasonName) => setDeleteTarget({ seasonId, seasonName })}
                onOpen={(seasonId) => router.push(`/seasons/${seasonId}`)}
              />
            )}
          </section>
        </>
      )}

      {deleteTarget ? (
        <SeasonConfirmDialog
          busy={deleting}
          confirmLabel="삭제"
          description="이 시즌을 삭제할까요?"
          detail={deleteTarget.seasonName}
          title="시즌 삭제"
          warning="등록된 학생이 있으면 삭제할 수 없습니다."
          onCancel={() => setDeleteTarget(null)}
          onConfirm={handleConfirmDelete}
        />
      ) : null}
    </div>
  );
}
