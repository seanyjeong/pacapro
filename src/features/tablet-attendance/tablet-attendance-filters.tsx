import { Search } from 'lucide-react';
import { TABLET_STATUS_OPTIONS, TABLET_STUDENT_TYPE_OPTIONS } from './tablet-attendance-constants';
import type { TabletAttendanceFilters } from './tablet-attendance-types';

interface TabletAttendanceFiltersProps {
  filters: TabletAttendanceFilters;
  onChange: (filters: TabletAttendanceFilters) => void;
}

export function TabletAttendanceFilters({ filters, onChange }: TabletAttendanceFiltersProps) {
  return (
    <section className="rounded-lg border border-border bg-card p-4" aria-label="출석 검색 필터">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <input
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          className="w-full rounded-lg border border-border bg-card py-3 pl-10 pr-3 text-base text-foreground outline-none focus:ring-2 focus:ring-muted-foreground/40"
          placeholder="학생 이름 검색"
          aria-label="학생 이름 검색"
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">상태</p>
          <div className="grid grid-cols-6 gap-1.5">
            {TABLET_STATUS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange({ ...filters, status: option.value })}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition
                  ${filters.status === option.value
                    ? 'border-muted-foreground/40 bg-foreground text-white'
                    : 'border-border bg-muted text-secondary-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-muted-foreground">학생 유형</p>
          <div className="grid grid-cols-5 gap-1.5">
            {TABLET_STUDENT_TYPE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange({ ...filters, studentType: option.value })}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition
                  ${filters.studentType === option.value
                    ? 'border-muted-foreground/40 bg-foreground text-white'
                    : 'border-border bg-muted text-secondary-foreground'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
