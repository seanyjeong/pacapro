'use client';

import { useRouter } from 'next/navigation';
import { SeasonListEmpty } from './season-list-empty';
import { SeasonListError } from './season-list-error';
import { SeasonListFilters } from './season-list-filters';
import { SeasonListHeader } from './season-list-header';
import { SeasonListLoading } from './season-list-loading';
import { SeasonListSummary } from './season-list-summary';
import { SeasonListTable } from './season-list-table';
import { useSeasonListState } from './use-season-list-state';

export function SeasonListPage() {
  const router = useRouter();
  const state = useSeasonListState();

  const handleDeleteSeason = async (seasonId: number, seasonName: string) => {
    const confirmed = confirm(`"${seasonName}" 시즌을 삭제하시겠습니까?\n등록된 학생이 있으면 삭제할 수 없습니다.`);
    if (!confirmed) return;
    await state.deleteSeason(seasonId);
  };

  return (
    <div className="mx-auto w-full min-w-0 max-w-[calc(100vw-2rem)] space-y-5 md:max-w-7xl" data-testid="season-list-workspace">
      <SeasonListHeader onAddSeason={() => router.push('/seasons/new')} onRefresh={state.reload} />

      {state.error ? (
        <SeasonListError message={state.error} onRetry={state.reload} />
      ) : (
        <>
          <SeasonListSummary stats={state.stats} />
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
              onDelete={handleDeleteSeason}
              onEdit={(seasonId) => router.push(`/seasons/${seasonId}/edit`)}
              onOpen={(seasonId) => router.push(`/seasons/${seasonId}`)}
            />
          )}
        </>
      )}
    </div>
  );
}
