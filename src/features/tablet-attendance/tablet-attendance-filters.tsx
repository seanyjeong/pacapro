import { Search } from 'lucide-react';
import { TABLET_STATUS_OPTIONS, TABLET_STUDENT_TYPE_OPTIONS } from './tablet-attendance-constants';
import type { TabletAttendanceFilters } from './tablet-attendance-types';

interface TabletAttendanceFiltersProps {
  filters: TabletAttendanceFilters;
  onChange: (filters: TabletAttendanceFilters) => void;
}

export function TabletAttendanceFilters({ filters, onChange }: TabletAttendanceFiltersProps) {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-950" aria-label="출석 검색 필터">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-zinc-400" />
        <input
          value={filters.query}
          onChange={(event) => onChange({ ...filters, query: event.target.value })}
          className="w-full rounded-lg border border-zinc-300 bg-white py-3 pl-10 pr-3 text-base text-zinc-950 outline-none focus:ring-2 focus:ring-zinc-900 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-50"
          placeholder="학생 이름 검색"
          aria-label="학생 이름 검색"
        />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">상태</p>
          <div className="grid grid-cols-6 gap-1.5">
            {TABLET_STATUS_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange({ ...filters, status: option.value })}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition
                  ${filters.status === option.value
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}
              >
                {option.label}
              </button>
            ))}
          </div>
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">학생 유형</p>
          <div className="grid grid-cols-5 gap-1.5">
            {TABLET_STUDENT_TYPE_OPTIONS.map((option) => (
              <button
                type="button"
                key={option.value}
                onClick={() => onChange({ ...filters, studentType: option.value })}
                className={`rounded-lg border px-2 py-2 text-sm font-medium transition
                  ${filters.studentType === option.value
                    ? 'border-zinc-950 bg-zinc-950 text-white dark:border-zinc-50 dark:bg-zinc-50 dark:text-zinc-950'
                    : 'border-zinc-200 bg-zinc-50 text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-300'}`}
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
