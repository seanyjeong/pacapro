import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import type { Season, SeasonFilters } from '@/lib/types/season';
import { deleteSeasonFromList, fetchSeasonsForList } from './season-list-api';
import { getSeasonStats, getSeasonYears, SEASON_DELETE_ERROR, SEASON_LIST_LOAD_ERROR } from './season-list-utils';

export function useSeasonListState() {
  const [filters, setFilters] = useState<SeasonFilters>({});
  const [seasons, setSeasons] = useState<Season[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSeasons(await fetchSeasonsForList(filters));
    } catch {
      setSeasons([]);
      setError(SEASON_LIST_LOAD_ERROR);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    reload();
  }, [reload]);

  const deleteSeason = async (seasonId: number) => {
    try {
      await deleteSeasonFromList(seasonId);
      toast.success('시즌이 삭제되었습니다.');
      await reload();
      return true;
    } catch {
      toast.error(SEASON_DELETE_ERROR);
      return false;
    }
  };

  const clearFilters = () => setFilters({});
  const stats = useMemo(() => getSeasonStats(seasons), [seasons]);
  const years = useMemo(() => getSeasonYears(seasons), [seasons]);

  return {
    clearFilters,
    deleteSeason,
    error,
    filters,
    loading,
    reload,
    seasons,
    setFilters,
    stats,
    years,
  };
}
