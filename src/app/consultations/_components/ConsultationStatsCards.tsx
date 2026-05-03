'use client';

import { Card, CardContent } from '@/components/ui/card';
import { CONSULTATION_STATUS_LABELS } from '@/lib/types/consultation';

interface Props {
  stats: Record<string, number>;
  statusFilter: string;
  onStatusFilter: (status: string) => void;
}

export function ConsultationStatsCards({ stats, statusFilter, onStatusFilter }: Props) {
  return (
    <div className="grid grid-cols-5 gap-4">
      <Card className="cursor-pointer hover:shadow-md transition-shadow" onClick={() => onStatusFilter('')}>
        <CardContent className="pt-4">
          <div className="text-2xl font-bold">
            {Object.values(stats).reduce((a, b) => a + b, 0)}
          </div>
          <p className="text-sm text-muted-foreground">전체</p>
        </CardContent>
      </Card>
      {(['pending', 'confirmed', 'completed', 'cancelled'] as const).map((status) => (
        <Card
          key={status}
          className={`cursor-pointer hover:shadow-md transition-shadow ${statusFilter === status ? 'ring-2 ring-blue-500' : ''}`}
          onClick={() => onStatusFilter(statusFilter === status ? '' : status)}
        >
          <CardContent className="pt-4">
            <div className="text-2xl font-bold text-foreground">{stats[status] || 0}</div>
            <p className="text-sm text-muted-foreground">{CONSULTATION_STATUS_LABELS[status]}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
