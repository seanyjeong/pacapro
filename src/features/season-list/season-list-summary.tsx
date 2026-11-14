import { CalendarDays, CircleCheck, Flag, Trophy } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import type { SeasonFilters } from '@/lib/types/season';
import { cn } from '@/lib/utils';

interface SeasonListSummaryProps {
  filters: SeasonFilters;
  stats: {
    active: number;
    early: number;
    regular: number;
    total: number;
  };
  onClearFilters: () => void;
  onFilterChange: (filters: SeasonFilters) => void;
}

const selectedTile = 'ring-2 ring-primary/40';

/** 숫자 칸을 누르면 아래 목록 필터가 바뀐다(옛 시즌 작업 보드의 숫자 칸과 같은 동작). */
export function SeasonListSummary({ filters, stats, onClearFilters, onFilterChange }: SeasonListSummaryProps) {
  const hasActiveFilters = Boolean(filters.year || filters.season_type || filters.status);
  const currentYearFilter = filters.year ? { year: filters.year } : {};

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="시즌 요약" data-testid="season-list-operations-board">
      <div className="min-w-0" data-testid="season-list-metric-total">
        <StatTile
          className={cn('flex h-full w-full flex-col', !hasActiveFilters && selectedTile)}
          icon={CalendarDays}
          label="전체 시즌"
          tone="primary"
          value={`${stats.total}개`}
          onClick={onClearFilters}
        />
      </div>
      <div className="min-w-0" data-testid="season-list-metric-active">
        <StatTile
          className={cn('flex h-full w-full flex-col', filters.status === 'active' && selectedTile)}
          icon={CircleCheck}
          label="진행 중"
          tone="success"
          value={`${stats.active}개`}
          onClick={() => onFilterChange({ ...currentYearFilter, status: 'active' })}
        />
      </div>
      <div className="min-w-0" data-testid="season-list-metric-early">
        <StatTile
          className={cn('flex h-full w-full flex-col', filters.season_type === 'early' && selectedTile)}
          icon={Flag}
          label="수시 시즌"
          tone="primary"
          value={`${stats.early}개`}
          onClick={() => onFilterChange({ ...currentYearFilter, season_type: 'early' })}
        />
      </div>
      <div className="min-w-0" data-testid="season-list-metric-regular">
        <StatTile
          className={cn('flex h-full w-full flex-col', filters.season_type === 'regular' && selectedTile)}
          icon={Trophy}
          label="정시 시즌"
          tone="warning"
          value={`${stats.regular}개`}
          onClick={() => onFilterChange({ ...currentYearFilter, season_type: 'regular' })}
        />
      </div>
    </section>
  );
}
