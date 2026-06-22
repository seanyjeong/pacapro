import { CalendarCheck2, CheckCircle2, Clock3, UsersRound } from 'lucide-react';
import { EnrolledStatCard } from './enrolled-stat-card';

interface EnrolledConsultationsStatsProps {
  stats: Record<string, number>;
}

export function EnrolledConsultationsStats({ stats }: EnrolledConsultationsStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
      <EnrolledStatCard label="전체" value={stats.total || 0} helper="재원생 상담 전체" icon={<UsersRound className="h-4 w-4" />} />
      <EnrolledStatCard label="대기중" value={stats.pending || 0} helper="확인 필요" icon={<Clock3 className="h-4 w-4" />} tone="pending" />
      <EnrolledStatCard label="확정" value={stats.confirmed || 0} helper="일정 확정" icon={<CalendarCheck2 className="h-4 w-4" />} tone="confirmed" />
      <EnrolledStatCard label="완료" value={stats.completed || 0} helper="상담 완료" icon={<CheckCircle2 className="h-4 w-4" />} tone="completed" />
    </div>
  );
}
