import { EnrolledStatCard } from './enrolled-stat-card';

interface EnrolledConsultationsStatsProps {
  stats: Record<string, number>;
}

export function EnrolledConsultationsStats({ stats }: EnrolledConsultationsStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      <EnrolledStatCard label="전체" value={stats.total || 0} />
      <EnrolledStatCard label="대기중" value={stats.pending || 0} className="text-yellow-600" />
      <EnrolledStatCard label="확정" value={stats.confirmed || 0} className="text-blue-600" />
      <EnrolledStatCard label="완료" value={stats.completed || 0} className="text-green-600" />
    </div>
  );
}
