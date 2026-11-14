import { RotateCcw } from 'lucide-react';
import type { SeasonFilters, SeasonStatus, SeasonType } from '@/lib/types/season';
import { Button } from '@/components/ui/button';

interface SeasonListFiltersProps {
  filters: SeasonFilters;
  years: number[];
  onChange: (filters: SeasonFilters) => void;
  onClear: () => void;
}

// 네이티브 선택칸을 Input 과 같은 회색 칸 모양으로.
const fieldClass =
  'h-11 min-w-0 flex-1 rounded-xl border border-transparent bg-muted px-3 text-[15px] text-foreground outline-none focus-visible:border-primary focus-visible:bg-card focus-visible:ring-4 focus-visible:ring-primary/10 sm:w-40 sm:flex-none';

export function SeasonListFilters({ filters, years, onChange, onClear }: SeasonListFiltersProps) {
  const hasFilters = Boolean(filters.year || filters.season_type || filters.status);

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 border-b border-border/60 px-4 py-4 sm:px-5" role="search" aria-label="시즌 필터">
      <select
        aria-label="연도"
        className={fieldClass}
        value={filters.year || ''}
        onChange={(event) => onChange({ ...filters, year: event.target.value ? Number(event.target.value) : undefined })}
      >
        <option value="">모든 연도</option>
        {years.map((year) => (
          <option key={year} value={year}>{year}년</option>
        ))}
      </select>
      <select
        aria-label="시즌 타입"
        className={fieldClass}
        value={filters.season_type || ''}
        onChange={(event) => onChange({ ...filters, season_type: (event.target.value as SeasonType) || undefined })}
      >
        <option value="">모든 시즌 타입</option>
        <option value="early">수시</option>
        <option value="regular">정시</option>
      </select>
      <select
        aria-label="상태"
        className={fieldClass}
        value={filters.status || ''}
        onChange={(event) => onChange({ ...filters, status: (event.target.value as SeasonStatus) || undefined })}
      >
        <option value="">모든 상태</option>
        <option value="draft">준비중</option>
        <option value="active">진행중</option>
        <option value="ended">종료</option>
        <option value="cancelled">취소</option>
      </select>
      {hasFilters && (
        <Button variant="ghost" className="shrink-0 px-3" onClick={onClear}>
          <RotateCcw className="h-4 w-4" />
          필터 초기화
        </Button>
      )}
    </div>
  );
}
