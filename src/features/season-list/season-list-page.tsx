'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { SeasonConfirmDialog } from '@/features/seasons/season-confirm-dialog';
import { SeasonActivePanel } from './season-active-panel';
import { SeasonListEmpty } from './season-list-empty';
import { SeasonListError } from './season-list-error';
import { SeasonListFilters } from './season-list-filters';
import { SeasonListHeader } from './season-list-header';
import { SeasonListLoading } from './season-list-loading';
import { SeasonListOperationsBoard } from './season-list-operations-board';
import { SeasonListSummary } from './season-list-summary';
import { SeasonListTable } from './season-list-table';
import { useSeasonListState } from './use-season-list-state';

export function SeasonListPage() {
  const router = useRouter();
  const state = useSeasonListState();
  const [deleteTarget, setDeleteTarget] = useState<{ seasonId: number; seasonName: string } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const deleted = await state.deleteSeason(deleteTarget.seasonId);
    setDeleting(false);
    if (deleted) setDeleteTarget(null);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl" data-testid="season-list-workspace">
      <SeasonListHeader onAddSeason={() => router.push('/seasons/new')} onRefresh={state.reload} />

      {state.error ? (
        <SeasonListError message={state.error} onRetry={state.reload} />
      ) : (
        <>
          <SeasonListSummary stats={state.stats} />

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px] xl:items-start">
            <main className="order-2 min-w-0 space-y-5 xl:order-1">
              <SeasonActivePanel seasons={state.seasons} onRefresh={state.reload} />
              <SeasonListFilters
                filters={state.filters}
                years={state.years}
                onClear={state.clearFilters}
                onChange={state.setFilters}
              />

              {state.loading ? (
                <SeasonListLoading />
              ) : state.seasons.length === 0 ? (
                <SeasonListEmpty onAddSeason={() => router.push('/seasons/new')} />
              ) : (
                <SeasonListTable
                  seasons={state.seasons}
                  onDelete={(seasonId, seasonName) => setDeleteTarget({ seasonId, seasonName })}
                  onOpen={(seasonId) => router.push(`/seasons/${seasonId}`)}
                />
              )}
            </main>
            <div className="order-1 min-w-0 xl:sticky xl:top-20 xl:order-2">
              <SeasonListOperationsBoard
                filters={state.filters}
                seasons={state.seasons}
                stats={state.stats}
                onAddSeason={() => router.push('/seasons/new')}
                onClearFilters={state.clearFilters}
                onRefresh={state.reload}
              />
            </div>
          </div>
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
