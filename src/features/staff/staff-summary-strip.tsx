'use client';

import { ShieldCheck, UserCheck, UserPlus, Users } from 'lucide-react';
import type { StaffSummary } from './staff-page-utils';

interface Props {
  summary: StaffSummary;
}

const items = [
  { key: 'totalCount', label: '등록 계정', icon: Users },
  { key: 'activeCount', label: '활성 계정', icon: UserCheck },
  { key: 'availableCount', label: '권한 부여 대기', icon: UserPlus },
  { key: 'inactiveCount', label: '비활성 계정', icon: ShieldCheck },
] as const;

export function StaffSummaryStrip({ summary }: Props) {
  return (
    <section
      className="grid overflow-hidden rounded-md border border-border bg-card sm:grid-cols-2 xl:grid-cols-4"
      data-testid="staff-summary-strip"
      aria-label="직원 권한 요약"
    >
      {items.map(({ key, label, icon: Icon }) => (
        <div key={key} className="flex items-center justify-between gap-3 border-b border-border p-4 last:border-b-0 sm:odd:border-r xl:border-b-0 xl:border-r xl:last:border-r-0">
          <div>
            <p className="text-xs font-medium text-muted-foreground">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-foreground">{summary[key]}명</p>
          </div>
          <span className="flex h-9 w-9 items-center justify-center rounded-md bg-slate-100 text-slate-700 dark:bg-slate-900 dark:text-slate-200">
            <Icon className="h-4 w-4" />
          </span>
        </div>
      ))}
    </section>
  );
}
