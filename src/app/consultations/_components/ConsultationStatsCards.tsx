'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CONSULTATION_STATUS_LABELS } from '@/lib/types/consultation';
import type { ConsultationStatus } from '@/lib/types/consultation';

interface Props {
  stats: Record<string, number>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
}

export function ConsultationStatsCards({ stats, statusFilter, onStatusFilter }: Props) {
  const statuses: ConsultationStatus[] = ['pending', 'confirmed', 'completed', 'cancelled', 'no_show'];
  const total = stats.total ?? statuses.reduce((sum, status) => sum + (stats[status] || 0), 0);

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
      <Card className={`cursor-pointer rounded-md shadow-none transition-colors hover:bg-muted/40 ${!statusFilter ? 'ring-2 ring-blue-500' : ''}`} onClick={() => onStatusFilter('')}>
        <CardContent className="pt-4">
          <div className="text-2xl font-semibold text-foreground">{total}</div>
          <p className="text-sm text-muted-foreground">전체</p>
        </CardContent>
      </Card>
      {statuses.map((status) => (
        <Card
          key={status}
          className={`cursor-pointer rounded-md shadow-none transition-colors hover:bg-muted/40 ${statusFilter === status ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => onStatusFilter(statusFilter === status ? '' : status)}
        >
          <CardContent className="pt-4">
            <div className="text-2xl font-semibold text-foreground">{stats[status] || 0}</div>
            <p className="text-sm text-muted-foreground">{CONSULTATION_STATUS_LABELS[status]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
