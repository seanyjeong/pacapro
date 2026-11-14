import { Award, CheckCircle2, Clock, GraduationCap } from 'lucide-react';
import { StatTile } from '@/components/ui/page';
import { cn } from '@/lib/utils';
import type { JungsiStatus, PerformanceStudent, PerformanceStudentStatusFilter } from './performance-types';
import { EXAM_TYPES } from './performance-utils';

interface PerformanceSummaryProps {
  status: JungsiStatus | null;
  statusLoading: boolean;
  students: PerformanceStudent[];
  studentsError: string | null;
  studentsLoading: boolean;
  studentStatusFilter: PerformanceStudentStatusFilter;
  onStudentStatusFilterChange: (filter: PerformanceStudentStatusFilter) => void;
}

const selectedTile = 'ring-2 ring-primary/40';

/** 재원·휴원·전체 칸을 누르면 학생 목록이 그 상태로 걸러진다(옛 성적 작업 보드와 같은 동작). */
export function PerformanceSummary({
  status,
  statusLoading,
  students,
  studentsError,
  studentsLoading,
  studentStatusFilter,
  onStudentStatusFilterChange,
}: PerformanceSummaryProps) {
  const activeCount = students.filter((student) => student.status === 'active').length;
  const pausedCount = students.filter((student) => student.status === 'paused').length;
  const examCount = status?.examTypes?.length || EXAM_TYPES.length;
  const filterTile = (filter: PerformanceStudentStatusFilter) =>
    cn('flex h-full w-full flex-col disabled:opacity-60', studentStatusFilter === filter && selectedTile);

  return (
    <section className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label="성적 요약" data-testid="performance-operations-board">
      <div className="min-w-0" data-testid="performance-metric-active">
        <StatTile
          className={filterTile('active')}
          icon={GraduationCap}
          label="재원 학생"
          tone="success"
          value={studentsLoading ? '-' : `${activeCount}명`}
          onClick={studentsLoading ? undefined : () => onStudentStatusFilterChange('active')}
        />
      </div>
      <div className="min-w-0" data-testid="performance-metric-paused">
        <StatTile
          className={filterTile('paused')}
          icon={Clock}
          label="휴원 학생"
          tone="warning"
          value={studentsLoading ? '-' : `${pausedCount}명`}
          onClick={studentsLoading ? undefined : () => onStudentStatusFilterChange('paused')}
        />
      </div>
      <div className="min-w-0" data-testid="performance-metric-ready">
        <StatTile
          className={filterTile('all')}
          icon={CheckCircle2}
          label="전체 조회"
          tone="primary"
          value={studentsLoading ? '-' : studentsError ? '확인' : `${students.length}명`}
          onClick={studentsLoading ? undefined : () => onStudentStatusFilterChange('all')}
        />
      </div>
      <div className="min-w-0" data-testid="performance-metric-exams">
        <StatTile className="h-full" icon={Award} label="시험 종류" value={statusLoading ? '-' : `${examCount}종`} />
      </div>
    </section>
  );
}
