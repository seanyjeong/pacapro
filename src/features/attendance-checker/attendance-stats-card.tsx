import { UserCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { calculateAttendanceStats } from '@/lib/utils/schedule-helpers';

type AttendanceStats = ReturnType<typeof calculateAttendanceStats>;

interface AttendanceStatsCardProps {
  stats: AttendanceStats;
}

export function AttendanceStatsCard({ stats }: AttendanceStatsCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <UserCheck className="h-5 w-5" />
          출석 통계
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
          <StatCell label="전체" value={stats.total} />
          <StatCell label="출석" value={stats.present} className="text-green-600" />
          <StatCell label="결석" value={stats.absent} className="text-red-600" />
          <StatCell label="지각" value={stats.late} className="text-yellow-600" />
          <StatCell label="공결" value={stats.excused} className="text-blue-600" />
          <StatCell label="보충" value={stats.makeup} className="text-purple-600" />
        </div>
        <div className="mt-4 pt-4 border-t text-center">
          <p className="text-lg font-semibold">출석률: {stats.presentRate}%</p>
        </div>
      </CardContent>
    </Card>
  );
}

interface StatCellProps {
  label: string;
  value: number;
  className?: string;
}

function StatCell({ label, value, className }: StatCellProps) {
  return (
    <div className="text-center">
      <p className={`text-2xl font-bold ${className || ''}`}>{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}
