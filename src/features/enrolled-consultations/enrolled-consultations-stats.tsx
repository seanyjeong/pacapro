import { EnrolledStatCard } from './enrolled-stat-card';

interface EnrolledConsultationsStatsProps {
  stats: Record<string, number>;
  statusFilter: string;
  onStatusChange: (status: string) => void;
}

export function EnrolledConsultationsStats({ stats, statusFilter, onStatusChange }: EnrolledConsultationsStatsProps) {
  const toggle = (status: string) => onStatusChange(statusFilter === status ? '' : status);
  return (
    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <EnrolledStatCard label="전체" value={stats.total || 0} active={!statusFilter} onClick={() => onStatusChange('')} />
      <EnrolledStatCard label="대기중" value={stats.pending || 0} tone="pending" active={statusFilter === 'pending'} onClick={() => toggle('pending')} />
      <EnrolledStatCard label="확정" value={stats.confirmed || 0} tone="confirmed" active={statusFilter === 'confirmed'} onClick={() => toggle('confirmed')} />
      <EnrolledStatCard label="완료" value={stats.completed || 0} tone="completed" active={statusFilter === 'completed'} onClick={() => toggle('completed')} />
    </div>
  );
}
