'use client';

import { cn } from '@/lib/utils';
import { CONSULTATION_STATUS_LABELS } from '@/lib/types/consultation';
import type { ConsultationStatus } from '@/lib/types/consultation';

interface Props {
  stats: Record<string, number>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
}

const STAT_ITEMS: Array<{
  status: ConsultationStatus | '';
  label: string;
  tone: string;
}> = [
  { status: '', label: '전체', tone: 'text-foreground' },
  { status: 'pending', label: CONSULTATION_STATUS_LABELS.pending, tone: 'text-warning' },
  { status: 'confirmed', label: CONSULTATION_STATUS_LABELS.confirmed, tone: 'text-primary' },
  { status: 'completed', label: CONSULTATION_STATUS_LABELS.completed, tone: 'text-success' },
  { status: 'cancelled', label: CONSULTATION_STATUS_LABELS.cancelled, tone: 'text-secondary-foreground' },
  { status: 'no_show', label: CONSULTATION_STATUS_LABELS.no_show, tone: 'text-destructive' },
];

/** 상태별 상담 수. 누르면 그 상태만 보고, 다시 누르면 전체로 돌아간다. */
export function ConsultationStatsCards({ stats, statusFilter, onStatusFilter }: Props) {
  const statuses: ConsultationStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  const total = stats.total ?? statuses.reduce((sum, status) => sum + (stats[status] || 0), 0);

  return (
    <div className="grid grid-cols-3 gap-2 sm:gap-3 lg:grid-cols-6" data-testid="consultations-work-queue">
      {STAT_ITEMS.map((item) => {
        const active = item.status ? statusFilter === item.status : !statusFilter;
        const value = item.status ? stats[item.status] || 0 : total;
        return (
          <button
            key={item.status || 'all'}
            type="button"
            aria-pressed={active}
            className={cn(
              'min-w-0 rounded-2xl bg-card px-4 py-3.5 text-left transition-colors hover:bg-card/70 active:scale-[0.99] sm:p-5',
              active && 'ring-2 ring-primary'
            )}
            onClick={() => onStatusFilter(item.status && statusFilter !== item.status ? item.status : '')}
          >
            <span className="block text-sm font-semibold text-secondary-foreground">{item.label}</span>
            <span className={cn('mt-1 block text-[24px] font-extrabold leading-tight tracking-tight tabular-nums sm:text-[26px]', item.tone)}>
              {value}
              <span className="ml-0.5 text-sm font-bold text-muted-foreground">건</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}
