import { Search } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils/cn';
import { TABLET_STATUS_OPTIONS, TABLET_STUDENT_TYPE_OPTIONS } from './tablet-attendance-constants';
import type { TabletAttendanceFilters } from './tablet-attendance-types';

interface TabletAttendanceFiltersProps {
  filters: TabletAttendanceFilters;
  trailing?: React.ReactNode;
  onChange: (filters: TabletAttendanceFilters) => void;
}

function chipClass(active: boolean) {
  return cn(
    'inline-flex h-10 shrink-0 items-center rounded-full px-4 text-sm font-semibold transition-colors',
    active ? 'bg-foreground text-background' : 'bg-muted text-secondary-foreground hover:text-foreground'
  );
}

/** 본문 카드 맨 위 필터 줄: 검색 + 상태 칩 + 학생 유형 칩 */
export function TabletAttendanceFilters({ filters, trailing, onChange }: TabletAttendanceFiltersProps) {
  return (
    <section className="space-y-3 rounded-2xl bg-card p-4" aria-label="출석 검색 필터">
      <div className="flex items-center gap-3">
        <div className="relative min-w-0 flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(event) => onChange({ ...filters, query: event.target.value })}
            className="pl-10"
            placeholder="학생 이름 검색"
            aria-label="학생 이름 검색"
          />
        </div>
        {trailing}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="상태">
          {TABLET_STATUS_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={filters.status === option.value}
              onClick={() => onChange({ ...filters, status: option.value })}
              className={chipClass(filters.status === option.value)}
            >
              {option.label}
            </button>
          ))}
        </div>
        <span className="hidden h-6 w-px bg-border lg:block" aria-hidden="true" />
        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="학생 유형">
          {TABLET_STUDENT_TYPE_OPTIONS.map((option) => (
            <button
              type="button"
              key={option.value}
              aria-pressed={filters.studentType === option.value}
              onClick={() => onChange({ ...filters, studentType: option.value })}
              className={chipClass(filters.studentType === option.value)}
            >
              {option.value === 'all' ? '모든 유형' : option.label}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}
