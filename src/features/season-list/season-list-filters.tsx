import type { SeasonFilters, SeasonStatus, SeasonType } from '@/lib/types/season';
import { Button } from '@/components/ui/button';

interface SeasonListFiltersProps {
  filters: SeasonFilters;
  years: number[];
  onChange: (filters: SeasonFilters) => void;
  onClear: () => void;
}

export function SeasonListFilters({ filters, years, onChange, onClear }: SeasonListFiltersProps) {
  const hasFilters = Boolean(filters.year || filters.season_type || filters.status);

  return (
    <section className="rounded-md border border-slate-200 bg-white px-4 py-4">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-[repeat(3,minmax(0,180px))_auto] md:items-end">
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          연도
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={filters.year || ''}
            onChange={(event) => onChange({ ...filters, year: event.target.value ? Number(event.target.value) : undefined })}
          >
            <option value="">모든 연도</option>
            {years.map((year) => (
              <option key={year} value={year}>{year}년</option>
            ))}
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          시즌 타입
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={filters.season_type || ''}
            onChange={(event) => onChange({ ...filters, season_type: (event.target.value as SeasonType) || undefined })}
          >
            <option value="">모든 시즌 타입</option>
            <option value="early">수시</option>
            <option value="regular">정시</option>
          </select>
        </label>
        <label className="grid gap-1 text-sm font-medium text-slate-700">
          상태
          <select
            className="h-10 rounded-md border border-slate-300 bg-white px-3 text-sm text-slate-900"
            value={filters.status || ''}
            onChange={(event) => onChange({ ...filters, status: (event.target.value as SeasonStatus) || undefined })}
          >
            <option value="">모든 상태</option>
            <option value="draft">준비중</option>
            <option value="active">진행중</option>
            <option value="ended">종료</option>
            <option value="cancelled">취소</option>
          </select>
        </label>
        {hasFilters && (
          <Button variant="ghost" size="sm" onClick={onClear}>
            필터 초기화
          </Button>
        )}
      </div>
    </section>
  );
}
