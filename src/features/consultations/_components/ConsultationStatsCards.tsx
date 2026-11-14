'use client';

import { Ban, CalendarCheck2, CheckCircle2, Clock3, UserRoundCheck, UsersRound } from 'lucide-react';
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
  helper: string;
  icon: typeof UsersRound;
  tone: string;
}> = [
  { status: '', label: '전체', helper: '전체 상담', icon: UsersRound, tone: 'bg-muted text-secondary-foreground' },
  { status: 'pending', label: CONSULTATION_STATUS_LABELS.pending, helper: '확인 필요', icon: Clock3, tone: 'bg-warning-soft text-warning' },
  { status: 'confirmed', label: CONSULTATION_STATUS_LABELS.confirmed, helper: '일정 확정', icon: CalendarCheck2, tone: 'bg-sky-50 text-sky-700' },
  { status: 'completed', label: CONSULTATION_STATUS_LABELS.completed, helper: '상담 완료', icon: CheckCircle2, tone: 'bg-success-soft text-success' },
  { status: 'cancelled', label: CONSULTATION_STATUS_LABELS.cancelled, helper: '취소 처리', icon: Ban, tone: 'bg-destructive-soft text-destructive' },
  { status: 'no_show', label: CONSULTATION_STATUS_LABELS.no_show, helper: '미방문', icon: UserRoundCheck, tone: 'bg-muted text-secondary-foreground' },
];

export function ConsultationStatsCards({ stats, statusFilter, onStatusFilter }: Props) {
  const statuses: ConsultationStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  const total = stats.total ?? statuses.reduce((sum, status) => sum + (stats[status] || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      {STAT_ITEMS.map((item) => {
        const Icon = item.icon;
        const active = item.status ? statusFilter === item.status : !statusFilter;
        const value = item.status ? stats[item.status] || 0 : total;
        return (
          <button
            key={item.status || 'all'}
            type="button"
            aria-pressed={active}
            className={cn(
              'rounded-md border border-border bg-card p-4 text-left transition-colors hover:bg-muted/40',
              active && 'border-primary ring-2 ring-primary/20'
            )}
            onClick={() => onStatusFilter(item.status && statusFilter !== item.status ? item.status : '')}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-2xl font-semibold tracking-normal text-foreground">{value}</div>
                <p className="mt-1 text-sm font-medium text-foreground">{item.label}</p>
                <p className="mt-1 text-xs text-muted-foreground">{item.helper}</p>
              </div>
              <span className={cn('flex h-9 w-9 shrink-0 items-center justify-center rounded-md', item.tone)}>
                <Icon className="h-4 w-4" />
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
