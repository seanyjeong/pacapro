'use client';

import { StatTile } from '@/components/ui/page';
import type { StaffSummary } from './staff-page-utils';

interface Props {
  summary: StaffSummary;
}

const items = [
  { key: 'totalCount', label: '등록 계정', tone: 'neutral' },
  { key: 'activeCount', label: '활성 계정', tone: 'success' },
  { key: 'availableCount', label: '권한 부여 대기', tone: 'primary' },
  { key: 'inactiveCount', label: '비활성 계정', tone: 'neutral' },
] as const;

export function StaffSummaryStrip({ summary }: Props) {
  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" data-testid="staff-summary-strip" aria-label="직원 권한 요약">
      {items.map(({ key, label, tone }) => (
        <StatTile
          key={key}
          label={label}
          tone={tone}
          value={<>{summary[key]}<span className="ml-0.5 text-base font-bold text-muted-foreground">명</span></>}
        />
      ))}
    </section>
  );
}
